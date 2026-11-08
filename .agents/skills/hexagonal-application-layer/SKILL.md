---
name: hexagonal-application-layer
description: >-
  Guides the creation of use cases, commands, application ports, and dependency wiring
  in the composition root following Hexagonal Architecture (Ports & Adapters).
  Use this skill when creating or updating use cases, application commands,
  application ports, or wiring dependencies in src/app/.
---

# Hexagonal Application Layer & Commands

Use this skill when creating or modifying `src/modules/<bounded-context>/application/` or wiring dependencies in `src/app/` (the Composition Root).

## 1. Core Principles & Non-Negotiable Rules

1. **Dependency Direction:** `application` may ONLY import from `domain` (of the same bounded context) and `@/shared/kernel`. Never import `solid-js`, `@tauri-apps/*`, `@supabase/*`, `infrastructure`, or `presentation`.
2. **Commands Only (No DTOs):** Input data transfer objects in the application layer are always called **`commands`** and live in `application/commands/`. The suffix `Dto` and folder `dto/` are strictly forbidden.
3. **Arrow Functions Only:** Use cases, factories, and helpers must be written as arrow functions (`const myUseCase = (deps) => async (command) => ...`). Never use the `function` keyword.
4. **No Domain Entities Cross the Application Boundary:**
   - **Inputs:** Use cases receive at most **one** Command made of `readonly` primitives (`string`, `number`, `boolean`) and convert its fields into Domain Value Objects.
   - **Outputs:** Read use cases return typed primitives (e.g., `readonly TaskPrimitives[]`), never `AggregateRoot` or `Entity` instances.
5. **Composition Root Wiring:** Dependency injection (binding infrastructure adapters to domain/application ports) happens exclusively in `src/app/`.

---

## 2. Layer Isolation Matrix & Directory Structure

| Layer | Responsibility | Allowed Imports | Forbidden Imports |
|-------|----------------|-----------------|-------------------|
| `domain` | Entities, Value Objects, Aggregates, Domain Events, Domain Services, Repository interfaces | `domain` (same module), `@/shared/kernel` | `solid-js`, `@tauri-apps/*`, `@supabase/*`, `application`, `infrastructure`, `presentation`, other modules |
| `application` | Use cases, `commands`, secondary ports, orchestration | `domain` (same module), `@/shared/kernel` | `solid-js`, `@tauri-apps/*`, `@supabase/*`, `infrastructure`, `presentation`, other modules |
| `infrastructure` | Adapters implementing ports (Supabase, Tauri IPC, secure storage, mappers) | `domain`, `application`, external libraries | `presentation` |
| `presentation` | SolidJS Atomic Design (`atoms`, `molecules`, `organisms`, `templates`, `screens` with MVVM) | `application` (injected use cases & commands), `@/shared/ui`, read `Primitives` | `infrastructure`, domain classes/entities |

```text
src/
├── app/                              # Composition Root: instantiates adapters and injects them into use cases
└── modules/
    └── <bounded-context>/
        └── application/
            ├── commands/             # <verb>-<object>.command.ts
            ├── ports/                # Application-level ports (e.g., AuthService, EventBus)
            ├── use-cases/            # <verb>-<object>.use-case.ts
            └── index.ts              # Public API of the application layer
```

---

## 3. Step-by-Step Procedures

### Step 1: Define the Command (`application/commands/`)

- File naming: `<verb>-<object>.command.ts` (in `kebab-case`).
- Type naming: `<Verb><Object>Command` (in `PascalCase`, e.g., `CreateTaskCommand`, `CompleteTaskCommand`).
- Properties must be `readonly` primitives (`string`, `number`, `boolean`). Do not place validation logic here—validation belongs in Domain Value Objects.

```ts
// src/modules/tasks/application/commands/create-task.command.ts
export type CreateTaskCommand = {
  readonly title: string;
};
```

```ts
// src/modules/tasks/application/commands/complete-task.command.ts
export type CompleteTaskCommand = {
  readonly taskId: string;
};
```

### Step 2: Implement the Use Case (`application/use-cases/`)

- File naming: `<verb>-<object>.use-case.ts`.
- Export a higher-order arrow function that receives `deps` (ports/repositories) and returns an `async` arrow function accepting at most one `Command`.
- Generate IDs in the domain (`TaskId.random()`), reconstruct Value Objects (`new TaskTitle(command.title)`), invoke domain methods, persist via repository port, and publish domain events if needed (`task.pullDomainEvents()`).

#### Write Use Case Example (Create)

```ts
// src/modules/tasks/application/use-cases/create-task.use-case.ts
import { Task, TaskId, TaskTitle, type TaskRepository } from "@/modules/tasks/domain";
import type { CreateTaskCommand } from "../commands";

export const createTask =
  (deps: { readonly tasks: TaskRepository }) =>
  async (command: CreateTaskCommand): Promise<void> => {
    const id = TaskId.random();
    const title = new TaskTitle(command.title);
    const task = Task.create(id, title);

    await deps.tasks.save(task);
  };
```

#### Write Use Case Example (State Transition)

```ts
// src/modules/tasks/application/use-cases/complete-task.use-case.ts
import {
  TaskId,
  TaskNotFoundError,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CompleteTaskCommand } from "../commands";

export const completeTask =
  (deps: { readonly tasks: TaskRepository }) =>
  async (command: CompleteTaskCommand): Promise<void> => {
    const task = await deps.tasks.search(new TaskId(command.taskId));
    if (task === null) {
      throw new TaskNotFoundError(command.taskId);
    }

    task.complete();
    await deps.tasks.save(task);
  };
```

#### Read Use Case Example (Returning Primitives)

```ts
// src/modules/tasks/application/use-cases/list-tasks.use-case.ts
import type { TaskPrimitives, TaskRepository } from "@/modules/tasks/domain";

export const listTasks =
  (deps: { readonly tasks: TaskRepository }) =>
  async (): Promise<readonly TaskPrimitives[]> => {
    const tasks = await deps.tasks.searchAll();
    return tasks.map((task) => task.toPrimitives());
  };
```

### Step 3: Export from `application/index.ts`

```ts
// src/modules/tasks/application/index.ts
export type { CompleteTaskCommand, CreateTaskCommand } from "./commands";
export { completeTask, createTask, listTasks } from "./use-cases";
```

### Step 4: Wire Dependencies in `src/app/` (Composition Root)

Instantiate infrastructure adapters once in `src/app/` and inject them into the use case factories:

```ts
// src/app/container.ts
import { completeTask, createTask, listTasks } from "@/modules/tasks/application";
import { createSupabaseTaskRepository } from "@/modules/tasks/infrastructure";
import { supabaseClient } from "./supabase-client";

const taskRepository = createSupabaseTaskRepository({ client: supabaseClient });

export const tasksUseCases = {
  createTask: createTask({ tasks: taskRepository }),
  completeTask: completeTask({ tasks: taskRepository }),
  listTasks: listTasks({ tasks: taskRepository }),
} as const;
```

---

## 4. Verification Checklist

- [ ] Are all input types placed in `application/commands/` and named `<Verb><Object>Command` (no `Dto` suffix)?
- [ ] Does each use case accept at most one command of `readonly` primitives?
- [ ] Do read use cases return `<Aggregate>Primitives` via `.toPrimitives()` instead of domain objects?
- [ ] Are all use cases written as curried arrow functions (`(deps) => async (command) => ...`)?
- [ ] Can the use case run in pure Node with Vitest using an in-memory fake repository (no DOM, Tauri, or network)?
