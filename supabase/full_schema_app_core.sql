-- ============================================================================
-- 0. CREACIÓN DEL ESQUEMA PERSONAL Y PERMISOS PARA SUPABASE API (PostgREST)
-- ============================================================================
create schema if not exists app_core;

-- Otorgar permisos de uso del esquema únicamente a usuarios autenticados y service_role
-- (Se revoca acceso a PUBLIC y anon por principio de menor privilegio)
revoke all on schema app_core from public, anon;

grant usage on schema app_core to authenticated,
service_role;

grant all on all tables in schema app_core to authenticated,
service_role;

grant all on all sequences in schema app_core to authenticated,
service_role;

-- Asegurar que las tablas futuras hereden permisos solo para authenticated y service_role,
-- y revocar ejecución por defecto de funciones a PUBLIC y anon
alter default privileges for role postgres in schema app_core
revoke all on tables from public, anon;

alter default privileges for role postgres in schema app_core
revoke execute on functions from public, anon;

alter default privileges for role postgres in schema app_core
grant all on tables to authenticated,
service_role;

alter default privileges for role postgres in schema app_core
grant all on sequences to authenticated,
service_role;

create extension if not exists "pgcrypto";

-- Función utilitaria dentro del esquema personal para actualizar updated_at
create or replace function app_core.handle_updated_at () returns trigger language plpgsql security invoker
set
  search_path = app_core,
  public as $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

revoke all on function app_core.handle_updated_at () from public, anon;

-- ============================================================================
-- 1. CONTEXTO DE IDENTIDAD Y ACCESO (IAM) EN ESQUEMA app_core
-- ============================================================================
create table app_core.iam_permissions (
  id uuid primary key default gen_random_uuid (),
  code varchar(100) not null unique,
  description varchar(255) not null,
  created_at timestamptz not null default now()
);

create table app_core.iam_roles (
  id uuid primary key default gen_random_uuid (),
  name varchar(80) not null unique,
  description varchar(255),
  is_system_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_core.iam_role_permissions (
  role_id uuid not null references app_core.iam_roles (id) on delete cascade,
  permission_id uuid not null references app_core.iam_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Perfil de usuario en app_core vinculado 1:1 con auth.users de Supabase
create table app_core.iam_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role_id uuid not null references app_core.iam_roles (id) on delete restrict,
  full_name varchar(150) not null,
  email varchar(150) not null unique,
  avatar_url text,
  is_active boolean not null default true,
  created_by uuid references app_core.iam_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_iam_profiles_role_id on app_core.iam_profiles (role_id);

create index idx_iam_profiles_email on app_core.iam_profiles (email);

-- ============================================================================
-- 2. CONTEXTO COMERCIAL Y COTIZACIONES (CLIENTS, QUOTES & SIGNATURES)
-- ============================================================================
create table app_core.com_clients (
  id uuid primary key default gen_random_uuid (),
  full_name varchar(150) not null,
  contact_phone varchar(40) not null,
  email varchar(150) not null,
  company_name varchar(150),
  notes text,
  created_by uuid references app_core.iam_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_com_clients_quick_search on app_core.com_clients (full_name, email, contact_phone);

create table app_core.com_quote_templates (
  id uuid primary key default gen_random_uuid (),
  name varchar(120) not null,
  base_structure jsonb not null default '{"agreements": "", "objectives": "", "deliverables": ""}'::jsonb,
  file_template_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_core.com_quotes (
  id uuid primary key default gen_random_uuid (),
  client_id uuid not null references app_core.com_clients (id) on delete restrict,
  template_id uuid references app_core.com_quote_templates (id) on delete set null,
  project_title varchar(200) not null,
  project_description text not null,
  dev_time_value integer not null check (dev_time_value > 0),
  dev_time_unit varchar(20) not null check (dev_time_unit in ('DAYS', 'WEEKS', 'MONTHS')),
  estimated_cost numeric(14, 2) not null default 0.00,
  status varchar(30) not null default 'DRAFT' check (
    status in (
      'DRAFT',
      'PENDING_SIGNATURES',
      'ACCEPTED',
      'REJECTED'
    )
  ),
  created_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_com_quotes_client_id on app_core.com_quotes (client_id);

create index idx_com_quotes_status on app_core.com_quotes (status);

create table app_core.com_quote_requirements (
  id uuid primary key default gen_random_uuid (),
  quote_id uuid not null references app_core.com_quotes (id) on delete cascade,
  solution_type varchar(40) not null check (
    solution_type in (
      'MOBILE',
      'WEB',
      'BACKEND',
      'AUTOMATION',
      'DESKTOP',
      'OTHER'
    )
  ),
  technical_scope text not null,
  functional_specs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table app_core.com_quote_agreements (
  quote_id uuid primary key references app_core.com_quotes (id) on delete cascade,
  agreements_content text not null,
  objectives_content text not null,
  deliverables_content text not null,
  dev_signer_user_id uuid references app_core.iam_profiles (id) on delete set null,
  dev_signature_path text,
  dev_signed_at timestamptz,
  client_signature_path text,
  client_signed_at timestamptz,
  document_hash varchar(64),
  updated_at timestamptz not null default now()
);

create table app_core.com_quote_attachments (
  id uuid primary key default gen_random_uuid (),
  quote_id uuid not null references app_core.com_quotes (id) on delete cascade,
  uploaded_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  file_name varchar(255) not null,
  storage_path text not null,
  mime_type varchar(100) not null,
  uploaded_at timestamptz not null default now()
);

-- ============================================================================
-- 3. CONTEXTO DE GESTIÓN DE PROYECTOS (PROJECTS, TEAM, TIMELINE & DOCS)
-- ============================================================================
create table app_core.prj_projects (
  id uuid primary key default gen_random_uuid (),
  source_quote_id uuid not null unique references app_core.com_quotes (id) on delete restrict,
  client_id uuid not null references app_core.com_clients (id) on delete restrict,
  title varchar(200) not null,
  description text not null,
  cover_image_path text,
  status varchar(30) not null default 'ACTIVE' check (
    status in (
      'PLANNING',
      'ACTIVE',
      'ON_HOLD',
      'COMPLETED',
      'CANCELLED'
    )
  ),
  start_date date not null,
  estimated_end_date date not null,
  created_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_prj_projects_client_id on app_core.prj_projects (client_id);

create index idx_prj_projects_status on app_core.prj_projects (status);

create table app_core.prj_project_members (
  project_id uuid not null references app_core.prj_projects (id) on delete cascade,
  user_id uuid not null references app_core.iam_profiles (id) on delete cascade,
  assigned_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  project_role varchar(60) not null default 'Desarrollador',
  assigned_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index idx_prj_members_user_id on app_core.prj_project_members (user_id);

create table app_core.prj_timeline_milestones (
  id uuid primary key default gen_random_uuid (),
  project_id uuid not null references app_core.prj_projects (id) on delete cascade,
  title varchar(150) not null,
  description text,
  target_date date not null,
  completed_at timestamptz,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_prj_timeline_project_date on app_core.prj_timeline_milestones (project_id, target_date);

create table app_core.prj_project_documents (
  id uuid primary key default gen_random_uuid (),
  project_id uuid not null references app_core.prj_projects (id) on delete cascade,
  uploaded_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  title varchar(200) not null,
  storage_path text not null,
  mime_type varchar(100) not null,
  origin varchar(30) not null check (
    origin in ('QUOTE_INHERITED', 'PROJECT_EXECUTION')
  ),
  uploaded_at timestamptz not null default now()
);

-- ============================================================================
-- 4. CONTEXTO DE TABLERO DE TRABAJO (KANBAN & TASKS)
-- ============================================================================
create table app_core.wb_tasks (
  id uuid primary key default gen_random_uuid (),
  project_id uuid not null references app_core.prj_projects (id) on delete cascade,
  assigned_to_user_id uuid references app_core.iam_profiles (id) on delete set null,
  created_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  title varchar(200) not null,
  description text not null,
  status varchar(30) not null default 'PENDING' check (
    status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKER')
  ),
  priority varchar(20) not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  blocker_reason text,
  board_position double precision not null default 1000.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_wb_tasks_blocker_reason check (
    status <> 'BLOCKER'
    or (
      blocker_reason is not null
      and length(trim(blocker_reason)) > 0
    )
  )
);

create index idx_wb_tasks_project_board on app_core.wb_tasks (project_id, status, board_position);

create index idx_wb_tasks_assigned_dev on app_core.wb_tasks (project_id, assigned_to_user_id);

create index idx_wb_tasks_priority on app_core.wb_tasks (project_id, priority);

create table app_core.wb_task_attachments (
  id uuid primary key default gen_random_uuid (),
  task_id uuid not null references app_core.wb_tasks (id) on delete cascade,
  uploaded_by_user_id uuid not null references app_core.iam_profiles (id) on delete restrict,
  file_name varchar(255) not null,
  storage_path text not null,
  attachment_type varchar(20) not null check (attachment_type in ('IMAGE', 'DOCUMENT')),
  mime_type varchar(100) not null,
  uploaded_at timestamptz not null default now()
);

-- ============================================================================
-- 4.1 INFRAESTRUCTURA TRANSVERSAL DDD: OUTBOX DE EVENTOS DE DOMINIO (app_core)
-- ============================================================================
-- Almacena los DomainEvent emitidos por los AggregateRoot (pullDomainEvents)
-- permitiendo su procesamiento asíncrono, reintentos, integración entre
-- Bounded Contexts (Context Mapping) y trazabilidad/auditoría.
create table app_core.sys_domain_events (
  id uuid primary key,
  aggregate_id uuid not null,
  bounded_context varchar(40) not null check (
    bounded_context in (
      'iam',
      'commercial',
      'project-management',
      'workboard'
    )
  ),
  event_name varchar(120) not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_on timestamptz not null,
  status varchar(20) not null default 'PENDING' check (
    status in (
      'PENDING',
      'PROCESSING',
      'PROCESSED',
      'FAILED'
    )
  ),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  triggered_by_user_id uuid references app_core.iam_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice parcial para consultar rápidamente la cola de eventos pendientes o fallidos por procesar
create index idx_sys_domain_events_outbox_queue
  on app_core.sys_domain_events (status, occurred_on asc)
  where status in ('PENDING', 'FAILED');

-- Índice por agregado para reconstrucción de historial y auditoría
create index idx_sys_domain_events_aggregate
  on app_core.sys_domain_events (aggregate_id, occurred_on desc);

-- Índice por nombre de evento para suscriptores de integración entre contextos
create index idx_sys_domain_events_event_name
  on app_core.sys_domain_events (event_name, occurred_on desc);

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

