---
name: solidjs-atomic-mvvm-presentation
description: >-
  Guides the creation of UI components and screens in SolidJS and Tailwind CSS
  using Atomic Design (atoms, molecules, organisms, templates, screens) and the
  MVVM pattern (model, view-model, view). Use this skill whenever creating or
  modifying SolidJS components, screens, ViewModels, or Tailwind styles.
---

# SolidJS Presentation: Atomic Design, MVVM & Tailwind CSS

Use this skill when working in `src/shared/ui/` or `src/modules/{iam,commercial,project-management,workboard}/presentation/`.

## 1. Core Principles & Non-Negotiable Rules

1. **Arrow Functions Only & No `any`:** Every component, hook (`use<Screen>`), event handler, and helper must be an arrow function. Never use `any` or the `function` keyword.
2. **SolidJS Reactivity Rules:**
   - **Never destructure `props`** (it breaks SolidJS reactivity). Always access `props.x` or use `splitProps` / `mergeProps`.
   - Solid is **not React**: components execute only once. Never use React patterns (dependency arrays, `useEffect` for state synchronization).
   - Use `createMemo` for derived values.
   - Use `<Show>`, `<For>`, `<Switch>/<Match>`, and `<Index>` for control flow—never `.map()` or deeply nested ternaries in JSX.
   - Always register cleanup callbacks with `onCleanup` for listeners, timers, Realtime subscriptions, and Tauri events.
3. **Atomic Design (`screens` instead of `pages`):**
   - The word or folder `pages` is **strictly forbidden**. Always use `screens` (`presentation/screens/<screen-name>/`).
   - Strict upward import hierarchy: `atoms` → `molecules` → `organisms` → `templates` → `screens`. A lower level may never import from a higher level.
   - Generic, domain-agnostic components go in `src/shared/ui/{atoms,molecules,organisms,templates}`. Bounded-context components go in `src/modules/{iam,commercial,project-management,workboard}/presentation/{atoms,molecules,organisms,templates,screens}`.
4. **Strict MVVM & Role-Based UI Visibility in Every `screen`:**
   - Only a `screen`'s `viewModel` (`use<Screen>`) is allowed to consume injected use cases. `atoms`, `molecules`, `organisms`, `templates`, and `.view.tsx` files must **never** invoke use cases directly.
   - The UI sends `commands` to use cases and consumes typed primitives (`<Aggregate>Primitives`), never domain entities or Value Objects.
   - Respect domain visibility rules in presentation screens (e.g., in `project-management`, the `Desarrollador` role only views basic project info and `cover_image_path` without timeline milestones or management documents; in `commercial`, separate quick client lookup from detailed quote history).

---

## 2. Atomic Design Levels & Responsibilities

| Level | Folder | Responsibility | Allowed State & Dependencies |
|-------|--------|----------------|------------------------------|
| **Atoms** | `atoms/` | Minimal indivisible UI elements (`Button`, `Input`, `Badge`, `Icon`, `Label`). | Visual props and basic events only. Zero business state or use cases. |
| **Molecules** | `molecules/` | Simple combinations of atoms (`SearchField`, `FormField`, `AlertBanner`). | Purely presentational (props-driven). Composed of `atoms`. |
| **Organisms** | `organisms/` | Functional UI sections (`TaskCreateBar`, `TaskFilterTabs`, `TaskTable`). | May hold strictly local visual state (e.g., dropdown open/closed), but **never invokes use cases**. Receives data and callbacks via props. Composed of `atoms` and `molecules`. |
| **Templates** | `templates/` | Spatial layout structures (`TaskListTemplate`, `SplitPaneTemplate`). | Receives layout regions/slots (`JSX.Element` / `children`) via props. No real data or use cases. |
| **Screens** | `screens/` | Complete desktop screen (replaces `pages`). Connects a `template` and `organisms` to data and use cases via **MVVM**. | The **only** level authorized to consume use cases through its `viewModel`. |

---

## 3. Step-by-Step Procedure: Creating a Screen with MVVM

Every screen in `src/modules/<bounded-context>/presentation/screens/<screen-name>/` must contain exactly four files:

```text
presentation/screens/<screen-name>/
├── <screen-name>.model.ts       # 1. Model: UI types, filter types, ScreenProps, ViewModel contract
├── <screen-name>.view-model.ts  # 2. ViewModel: use<Screen> hook with reactive state & use cases
├── <screen-name>.view.tsx       # 3. View: declarative SolidJS component (<Screen>Screen)
└── index.ts                     # 4. Public barrel export
```

### Step 1: Create the Model (`<screen-name>.model.ts`)

- Contains **only type definitions** (`type`). No executable code, no domain classes, no entities.
- Can import primitive read types (`TaskPrimitives`) and command types from `domain`/`application`.
- Must define `<Screen>ViewModel` (using `Accessor<T>` from `solid-js`) and `<Screen>ScreenProps` (with an optional `readonly viewModel?: <Screen>ViewModel` for UI testing).

```ts
// src/modules/tasks/presentation/screens/task-list/task-list.model.ts
import type { Accessor } from "solid-js";
import type { TaskPrimitives } from "@/modules/tasks/domain";

export type TaskFilter = "all" | "pending" | "done";

export type TaskListViewModel = {
  readonly tasks: Accessor<readonly TaskPrimitives[]>;
  readonly isLoading: Accessor<boolean>;
  readonly errorMessage: Accessor<string | null>;
  readonly filter: Accessor<TaskFilter>;
  readonly draftTitle: Accessor<string>;
  readonly onFilterChange: (next: TaskFilter) => void;
  readonly onDraftTitleChange: (value: string) => void;
  readonly onCreateTask: () => Promise<void>;
  readonly onCompleteTask: (taskId: string) => Promise<void>;
};

export type TaskListScreenProps = {
  readonly viewModel?: TaskListViewModel;
};
```

### Step 2: Create the ViewModel (`<screen-name>.view-model.ts`)

- Implemented as an arrow function named `use<Screen>` (e.g., `useTaskList`).
- Obtains injected use cases from the module's presentation DI context (`useTasksUseCases()`).
- Declares SolidJS reactive primitives (`createSignal`, `createMemo`, `createResource`, `createStore`, `onCleanup`).
- Dispatches `commands` to use cases and translates caught errors into user-friendly strings.
- Returns an object matching `<Screen>ViewModel`. Never returns JSX or touches the DOM.

```ts
// src/modules/tasks/presentation/screens/task-list/task-list.view-model.ts
import { createMemo, createResource, createSignal } from "solid-js";
import { useTasksUseCases } from "@/modules/tasks/presentation/state";
import type { TaskFilter, TaskListViewModel } from "./task-list.model";

export const useTaskList = (): TaskListViewModel => {
  const useCases = useTasksUseCases();
  const [filter, setFilter] = createSignal<TaskFilter>("all");
  const [draftTitle, setDraftTitle] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const [rawTasks, { refetch }] = createResource(async () => useCases.listTasks());

  const tasks = createMemo(() => {
    const list = rawTasks() ?? [];
    const currentFilter = filter();
    if (currentFilter === "all") return list;
    return list.filter((task) => task.status === currentFilter);
  });

  const onCreateTask = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await useCases.createTask({ title: draftTitle() });
      setDraftTitle("");
      await refetch();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la tarea");
    }
  };

  const onCompleteTask = async (taskId: string): Promise<void> => {
    setErrorMessage(null);
    try {
      await useCases.completeTask({ taskId });
      await refetch();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo completar la tarea");
    }
  };

  return {
    tasks,
    isLoading: () => rawTasks.loading,
    errorMessage,
    filter,
    draftTitle,
    onFilterChange: setFilter,
    onDraftTitleChange: setDraftTitle,
    onCreateTask,
    onCompleteTask,
  };
};
```

### Step 3: Create the Declarative View (`<screen-name>.view.tsx`)

- Arrow function component named `<Screen>Screen` (e.g., `TaskListScreen`).
- Resolves the ViewModel via `const vm = props.viewModel ?? use<Screen>();` (never destructure `props`).
- Connects a `Template` and `Organisms`/`Molecules`/`Atoms` to `vm` accessors and handlers.
- Contains **zero** business signals, use case calls, or data transformation logic.

```tsx
// src/modules/tasks/presentation/screens/task-list/task-list.view.tsx
import { Show, type JSX } from "solid-js";
import { AlertBanner } from "@/shared/ui/molecules";
import { TaskListTemplate } from "@/modules/tasks/presentation/templates";
import { TaskCreateBar, TaskFilterTabs, TaskTable } from "@/modules/tasks/presentation/organisms";
import type { TaskListScreenProps } from "./task-list.model";
import { useTaskList } from "./task-list.view-model";

export const TaskListScreen = (props: TaskListScreenProps): JSX.Element => {
  const vm = props.viewModel ?? useTaskList();

  return (
    <TaskListTemplate
      header={
        <TaskCreateBar
          title={vm.draftTitle()}
          onTitleChange={vm.onDraftTitleChange}
          onSubmit={vm.onCreateTask}
        />
      }
      filters={
        <TaskFilterTabs
          selected={vm.filter()}
          onSelect={vm.onFilterChange}
        />
      }
      content={
        <>
          <Show when={vm.errorMessage()}>
            {(message) => <AlertBanner message={message()} />}
          </Show>
          <TaskTable
            tasks={vm.tasks()}
            isLoading={vm.isLoading()}
            onComplete={vm.onCompleteTask}
          />
        </>
      }
    />
  );
};
```

### Step 4: Create the Barrel Export (`index.ts`)

```ts
// src/modules/tasks/presentation/screens/task-list/index.ts
export { TaskListScreen } from "./task-list.view";
export { useTaskList } from "./task-list.view-model";
export type { TaskFilter, TaskListScreenProps, TaskListViewModel } from "./task-list.model";
```

---

## 4. Tailwind CSS Guidelines

1. Use utility classes and theme design tokens (colors, spacing, typography). Avoid arbitrary values (`w-[137px]`) unless justified.
2. Extract repeated UI patterns into SolidJS Atomic Design components rather than using `@apply`.
3. Compose conditional classes with `cn` / `clsx` instead of string concatenation.
4. Support light/dark mode using `dark:` variants and theme tokens.
5. Ensure accessibility: proper color contrast, `focus-visible` rings, and full keyboard navigation.

---

## 5. Verification Checklist

- [ ] Are `props` never destructured in any SolidJS component?
- [ ] Are lists and conditions using `<For>`, `<Show>`, `<Switch>/<Match>` instead of `.map()`?
- [ ] Is the folder named `screens/` (never `pages/`) and does each screen have `.model.ts`, `.view-model.ts`, `.view.tsx`, and `index.ts`?
- [ ] Is `use<Screen>` in `.view-model.ts` the ONLY place calling use cases?
- [ ] Is the upward Atomic Design import hierarchy (`atoms` → `molecules` → `organisms` → `templates` → `screens`) respected?

