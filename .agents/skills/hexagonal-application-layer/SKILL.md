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
2. **Commands Only (No DTOs):** Input data transfer objects in the application layer are always called **`commands`**, live in `application/commands/`, and are implemented as **immutable classes** (`export class BlockTaskCommand`). The suffix `Dto` and folder `dto/` are strictly forbidden.
3. **Implemented with Classes (`class` & `interface`):** Like `domain` and `infrastructure`, the `application` layer is implemented with **classes**: Use Cases are classes (`export class BlockTaskUseCase`) with constructor dependency injection and a `public async execute(command: ...)` method, Commands are classes, and secondary ports (`application/ports/`) are `interface` (`export interface AuthService`). Arrow functions are reserved for the `presentation` (visual) layer and inline array callbacks. Never use the `function` keyword.
4. **No Domain Entities Cross the Application Boundary:**
   - **Inputs:** Use cases receive at most **one** Command class instance made of `readonly` primitives (`string`, `number`, `boolean`, `null`) and convert its fields into Domain Value Objects.
   - **Outputs:** Read use cases return typed primitives (e.g., `readonly QuotePrimitives[]`), never `AggregateRoot` or `Entity` instances.
5. **Composition Root Wiring:** Dependency injection (instantiating infrastructure adapter classes and injecting them into use case classes) happens exclusively in `src/app/`.

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

### Step 1: Define the Command Class (`application/commands/`)

- File naming: `<verb>-<object>.command.ts` (in `kebab-case`).
- Class naming: `<Verb><Object>Command` (in `PascalCase`, e.g., `BlockTaskCommand`, `AcceptQuoteCommand`).
- Properties must be `readonly` primitives (`string`, `number`, `boolean`, `null`).

```ts
// src/modules/workboard/application/commands/block-task.command.ts
export class BlockTaskCommand {
  public readonly taskId: string;
  public readonly blockerReason: string;

  public constructor(params: {
    readonly taskId: string;
    readonly blockerReason: string;
  }) {
    this.taskId = params.taskId;
    this.blockerReason = params.blockerReason;
  }
}
```

### Step 2: Implement the Use Case Class (`application/use-cases/`)

- File naming: `<verb>-<object>.use-case.ts`.
- Export a class named `<Verb><Object>UseCase` that receives its ports/repositories via constructor injection and exposes `public async execute(command: <Verb><Object>Command)`.

```ts
// src/modules/workboard/application/use-cases/block-task.use-case.ts
import {
  BlockerReason,
  TaskId,
  TaskNotFoundError,
  type TaskRepository,
} from "@/modules/workboard/domain";
import type { BlockTaskCommand } from "../commands";

export class BlockTaskUseCase {
  public constructor(private readonly tasks: TaskRepository) {}

  public async execute(command: BlockTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const reason = new BlockerReason(command.blockerReason);

    const task = await this.tasks.search(taskId);
    if (task === null) {
      throw new TaskNotFoundError(command.taskId);
    }

    task.markAsBlocker(reason);
    await this.tasks.save(task);
  }
}
```

### Step 3: Export from `application/index.ts` and Wire in `src/app/`

Expose command classes, port interfaces, and use case classes in `src/modules/<bounded-context>/application/index.ts`, and instantiate concrete adapter classes and use case classes only inside `src/app/container.ts`.

---

## 5. Verification Checklist

- [ ] Are all input commands implemented as classes in `application/commands/` and named `<Verb><Object>Command` (no `Dto` suffix)?
- [ ] Does each use case class accept at most one command of `readonly` primitives in `execute(command)`?
- [ ] Do read use cases return `<Aggregate>Primitives` via `.toPrimitives()` instead of domain objects?
- [ ] Are all use cases implemented as classes (`<Verb><Object>UseCase`) with constructor dependency injection?
- [ ] Are cross-context interactions respecting the Context Mapping boundaries without direct imports between bounded contexts?
