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

