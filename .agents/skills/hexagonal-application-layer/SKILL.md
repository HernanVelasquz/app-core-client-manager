---
name: hexagonal-application-layer
description: >-
  Guides the creation of use cases, commands, application ports, Context Mapping
  integration across the 4 bounded contexts (iam, commercial, project-management,
  workboard), and dependency wiring in src/app/ following Hexagonal Architecture.
  Use this skill when creating or updating use cases, application commands,
  application ports, or wiring dependencies in src/app/.
---

# Hexagonal Application Layer, Commands & Context Mapping

Use this skill when creating or modifying `src/modules/{iam,commercial,project-management,workboard}/application/` or wiring dependencies in `src/app/` (the Composition Root).

## 1. Core Principles & Non-Negotiable Rules

1. **Dependency Direction:** `application` may ONLY import from `domain` (of the same bounded context) and `@/shared/kernel`. Never import `solid-js`, `@tauri-apps/*`, `@supabase/*`, `infrastructure`, `presentation`, or another bounded context directly.
2. **Commands Only (No DTOs):** Input data transfer objects in the application layer are always called **`commands`** and live in `application/commands/`. The suffix `Dto` and folder `dto/` are strictly forbidden.
3. **Arrow Functions Only:** Use cases, factories, and helpers must be written as arrow functions (`const myUseCase = (deps) => async (command) => ...`). Never use the `function` keyword.
4. **No Domain Entities Cross the Application Boundary:**
   - **Inputs:** Use cases receive at most **one** Command made of `readonly` primitives (`string`, `number`, `boolean`) and convert its fields into Domain Value Objects.
   - **Outputs:** Read use cases return typed primitives (e.g., `readonly QuotePrimitives[]`), never `AggregateRoot` or `Entity` instances.
5. **Composition Root Wiring:** Dependency injection (binding infrastructure adapters to domain/application ports and orchestrating cross-context workflows) happens exclusively in `src/app/`.

---

## 2. Context Mapping & Cross-Context Integration Rules

Bounded contexts **never** import directly from one another. Cross-context collaboration follows these 3 Context Mapping patterns:

1. **`iam` → All Contexts (*Open Host Service*):**
   - All contexts validate execution and visibility permissions (such as `USER_MANAGE` in `iam` or `PROJECT_ASSIGN_TEAM` in `project-management`) through an application permission port or the centralized DB policy function `app_core.user_has_permission(permiso)`.
   - All user references across `commercial`, `project-management`, and `workboard` use the `iam_profiles` identifier, never `auth.users` directly.
2. **`commercial` → `project-management` (*Customer-Supplier*):**
   - Once a `Cotizacion` in `commercial` has both signatures (`dev_signature_path` and `client_signature_path`) and transitions to `ACCEPTED`, it enables creating a `Proyecto` in `project-management` referencing `source_quote_id`, transferring base project data and copying initial quote attachments as `QUOTE_INHERITED` into `prj_project_documents`.
3. **`project-management` → `workboard` (*Published Language*):**
   - `workboard` verifies project membership (via port or `app_core.is_project_member(project_id)`) before allowing reading or modifying Kanban tasks (`wb_tasks`).

---

## 3. Layer Isolation Matrix & Directory Structure

| Layer | Responsibility | Allowed Imports | Forbidden Imports |
|-------|----------------|-----------------|-------------------|
| `domain` | Entities, Value Objects, Aggregates, Domain Events, Domain Services, Repository interfaces | `domain` (same module), `@/shared/kernel` | `solid-js`, `@tauri-apps/*`, `@supabase/*`, `application`, `infrastructure`, `presentation`, other modules |
| `application` | Use cases, `commands`, secondary ports, orchestration | `domain` (same module), `@/shared/kernel` | `solid-js`, `@tauri-apps/*`, `@supabase/*`, `infrastructure`, `presentation`, other modules |
| `infrastructure` | Adapters implementing ports (Supabase, Tauri IPC, secure storage, mappers) | `domain`, `application`, `@/shared/infrastructure`, external libraries | `presentation` |
| `presentation` | SolidJS Atomic Design (`atoms`, `molecules`, `organisms`, `templates`, `screens` with MVVM) | `application` (injected use cases & commands), `@/shared/ui`, read `Primitives` | `infrastructure`, domain classes/entities |

```text
src/
├── app/                              # Composition Root: instantiates adapters and injects them into use cases
└── modules/
    └── {iam,commercial,project-management,workboard}/
        └── application/
            ├── commands/             # <verb>-<object>.command.ts
            ├── ports/                # Application-level ports (e.g., AuthService, PermissionCheckerPort)
            ├── use-cases/            # <verb>-<object>.use-case.ts
            └── index.ts              # Public API of the application layer
```

---

## 4. Step-by-Step Procedures

### Step 1: Define the Command (`application/commands/`)

- File naming: `<verb>-<object>.command.ts` (in `kebab-case`).
- Type naming: `<Verb><Object>Command` (in `PascalCase`, e.g., `BlockTaskCommand`, `AcceptQuoteCommand`).
- Properties must be `readonly` primitives (`string`, `number`, `boolean`, `null`).

```ts
// src/modules/workboard/application/commands/block-task.command.ts
export type BlockTaskCommand = {
  readonly taskId: string;
  readonly blockerReason: string;
};
```

### Step 2: Implement the Use Case (`application/use-cases/`)

- File naming: `<verb>-<object>.use-case.ts`.
- Export a higher-order arrow function that receives `deps` (ports/repositories) and returns an `async` arrow function accepting at most one `Command`.

```ts
// src/modules/workboard/application/use-cases/block-task.use-case.ts
import {
  BlockerReason,
  TaskId,
  TaskNotFoundError,
  type TaskRepository,
} from "@/modules/workboard/domain";
import type { BlockTaskCommand } from "../commands";

export const blockTask =
  (deps: { readonly tasks: TaskRepository }) =>
  async (command: BlockTaskCommand): Promise<void> => {
    const taskId = new TaskId(command.taskId);
    const reason = new BlockerReason(command.blockerReason);

    const task = await deps.tasks.search(taskId);
    if (task === null) {
      throw new TaskNotFoundError(command.taskId);
    }

    task.markAsBlocker(reason);
    await deps.tasks.save(task);
  };
```

### Step 3: Export from `application/index.ts` and Wire in `src/app/`

Expose commands, ports, and use cases in `src/modules/<bounded-context>/application/index.ts`, and wire concrete adapters only inside `src/app/container.ts`.

---

## 5. Verification Checklist

- [ ] Are all input types placed in `application/commands/` and named `<Verb><Object>Command` (no `Dto` suffix)?
- [ ] Does each use case accept at most one command of `readonly` primitives?
- [ ] Do read use cases return `<Aggregate>Primitives` via `.toPrimitives()` instead of domain objects?
- [ ] Are all use cases written as curried arrow functions (`(deps) => async (command) => ...`)?
- [ ] Are cross-context interactions respecting the Context Mapping boundaries without direct imports between bounded contexts?
