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

