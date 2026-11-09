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

