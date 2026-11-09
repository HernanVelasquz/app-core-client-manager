---
name: testing-and-quality-standards
description: >-
  Guides testing strategies across Domain, Application, Infrastructure, and
  Presentation (ViewModel & View), enforces TypeScript/ESLint/Rust quality rules,
  Conventional Commits, and PR checklists. Use this skill when writing tests,
  configuring linters, reviewing code quality, or committing changes.
---

# Testing, Code Quality & Workflow Standards

Use this skill whenever writing tests, validating code quality, or preparing commits/PRs.

## 1. Implementation Order & AI Workflow

Always follow this implementation order for any feature or bugfix:
1. **Identify Bounded Context & Layer:** Locate existing Value Objects, ports, or use cases before creating new ones. Ask the user if requirements or domain rules are ambiguous.
2. **Order of Implementation:**
   `domain (+ unit tests)` → `application (+ unit tests with in-memory fakes)` → `infrastructure (+ integration tests)` → `presentation (ViewModel + View tests)`.
3. **Final Verification:** Run lint, type-check, and tests across both TypeScript and Rust before concluding any task.

---

## 2. Testing Strategy by Layer

| Layer | What to Test | Tools & Approach |
|-------|--------------|------------------|
| **Domain** | Entities, Value Objects, Aggregates, Domain Services | **Vitest** (pure Node, zero framework mocks, zero network). Every Value Object must test: (1) valid creation, (2) rejection of invalid values (`InvalidArgumentError`), (3) equality by value and type (`equals`), and (4) immutability. |
| **Application** | Use cases & command orchestration | **Vitest** using **in-memory fake repositories** (`InMemory<Entity>Repository`) instead of complex mocking libraries. |
| **Infrastructure** | Supabase / Tauri adapters & mappers | **Vitest** / **`cargo test`** against local instances or contract tests for mappers (`row ⇄ aggregate`). |
| **Presentation** | `use<Screen>` (`viewModel`) reactive state & `<Screen>Screen` / organisms (`view`) | **Vitest + `@solidjs/testing-library`**. Test `view` components by passing a fake `viewModel` via `props.viewModel`. |
| **E2E** | Critical desktop flows | **WebDriver / Playwright**. |

### Example: Value Object & Use Case Tests with In-Memory Fake

```ts
// src/modules/tasks/domain/value-objects/__tests__/task-title.test.ts
import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "@/shared/kernel";
import { TaskTitle } from "../task-title";

describe("TaskTitle", () => {
  it("debería crear un título válido", () => {
    const title = new TaskTitle("Revisar contrato");
    expect(title.value).toBe("Revisar contrato");
  });

  it("debería rechazar un título vacío", () => {
    expect(() => new TaskTitle("")).toThrow(InvalidArgumentError);
  });

  it("debería comparar igualdad por valor y tipo", () => {
    const a = new TaskTitle("Tarea A");
    const b = new TaskTitle("Tarea A");
    expect(a.equals(b)).toBe(true);
  });
});
```

```ts
// src/modules/tasks/application/use-cases/__tests__/create-task.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { Task, TaskId, TaskRepository } from "@/modules/tasks/domain";
import { createTask } from "../create-task.use-case";

const createInMemoryTaskRepository = (): TaskRepository & {
  readonly items: Task[];
} => {
  const items: Task[] = [];
  return {
    items,
    save: async (task: Task): Promise<void> => {
      const index = items.findIndex((item) => item.id.equals(task.id));
      if (index >= 0) {
        items[index] = task;
      } else {
        items.push(task);
      }
    },
    search: async (id: TaskId): Promise<Task | null> =>
      items.find((item) => item.id.equals(id)) ?? null,
    searchAll: async (): Promise<readonly Task[]> => items,
  };
};

describe("createTask use case", () => {
  it("debería crear y persistir una tarea pendiente", async () => {
    const repository = createInMemoryTaskRepository();
    const execute = createTask({ tasks: repository });

    await execute({ title: "Enviar propuesta" });

    expect(repository.items).toHaveLength(1);
    expect(repository.items[0]?.toPrimitives().title).toBe("Enviar propuesta");
    expect(repository.items[0]?.toPrimitives().status).toBe("pending");
  });
});
```

---

## 3. Naming & Coding Conventions

- **Files (`kebab-case`):**
  - Use cases: `create-task.use-case.ts`
  - Commands: `create-task.command.ts`
  - Value Objects: `task-id.ts`, `task-title.ts`
  - Repositories: `task.repository.ts` (port), `supabase-task.repository.ts` (adapter)
  - Screens (MVVM): `task-list.model.ts`, `task-list.view-model.ts`, `task-list.view.tsx`, `index.ts`
- **Identifiers:**
  - Components, Value Objects, Entities, Aggregates: `PascalCase` (`TaskListScreen`, `TaskId`).
  - Screen ViewModel hooks: `use<Screen>` in `camelCase` (`useTaskList`).
  - Ports: capability name without `I` prefix (`TaskRepository`, `AuthService`).
  - Domain Events: past tense (`TaskCreated`, `TaskCompleted`).
- **Imports:** Always use path aliases (`@/modules/...`, `@/shared/...`), never relative parent climbs (`../../../`). Never import across bounded contexts directly, and never bypass a layer's `index.ts`.
- **Strict TypeScript & Lint Rules:**
  - `strict: true`, `noImplicitAny: true`, `useUnknownInCatchVariables: true`.
  - Forbidden: `any`, `@ts-ignore`, `as any`, `function` keyword (use arrow functions everywhere except class methods), empty `catch {}` blocks, `console.log`, dead code, or untracked `TODO`s.
  - Minimum ESLint configuration:
    ```jsonc
    {
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": "error",
      "no-restricted-syntax": [
        "error",
        { "selector": "FunctionDeclaration", "message": "Usa funciones de flecha." },
        { "selector": ":not(MethodDefinition) > FunctionExpression", "message": "Usa funciones de flecha." }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error"
    }
    ```

---

## 4. Git & PR Checklist

### Conventional Commits & Branches
- **Commits:** Use `<type>(<bounded-context>): <description>` where `<bounded-context>` is one of `iam`, `commercial`, `project-management`, `workboard` (or `shared` / `app` for transversal changes), e.g.:
  - `feat(commercial): exige doble firma antes de aceptar cotizacion`
  - `feat(workboard): valida razon de bloqueo al pasar tarea a BLOCKER`
  - `feat(project-management): crea proyecto desde cotizacion aceptada`
  - `feat(iam): restringe eliminacion de roles con usuarios activos`
- **Branches:** `feat/...`, `fix/...`, `refactor/...`, `chore/...`.

### Pre-PR Verification Checklist
- [ ] Layer dependency direction is respected (`presentation` / `infrastructure` → `application` → `domain`)
- [ ] All business logic resides in `domain`
- [ ] Entity IDs are Value Objects extending `Uuid`
- [ ] Zero `any` and zero `function` keyword declarations/expressions
- [ ] UI follows Atomic Design (`atoms`, `molecules`, `organisms`, `templates`, `screens`) and MVVM (`model`, `view`, `viewModel` with `use<Screen>`)
- [ ] Supabase and Tauri imports only appear in `infrastructure` (and `src/app/`)
- [ ] Unit/integration tests added and passing
- [ ] Lint, format, and type-check pass cleanly in both TypeScript and Rust
- [ ] RLS policies and Tauri capabilities reviewed

