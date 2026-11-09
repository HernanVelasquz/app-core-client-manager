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

