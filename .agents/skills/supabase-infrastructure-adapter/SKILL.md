---
name: supabase-infrastructure-adapter
description: >-
  Guides the implementation of self-hosted Supabase adapters targeting the custom
  app_core PostgreSQL schema (iam_, com_, prj_, wb_ tables), Postgres row mappers,
  RLS policies using app_core.user_has_permission and app_core.is_project_member,
  authentication ports, and Realtime subscriptions. Use this skill whenever working
  with @supabase/supabase-js, database repositories, RLS policies, or migrations.
---

# Supabase Infrastructure Adapters (`app_core` Schema & Self-Hosted VPS)

Use this skill when implementing persistence, authentication, or realtime adapters in `src/shared/infrastructure/supabase/`, `src/modules/{iam,commercial,project-management,workboard}/infrastructure/supabase/`, `infrastructure/mappers/`, or `supabase/migrations/`.

## 1. Core Principles & Non-Negotiable Rules

1. **Strict Layer Isolation:** `@supabase/supabase-js` and generated database types (`supabase gen types`) must **ONLY** exist inside `infrastructure/` (and client creation in `src/app/` or `src/shared/infrastructure/supabase/`). Never import them in `domain`, `application`, or `presentation`.
2. **Custom Schema `app_core`:** All domain tables and security functions reside in the PostgreSQL schema **`app_core`**. Configure the Supabase client with `db: { schema: "app_core" }`.
3. **Mandatory Mappers via `toPrimitives` / `fromPrimitives`:** Every Supabase repository must use explicit mappers (`infrastructure/mappers/`) that convert between Postgres rows and Domain Aggregates using `Aggregate.fromPrimitives()` and `aggregate.toPrimitives()`.
4. **Error Translation:** Catch Supabase/network errors inside the adapter and translate them into typed application errors (`NetworkError`, `NotFoundError`, `PermissionDeniedError`). Never leak raw Postgres errors to the UI.
5. **Security & Self-Hosted VPS Rules:**
   - Only use the `anon` key in the client. **Never** include `service_role` in the client or bundle.
   - Enable **Row Level Security (RLS)** on every table in `app_core` and version all schema changes and policies in `supabase/migrations/`.
   - Persist Auth sessions in Tauri's secure storage (keyring/secrets plugin), never in unencrypted `localStorage`.

---

## 2. Database Schema Map (`app_core`) & RLS Helper Functions

| Bounded Context | Prefix | Tables in `app_core` | Key Constraints & RLS Rules |
| :--- | :--- | :--- | :--- |
| **`iam`** | `iam_` | `iam_permissions`, `iam_roles`, `iam_role_permissions`, `iam_profiles` | `iam_profiles` syncs with `auth.users`. Roles with active users cannot be deleted (`ON DELETE RESTRICT`). Creating users requires `app_core.user_has_permission('USER_MANAGE')`. |
| **`commercial`** | `com_` | `com_clients`, `com_quote_templates`, `com_quotes`, `com_quote_requirements`, `com_quote_agreements`, `com_quote_attachments` | Solution types: `MOBILE`, `WEB`, `BACKEND`, `AUTOMATION`, `DESKTOP`, `OTHER`. Quote `ACCEPTED` requires both `dev_signature_path` and `client_signature_path`. |
| **`project-management`** | `prj_` | `prj_projects`, `prj_project_members`, `prj_timeline_milestones`, `prj_project_documents` | Created from `ACCEPTED` quote (`source_quote_id`). Document origins: `QUOTE_INHERITED`, `PROJECT_EXECUTION`. Assigning team requires `app_core.user_has_permission('PROJECT_ASSIGN_TEAM')`. `Desarrollador` only sees basic project info + `cover_image_path` where `app_core.is_project_member(id)`. |
| **`workboard`** | `wb_` | `wb_tasks`, `wb_task_attachments` | Statuses: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `BLOCKER` (requires `blocker_reason`). Priorities: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Attachments: `IMAGE`, `DOCUMENT`. Access gated by `app_core.is_project_member(project_id)`. |
| **`shared` (Outbox)** | `sys_` | `sys_domain_events` | Transactional Outbox storing `DomainEvent` records (`id`, `aggregate_id`, `bounded_context`, `event_name`, `payload`, `occurred_on`, `status`: `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`, `attempts`, `last_error`). |

### Centralized SQL Security Functions (`app_core`)
- **`app_core.user_has_permission(permiso text) returns boolean`**: Open Host Service function from `iam` used across RLS policies in all bounded contexts.
- **`app_core.is_project_member(project_id uuid) returns boolean`**: Published Language function verifying whether `auth.uid()` belongs to `app_core.prj_project_members` for the given project.

---

## 3. Step-by-Step Procedures

### Step 1: Create the Row ⇄ Domain Mapper (`infrastructure/mappers/`)

```ts
// src/modules/workboard/infrastructure/mappers/wb-task.mapper.ts
import { Task, type TaskPrimitives } from "@/modules/workboard/domain";

export type WbTaskRow = {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly blocker_reason: string | null;
};

export const wbTaskRowToDomain = (row: WbTaskRow): Task =>
  Task.fromPrimitives({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    blockerReason: row.blocker_reason,
  });

export const wbTaskDomainToRow = (task: Task): WbTaskRow => {
  const primitives: TaskPrimitives = task.toPrimitives();
  return {
    id: primitives.id,
    project_id: primitives.projectId,
    title: primitives.title,
    status: primitives.status,
    priority: primitives.priority,
    blocker_reason: primitives.blockerReason,
  };
};
```

### Step 2: Implement the Repository Port (`infrastructure/supabase/`)

Query the prefixed table in the `app_core` schema with explicit column projection and filters:

```ts
// src/modules/workboard/infrastructure/supabase/supabase-task.repository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskId, TaskRepository } from "@/modules/workboard/domain";
import { wbTaskDomainToRow, wbTaskRowToDomain, type WbTaskRow } from "../mappers/wb-task.mapper";

export const createSupabaseTaskRepository = (deps: {
  readonly client: SupabaseClient;
}): TaskRepository => ({
  save: async (task: Task): Promise<void> => {
    const row = wbTaskDomainToRow(task);
    const { error } = await deps.client.schema("app_core").from("wb_tasks").upsert(row);
    if (error !== null) {
      throw new Error(`Failed to save task: ${error.code}`);
    }
  },

  search: async (id: TaskId): Promise<Task | null> => {
    const { data, error } = await deps.client
      .schema("app_core")
      .from("wb_tasks")
      .select("id, project_id, title, status, priority, blocker_reason")
      .eq("id", id.value)
      .maybeSingle<WbTaskRow>();

    if (error !== null) {
      throw new Error(`Failed to search task: ${error.code}`);
    }

    return data !== null ? wbTaskRowToDomain(data) : null;
  },
});
```

### Step 3: Version Migrations & RLS in `supabase/migrations/`

Every migration must target `app_core`, use the context prefix (`iam_`, `com_`, `prj_`, `wb_`), enable RLS, and apply policies using `app_core.user_has_permission(...)` and/or `app_core.is_project_member(...)`.

---

## 4. Verification Checklist

- [ ] Is `@supabase/supabase-js` imported only inside `infrastructure/` and `src/app/`?
- [ ] Are all tables created and queried inside the `app_core` schema with their bounded context prefix (`iam_`, `com_`, `prj_`, `wb_`)?
- [ ] Do all foreign keys to users reference `app_core.iam_profiles(id)` instead of `auth.users(id)` (except `iam_profiles` itself)?
- [ ] Do all mappers use `Aggregate.fromPrimitives()` and `aggregate.toPrimitives()`?
- [ ] Does every table have RLS enabled and policies using `app_core.user_has_permission` or `app_core.is_project_member`?
