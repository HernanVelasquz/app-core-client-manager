-- ============================================================================
-- 5. TRIGGERS DE UPDATED_AT Y SINCRONIZACIÓN ENTRE auth.users Y app_core
-- ============================================================================
create trigger trg_iam_roles_updated_at before
update on app_core.iam_roles for each row
execute function app_core.handle_updated_at ();

create trigger trg_iam_profiles_updated_at before
update on app_core.iam_profiles for each row
execute function app_core.handle_updated_at ();

create trigger trg_com_clients_updated_at before
update on app_core.com_clients for each row
execute function app_core.handle_updated_at ();

create trigger trg_com_templates_updated_at before
update on app_core.com_quote_templates for each row
execute function app_core.handle_updated_at ();

create trigger trg_com_quotes_updated_at before
update on app_core.com_quotes for each row
execute function app_core.handle_updated_at ();

create trigger trg_com_agreements_updated_at before
update on app_core.com_quote_agreements for each row
execute function app_core.handle_updated_at ();

create trigger trg_prj_projects_updated_at before
update on app_core.prj_projects for each row
execute function app_core.handle_updated_at ();

create trigger trg_wb_tasks_updated_at before
update on app_core.wb_tasks for each row
execute function app_core.handle_updated_at ();

create trigger trg_sys_domain_events_updated_at before
update on app_core.sys_domain_events for each row
execute function app_core.handle_updated_at ();

-- Trigger que escucha a auth.users e inserta el perfil directamente en app_core.iam_profiles
create or replace function app_core.handle_new_auth_user () returns trigger language plpgsql security definer
set
  search_path = app_core,
  public as $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT id INTO v_role_id
    FROM app_core.iam_roles
    WHERE name = COALESCE(NEW.raw_user_meta_data->>'role_name', 'Desarrollador')
    LIMIT 1;

    INSERT INTO app_core.iam_profiles (id, role_id, full_name, email, created_by)
    VALUES (
        NEW.id,
        v_role_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NULLIF(NEW.raw_user_meta_data->>'created_by', '')::UUID
    );
    RETURN NEW;
END;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function app_core.handle_new_auth_user ();

-- Revocar ejecución pública y de usuarios sobre la función trigger SECURITY DEFINER
-- (Solo el motor de PostgreSQL / propietario del trigger la ejecuta al crear un auth.users)
revoke all on function app_core.handle_new_auth_user () from public, anon, authenticated;

-- ============================================================================
-- 6. SEMILLA INICIAL DE ROLES Y PERMISOS EN app_core
-- ============================================================================
insert into
  app_core.iam_permissions (code, description)
values
  (
    'ROLE_MANAGE',
    'Crear, editar y eliminar roles dinámicos en la base de datos'
  ),
  (
    'USER_MANAGE',
    'Anexar usuarios al sistema (Exclusivo Admin y Gerente)'
  ),
  ('CLIENT_MANAGE', 'Registrar y consultar clientes'),
  (
    'QUOTE_MANAGE',
    'Crear cotizaciones, formatos, requerimientos y firmas'
  ),
  (
    'PROJECT_CREATE',
    'Crear proyecto a partir de cotización firmada'
  ),
  (
    'PROJECT_ASSIGN_TEAM',
    'Asignar usuarios a proyectos (Exclusivo Admin y Gerente)'
  ),
  (
    'PROJECT_VIEW_ALL',
    'Ver dashboard completo, línea de tiempo y todos los documentos'
  ),
  (
    'PROJECT_VIEW_ASSIGNED_ONLY',
    'Ver solo proyectos asignados y sus tareas'
  ),
  (
    'TASK_MANAGE',
    'Crear tareas, mover estados, ajustar prioridad y anexar archivos'
  )
on conflict (code) do nothing;

insert into
  app_core.iam_roles (name, description, is_system_default)
values
  (
    'Administrador',
    'Control total del sistema, roles dinámicos, usuarios y proyectos',
    true
  ),
  (
    'Gerente',
    'Gestión de usuarios, asignación de proyectos, cotizaciones y seguimiento',
    true
  ),
  (
    'Líder',
    'Gestión de línea de tiempo, documentos de proyecto y tablero de tareas',
    true
  ),
  (
    'Desarrollador',
    'Acceso exclusivo a los proyectos asignados y a las tareas del tablero',
    true
  )
on conflict (name) do nothing;

insert into
  app_core.iam_role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from
  app_core.iam_roles r
  cross join app_core.iam_permissions p
where
  r.name = 'Administrador'
on conflict (role_id, permission_id) do nothing;

insert into
  app_core.iam_role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from
  app_core.iam_roles r
  cross join app_core.iam_permissions p
where
  r.name = 'Gerente'
  and p.code <> 'ROLE_MANAGE'
on conflict (role_id, permission_id) do nothing;

insert into
  app_core.iam_role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from
  app_core.iam_roles r
  cross join app_core.iam_permissions p
where
  r.name = 'Líder'
  and p.code in (
    'CLIENT_MANAGE',
    'QUOTE_MANAGE',
    'PROJECT_VIEW_ALL',
    'TASK_MANAGE'
  )
on conflict (role_id, permission_id) do nothing;

insert into
  app_core.iam_role_permissions (role_id, permission_id)
select
  r.id,
  p.id
from
  app_core.iam_roles r
  cross join app_core.iam_permissions p
where
  r.name = 'Desarrollador'
  and p.code in ('PROJECT_VIEW_ASSIGNED_ONLY', 'TASK_MANAGE')
on conflict (role_id, permission_id) do nothing;

-- ============================================================================
-- 7. FUNCIONES DE AUTORIZACIÓN (SECURITY INVOKER) Y ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Se definen como SECURITY INVOKER (no SECURITY DEFINER) para evitar brechas de
-- elevación de privilegios por RPC, revocando su ejecución a PUBLIC y anon.
create or replace function app_core.user_has_permission (required_permission varchar) returns boolean language sql security invoker
set
  search_path = app_core,
  public stable as $$
    SELECT EXISTS (
        SELECT 1
        FROM app_core.iam_profiles up
        JOIN app_core.iam_role_permissions rp ON rp.role_id = up.role_id
        JOIN app_core.iam_permissions p ON p.id = rp.permission_id
        WHERE up.id = auth.uid()
          AND up.is_active = TRUE
          AND p.code = required_permission
    );
$$;

revoke all on function app_core.user_has_permission (varchar) from public, anon;
grant execute on function app_core.user_has_permission (varchar) to authenticated, service_role;

create or replace function app_core.is_project_member (target_project_id uuid) returns boolean language sql security invoker
set
  search_path = app_core,
  public stable as $$
    SELECT EXISTS (
        SELECT 1
        FROM app_core.prj_project_members pm
        WHERE pm.project_id = target_project_id
          AND pm.user_id = auth.uid()
    );
$$;

revoke all on function app_core.is_project_member (uuid) from public, anon;
grant execute on function app_core.is_project_member (uuid) to authenticated, service_role;

-- Habilitar RLS en todas las tablas del esquema app_core
alter table app_core.iam_permissions enable row level security;

alter table app_core.iam_roles enable row level security;

alter table app_core.iam_role_permissions enable row level security;

alter table app_core.iam_profiles enable row level security;

alter table app_core.com_clients enable row level security;

alter table app_core.com_quote_templates enable row level security;

alter table app_core.com_quotes enable row level security;

alter table app_core.com_quote_requirements enable row level security;

alter table app_core.com_quote_agreements enable row level security;

alter table app_core.com_quote_attachments enable row level security;

alter table app_core.prj_projects enable row level security;

alter table app_core.prj_project_members enable row level security;

alter table app_core.prj_timeline_milestones enable row level security;

alter table app_core.prj_project_documents enable row level security;

alter table app_core.wb_tasks enable row level security;

alter table app_core.wb_task_attachments enable row level security;

alter table app_core.sys_domain_events enable row level security;

-- Políticas de IAM (Lectura separada de escritura para evitar recursión en SECURITY INVOKER)
create policy "Lectura de permisos y roles" on app_core.iam_permissions for
select
  to authenticated using (true);

create policy "Lectura de roles" on app_core.iam_roles for
select
  to authenticated using (true);

create policy "Insertar roles dinámicos" on app_core.iam_roles for
insert
  to authenticated
with
  check (app_core.user_has_permission ('ROLE_MANAGE'));

create policy "Actualizar roles dinámicos" on app_core.iam_roles for
update
  to authenticated using (app_core.user_has_permission ('ROLE_MANAGE'))
with
  check (app_core.user_has_permission ('ROLE_MANAGE'));

create policy "Eliminar roles dinámicos" on app_core.iam_roles for
delete
  to authenticated using (app_core.user_has_permission ('ROLE_MANAGE'));

create policy "Lectura de permisos por rol" on app_core.iam_role_permissions for
select
  to authenticated using (true);

create policy "Insertar permisos de rol" on app_core.iam_role_permissions for
insert
  to authenticated
with
  check (app_core.user_has_permission ('ROLE_MANAGE'));

create policy "Actualizar permisos de rol" on app_core.iam_role_permissions for
update
  to authenticated using (app_core.user_has_permission ('ROLE_MANAGE'))
with
  check (app_core.user_has_permission ('ROLE_MANAGE'));

create policy "Eliminar permisos de rol" on app_core.iam_role_permissions for
delete
  to authenticated using (app_core.user_has_permission ('ROLE_MANAGE'));

create policy "Lectura de perfiles" on app_core.iam_profiles for
select
  to authenticated using (true);

create policy "Insertar usuarios por Admin y Gerente" on app_core.iam_profiles for
insert
  to authenticated
with
  check (app_core.user_has_permission ('USER_MANAGE'));

create policy "Actualizar usuarios por Admin y Gerente" on app_core.iam_profiles for
update
  to authenticated using (app_core.user_has_permission ('USER_MANAGE'))
with
  check (app_core.user_has_permission ('USER_MANAGE'));

create policy "Eliminar usuarios por Admin y Gerente" on app_core.iam_profiles for
delete
  to authenticated using (app_core.user_has_permission ('USER_MANAGE'));

-- Políticas Comerciales (Clientes y Cotizaciones)
create policy "Gestión de clientes" on app_core.com_clients for all to authenticated using (app_core.user_has_permission ('CLIENT_MANAGE'))
with
  check (app_core.user_has_permission ('CLIENT_MANAGE'));

create policy "Gestión de plantillas y cotizaciones" on app_core.com_quote_templates for all to authenticated using (app_core.user_has_permission ('QUOTE_MANAGE'))
with
  check (app_core.user_has_permission ('QUOTE_MANAGE'));

create policy "Gestión de cotizaciones" on app_core.com_quotes for all to authenticated using (app_core.user_has_permission ('QUOTE_MANAGE'))
with
  check (app_core.user_has_permission ('QUOTE_MANAGE'));

create policy "Gestión de requerimientos de cotización" on app_core.com_quote_requirements for all to authenticated using (app_core.user_has_permission ('QUOTE_MANAGE'))
with
  check (app_core.user_has_permission ('QUOTE_MANAGE'));

create policy "Gestión de acuerdos y firmas" on app_core.com_quote_agreements for all to authenticated using (app_core.user_has_permission ('QUOTE_MANAGE'))
with
  check (app_core.user_has_permission ('QUOTE_MANAGE'));

create policy "Gestión de adjuntos de cotización" on app_core.com_quote_attachments for all to authenticated using (app_core.user_has_permission ('QUOTE_MANAGE'))
with
  check (app_core.user_has_permission ('QUOTE_MANAGE'));

-- Políticas de Proyectos
create policy "Ver proyectos (Todos para gestores, solo asignados para Desarrollador)" on app_core.prj_projects for
select
  to authenticated using (
    app_core.user_has_permission ('PROJECT_VIEW_ALL')
    or app_core.is_project_member (id)
  );

create policy "Insertar proyectos" on app_core.prj_projects for
insert
  to authenticated
with
  check (app_core.user_has_permission ('PROJECT_CREATE'));

create policy "Actualizar proyectos" on app_core.prj_projects for
update
  to authenticated using (app_core.user_has_permission ('PROJECT_CREATE'))
with
  check (app_core.user_has_permission ('PROJECT_CREATE'));

create policy "Eliminar proyectos" on app_core.prj_projects for
delete
  to authenticated using (app_core.user_has_permission ('PROJECT_CREATE'));

create policy "Ver miembros del proyecto" on app_core.prj_project_members for
select
  to authenticated using (
    user_id = auth.uid ()
    or app_core.user_has_permission ('PROJECT_VIEW_ALL')
  );

create policy "Insertar miembro al proyecto (Admin y Gerente)" on app_core.prj_project_members for
insert
  to authenticated
with
  check (
    app_core.user_has_permission ('PROJECT_ASSIGN_TEAM')
  );

create policy "Actualizar miembro del proyecto (Admin y Gerente)" on app_core.prj_project_members for
update
  to authenticated using (
    app_core.user_has_permission ('PROJECT_ASSIGN_TEAM')
  )
with
  check (
    app_core.user_has_permission ('PROJECT_ASSIGN_TEAM')
  );

create policy "Eliminar miembro del proyecto (Admin y Gerente)" on app_core.prj_project_members for
delete
  to authenticated using (
    app_core.user_has_permission ('PROJECT_ASSIGN_TEAM')
  );

create policy "Acceso a línea de tiempo y documentos (Oculto para Desarrollador)" on app_core.prj_timeline_milestones for all to authenticated using (app_core.user_has_permission ('PROJECT_VIEW_ALL'))
with
  check (app_core.user_has_permission ('PROJECT_VIEW_ALL'));

create policy "Acceso a documentos del proyecto (Oculto para Desarrollador)" on app_core.prj_project_documents for all to authenticated using (app_core.user_has_permission ('PROJECT_VIEW_ALL'))
with
  check (app_core.user_has_permission ('PROJECT_VIEW_ALL'));

-- Políticas del Tablero de Trabajo (Kanban)
create policy "Acceso a tareas del proyecto" on app_core.wb_tasks for all to authenticated using (
  app_core.user_has_permission ('PROJECT_VIEW_ALL')
  or (
    app_core.is_project_member (project_id)
    and app_core.user_has_permission ('TASK_MANAGE')
  )
)
with
  check (
    app_core.user_has_permission ('PROJECT_VIEW_ALL')
    or (
      app_core.is_project_member (project_id)
      and app_core.user_has_permission ('TASK_MANAGE')
    )
  );

create policy "Acceso a adjuntos de tareas" on app_core.wb_task_attachments for all to authenticated using (
  exists (
    select
      1
    from
      app_core.wb_tasks t
    where
      t.id = task_id
      and (
        app_core.user_has_permission ('PROJECT_VIEW_ALL')
        or app_core.is_project_member (t.project_id)
      )
  )
)
with
  check (
    exists (
      select
        1
      from
        app_core.wb_tasks t
      where
        t.id = task_id
        and (
          app_core.user_has_permission ('PROJECT_VIEW_ALL')
          or app_core.is_project_member (t.project_id)
        )
    )
  );

-- Políticas de Eventos de Dominio (Outbox Transaccional)
create policy "Registrar eventos de dominio generados por casos de uso" on app_core.sys_domain_events for
insert
  to authenticated
with
  check (
    auth.uid () is not null
    and (
      triggered_by_user_id is null
      or triggered_by_user_id = auth.uid ()
    )
  );

create policy "Consultar y procesar eventos de dominio" on app_core.sys_domain_events for
select
  to authenticated using (auth.uid () is not null);

create policy "Actualizar estado de procesamiento de eventos de dominio" on app_core.sys_domain_events for
update
  to authenticated using (auth.uid () is not null)
with
  check (auth.uid () is not null);

