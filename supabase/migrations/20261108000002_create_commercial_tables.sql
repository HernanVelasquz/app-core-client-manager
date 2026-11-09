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

