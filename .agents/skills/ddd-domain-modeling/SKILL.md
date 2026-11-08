---
name: ddd-domain-modeling
description: >-
  Guides the creation and modification of Domain-Driven Design (DDD) building blocks
  in the domain layer and shared kernel, including Value Objects, Uuid entity IDs,
  Aggregate Roots, Domain Events, Domain Errors, and Repository interfaces.
  Use this skill whenever designing or modifying domain logic, entities, value objects,
  aggregates, or repository ports.
---

# DDD Domain Modeling & Value Objects

Use this skill when creating or modifying code inside `src/shared/kernel/` or `src/modules/<bounded-context>/domain/`.

## 1. Core Principles & Non-Negotiable Rules

1. **Zero External Dependencies:** `domain` may ONLY import from within its own `domain` and `@/shared/kernel`. Never import `solid-js`, `@tauri-apps/*`, `@supabase/*`, `application`, `infrastructure`, or `presentation`.
2. **No `any` & Arrow Functions Only:** Never use `any` (explicit or implicit). Use arrow functions everywhere; the **only** exception is class members (constructors, methods, `abstract` methods, `static` methods) required by Value Objects, Entities, Aggregates, and Domain Events.
3. **Entity IDs are `Uuid` Value Objects:** Every entity/aggregate ID must extend `Uuid` (e.g., `export class TaskId extends Uuid {}`). Raw `string` IDs are strictly forbidden inside the domain.
4. **All Business Logic Lives in `domain`:** Invariants, state transitions, and validations belong inside Value Objects, Entities, Aggregates, or Domain Services.
5. **Public API per Layer:** Expose all public domain contracts through `src/modules/<bounded-context>/domain/index.ts`.

---

## 2. Directory Structure

```text
src/
├── shared/
│   └── kernel/
│       └── value-object/
│           ├── invalid-argument-error.ts
│           ├── value-object.ts
│           ├── string-value-object.ts
│           ├── number-value-object.ts
│           ├── enum-value-object.ts
│           ├── uuid.ts
│           ├── domain-event.ts
│           ├── aggregate-root.ts
│           └── index.ts
└── modules/
    └── <bounded-context>/
        └── domain/
            ├── value-objects/
            ├── entities/
            ├── aggregates/
            ├── events/
            ├── services/
            ├── errors/
            ├── repositories/
            └── index.ts
```

---

## 3. Step-by-Step Procedures

### Step 1: Ensure Shared Kernel Base Classes Exist

Before creating domain models, verify that `src/shared/kernel/value-object/` provides the base abstract classes. Only `src/shared/kernel/value-object/uuid.ts` is permitted to import the `uuid` package.

```ts
// src/shared/kernel/value-object/invalid-argument-error.ts
export class InvalidArgumentError extends Error {}
```

```ts
// src/shared/kernel/value-object/value-object.ts
import { InvalidArgumentError } from "./invalid-argument-error";

export type Primitives = string | number | boolean | Date;

export abstract class ValueObject<T extends Primitives> {
  public readonly value: T;

  public constructor(value: T) {
    this.value = value;
    this.ensureValueIsDefined(value);
  }

  private ensureValueIsDefined(value: T): void {
    if (value === null || value === undefined) {
      throw new InvalidArgumentError("Value must be defined");
    }
  }

  public equals(other: ValueObject<T>): boolean {
    if (other.constructor !== this.constructor) return false;
    return this.value instanceof Date && other.value instanceof Date
      ? this.value.getTime() === other.value.getTime()
      : this.value === other.value;
  }

  public toString(): string {
    return this.value.toString();
  }
}
```

```ts
// src/shared/kernel/value-object/uuid.ts
import { v4, validate } from "uuid";
import { InvalidArgumentError } from "./invalid-argument-error";
import { ValueObject } from "./value-object";

export abstract class Uuid extends ValueObject<string> {
  public constructor(value: string) {
    super(value);
    this.ensureIsValidUuid(value);
  }

  public static random<T extends Uuid>(this: new (value: string) => T): T {
    return new this(v4());
  }

  private ensureIsValidUuid(id: string): void {
    if (!validate(id)) {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow the value <${id}>`,
      );
    }
  }
}
```

```ts
// src/shared/kernel/value-object/aggregate-root.ts
import type { DomainEvent } from "./domain-event";

export abstract class AggregateRoot<TPrimitives extends object> {
  private domainEvents: DomainEvent[] = [];

  public pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents.slice();
    this.domainEvents = [];
    return events;
  }

  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public abstract toPrimitives(): TPrimitives;
}
```

### Step 2: Create Value Objects (`domain/value-objects/`)

1. **IDs:** Extend `Uuid`. Generate new IDs in the domain via `<Entity>Id.random()`.
   ```ts
   // modules/<context>/domain/value-objects/task-id.ts
   import { Uuid } from "@/shared/kernel";

   export class TaskId extends Uuid {}
   ```
2. **Strings & Numbers:** Extend `StringValueObject` or `NumberValueObject`. Validate invariants in the constructor and throw `InvalidArgumentError` (or a specific domain error) if invalid.
   ```ts
   // modules/<context>/domain/value-objects/task-title.ts
   import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

   export class TaskTitle extends StringValueObject {
     public constructor(value: string) {
       super(value);
       this.ensureLengthIsLessThan120Characters(value);
     }

     private ensureLengthIsLessThan120Characters(value: string): void {
       if (value.length === 0 || value.length > 120) {
         throw new InvalidArgumentError(`The task title <${value}> is invalid`);
       }
     }
   }
   ```
3. **Enums:** Extend `EnumValueObject<T>`.
   ```ts
   // modules/<context>/domain/value-objects/task-status.ts
   import { EnumValueObject, InvalidArgumentError } from "@/shared/kernel";

   export enum TaskStatuses {
     Pending = "pending",
     Done = "done",
   }

   export class TaskStatus extends EnumValueObject<TaskStatuses> {
     public constructor(value: TaskStatuses) {
       super(value, Object.values(TaskStatuses));
     }

     protected throwErrorForInvalidValue(value: TaskStatuses): void {
       throw new InvalidArgumentError(`The task status <${value}> is invalid`);
     }
   }
   ```

### Step 3: Create Aggregates (`domain/aggregates/`)

1. Define an explicit `<Aggregate>Primitives` type using only primitive types (`string`, `number`, `boolean`).
2. Extend `AggregateRoot<<Aggregate>Primitives>`.
3. Provide a static `create(...)` factory method that initializes default state and records creation domain events via `this.record(...)`.
4. Provide `static fromPrimitives(plain: <Aggregate>Primitives)` and `toPrimitives(): <Aggregate>Primitives` so infrastructure mappers never touch private fields.

```ts
// modules/tasks/domain/aggregates/task.ts
import { AggregateRoot } from "@/shared/kernel";
import { TaskCompleted, TaskCreated } from "../events";
import { TaskId, TaskStatus, TaskStatuses, TaskTitle } from "../value-objects";

export type TaskPrimitives = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
};

export class Task extends AggregateRoot<TaskPrimitives> {
  public constructor(
    public readonly id: TaskId,
    public readonly title: TaskTitle,
    private status: TaskStatus,
  ) {
    super();
  }

  public static create(id: TaskId, title: TaskTitle): Task {
    const task = new Task(id, title, new TaskStatus(TaskStatuses.Pending));
    task.record(new TaskCreated(id.value, title.value));
    return task;
  }

  public static fromPrimitives(plain: TaskPrimitives): Task {
    return new Task(
      new TaskId(plain.id),
      new TaskTitle(plain.title),
      new TaskStatus(plain.status as TaskStatuses),
    );
  }

  public complete(): void {
    this.status = new TaskStatus(TaskStatuses.Done);
    this.record(new TaskCompleted(this.id.value));
  }

  public toPrimitives(): TaskPrimitives {
    return {
      id: this.id.value,
      title: this.title.value,
      status: this.status.value,
    };
  }
}
```

### Step 4: Define Repository Interfaces & Domain Errors

1. **Repositories (`domain/repositories/`):** Name ports by capability without an `I` prefix (`TaskRepository`, not `ITaskRepository`). Accept and return domain Value Objects and Aggregates.
   ```ts
   // modules/tasks/domain/repositories/task.repository.ts
   import type { Task } from "../aggregates";
   import type { TaskId } from "../value-objects";

   export type TaskRepository = {
     readonly save: (task: Task) => Promise<void>;
     readonly search: (id: TaskId) => Promise<Task | null>;
     readonly searchAll: () => Promise<readonly Task[]>;
   };
   ```
2. **Domain Errors (`domain/errors/`):** Create explicit error classes for broken invariants or missing domain entities (e.g., `TaskNotFoundError`).

---

## 4. Verification Checklist

- [ ] Does every Value Object validate its input in the constructor and wrap a single `readonly value`?
- [ ] Do all entity/aggregate IDs extend `Uuid`?
- [ ] Does the Aggregate implement `create`, `fromPrimitives`, and `toPrimitives`?
- [ ] Are there zero imports from `solid-js`, `@supabase/*`, `@tauri-apps/*`, `application`, `infrastructure`, or `presentation`?
- [ ] Are unit tests written for every Value Object (valid creation, invalid rejection, value/type equality, immutability) and Aggregate behavior?

