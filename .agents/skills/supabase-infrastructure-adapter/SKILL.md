---
name: supabase-infrastructure-adapter
description: >-
  Guides the implementation of self-hosted Supabase adapters, Postgres row mappers,
  authentication ports, Realtime subscriptions, and database migrations inside the
  infrastructure layer. Use this skill whenever working with @supabase/supabase-js,
  database repositories, RLS policies, or Supabase Auth/Realtime.
---

# Supabase Infrastructure Adapters (Self-Hosted VPS)

Use this skill when implementing persistence, authentication, or realtime adapters in `src/modules/<bounded-context>/infrastructure/supabase/`, `src/modules/<bounded-context>/infrastructure/mappers/`, or `supabase/migrations/`.

## 1. Core Principles & Non-Negotiable Rules

1. **Strict Layer Isolation:** `@supabase/supabase-js` and generated database types (`supabase gen types`) must **ONLY** exist inside `infrastructure/` (and client creation in `src/app/`). Never import them in `domain`, `application`, or `presentation`.
2. **Single Client Instance:** Create the Supabase client once in `src/app/` and inject it into infrastructure repositories/adapters.
3. **Mandatory Mappers via `toPrimitives` / `fromPrimitives`:** Every Supabase repository must use explicit mappers (`infrastructure/mappers/`) that convert between Postgres rows and Domain Aggregates using `Aggregate.fromPrimitives()` and `aggregate.toPrimitives()`. Never access private aggregate fields.
4. **Error Translation:** Catch Supabase/network errors inside the adapter and translate them into typed application errors (`NetworkError`, `NotFoundError`, `PermissionDeniedError`). Log technical details; never leak raw Postgres/Supabase errors to the UI.
5. **Security & Self-Hosted VPS Rules:**
   - Only use the `anon` key in the client. **Never** include `service_role` in the client or bundle.
   - Read URL and keys from environment configuration (never hardcoded or committed).
   - Enable **Row Level Security (RLS)** on every table and version all schema changes and policies in `supabase/migrations/`.
   - Always connect via HTTPS (TLS reverse proxy) and explicitly whitelist the VPS domain in `tauri.conf.json` CSP (`connect-src`), never `*`.
   - Persist Auth sessions in Tauri's secure storage (keyring/secrets plugin), never in unencrypted `localStorage`.

---

## 2. Directory Structure

```text
supabase/
└── migrations/                       # Versioned SQL migrations + RLS policies
src/
├── app/
│   └── supabase-client.ts            # Single SupabaseClient initialization
└── modules/
    └── <bounded-context>/
        └── infrastructure/
            ├── mappers/
            │   └── <entity>.mapper.ts
            ├── supabase/
            │   └── supabase-<entity>.repository.ts
            └── index.ts
```

---

## 3. Step-by-Step Procedures

### Step 1: Create the Row ⇄ Domain Mapper (`infrastructure/mappers/`)

Define the Postgres row type (or import from `infrastructure`-internal generated types), validate/narrow external payloads if needed, and map via `fromPrimitives` / `toPrimitives`:

```ts
// src/modules/tasks/infrastructure/mappers/task.mapper.ts
import { Task, type TaskPrimitives } from "@/modules/tasks/domain";

export type TaskRow = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
};

export const taskRowToDomain = (row: TaskRow): Task =>
  Task.fromPrimitives({
    id: row.id,
    title: row.title,
    status: row.status,
  });

export const taskDomainToRow = (task: Task): TaskRow => {
  const primitives: TaskPrimitives = task.toPrimitives();
  return {
    id: primitives.id,
    title: primitives.title,
    status: primitives.status,
  };
};
```

### Step 2: Implement the Repository Port (`infrastructure/supabase/`)

Implement the `domain/repositories` contract using arrow functions (or a class implementing the port interface), translating Supabase errors into typed application errors and filtering/indexing queries properly (never fetch full tables to filter in client memory):

```ts
// src/modules/tasks/infrastructure/supabase/supabase-task.repository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskId, TaskRepository } from "@/modules/tasks/domain";
import { taskDomainToRow, taskRowToDomain, type TaskRow } from "../mappers/task.mapper";

export const createSupabaseTaskRepository = (deps: {
  readonly client: SupabaseClient;
}): TaskRepository => ({
  save: async (task: Task): Promise<void> => {
    const row = taskDomainToRow(task);
    const { error } = await deps.client.from("tasks").upsert(row);
    if (error !== null) {
      throw new Error(`Failed to save task: ${error.code}`);
    }
  },

  search: async (id: TaskId): Promise<Task | null> => {
    const { data, error } = await deps.client
      .from("tasks")
      .select("id, title, status")
      .eq("id", id.value)
      .maybeSingle<TaskRow>();

    if (error !== null) {
      throw new Error(`Failed to search task: ${error.code}`);
    }

    return data !== null ? taskRowToDomain(data) : null;
  },

  searchAll: async (): Promise<readonly Task[]> => {
    const { data, error } = await deps.client
      .from("tasks")
      .select("id, title, status")
      .order("created_at", { ascending: false })
      .returns<TaskRow[]>();

    if (error !== null) {
      throw new Error(`Failed to list tasks: ${error.code}`);
    }

    return (data ?? []).map((row) => taskRowToDomain(row));
  },
});
```

### Step 3: Realtime Subscriptions & Auth Adapters

1. **Auth Port (`AuthService`):** Implement authentication behind an application port so `domain` and `application` remain unaware of JWTs or Supabase sessions. Configure the Supabase client in `src/app/` with a custom storage adapter backed by Tauri secure storage.
2. **Realtime Adapters:** Wrap Realtime channels in an adapter that translates external payload events into application commands/events and returns an explicit `unsubscribe: () => void` function so the presentation `viewModel` can register it with `onCleanup`.

### Step 4: Database Migrations & RLS (`supabase/migrations/`)

Every table creation or modification must live in a timestamped SQL migration file and enable RLS immediately:

```sql
-- supabase/migrations/20261108000000_create_tasks_table.sql
create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null check (status in ('pending', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_status_idx on public.tasks (user_id, status);

alter table public.tasks enable row level security;

create policy "Users can manage their own tasks"
  on public.tasks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## 4. Verification Checklist

- [ ] Is `@supabase/supabase-js` imported only inside `infrastructure/` and `src/app/`?
- [ ] Do all mappers use `Aggregate.fromPrimitives()` and `aggregate.toPrimitives()`?
- [ ] Are Supabase errors caught and translated to typed application errors?
- [ ] Do queries select explicit columns, apply filters, and avoid full-table client-side filtering?
- [ ] Does every table have RLS enabled and policies versioned under `supabase/migrations/`?
- [ ] Is session persistence using Tauri secure storage rather than plain `localStorage`?

