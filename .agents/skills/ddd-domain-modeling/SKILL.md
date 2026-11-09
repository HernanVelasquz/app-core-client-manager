---
name: ddd-domain-modeling
description: >-
  Guides the creation and modification of Domain-Driven Design (DDD) building blocks
  in the domain layer and shared kernel across the 4 Bounded Contexts (iam, commercial,
  project-management, workboard), including Value Objects, Uuid entity IDs, Aggregate Roots,
  Ubiquitous Language, Domain Invariants, Domain Events, and Repository interfaces.
  Use this skill whenever designing or modifying domain logic, entities, value objects,
  aggregates, or repository ports.
---

# DDD Domain Modeling, Bounded Contexts & Value Objects

Use this skill when creating or modifying code inside `src/shared/kernel/` or `src/modules/{iam,commercial,project-management,workboard}/domain/`.

## 1. Core Principles & Non-Negotiable Rules

1. **Zero External Dependencies:** `domain` may ONLY import from within its own `domain` and `@/shared/kernel`. Never import `solid-js`, `@tauri-apps/*`, `@supabase/*`, `application`, `infrastructure`, `presentation`, or another bounded context.
2. **Object-Oriented Classes in `domain` & No `any`:** Never use `any` (explicit or implicit) or the `function` keyword. The `domain` layer ( along with `application` and `infrastructure`) is implemented strictly with **classes (`class` / `abstract class`)** and **interfaces (`interface`)** for repository ports (`export interface QuoteRepository`). Arrow functions are reserved for internal array callbacks (e.g. `.map((item) => ...)`), while the visual flow in `presentation` uses arrow functions.
3. **Everything in Aggregates is a Value Object Class:** Every entity/aggregate ID must extend `Uuid` (`export class ClientId extends Uuid {}`), and **every property inside an Aggregate or Entity must be an instance of a Value Object class** (`StringValueObject`, `NumberValueObject`, `BooleanValueObject`, `EnumValueObject`). Raw primitive properties (`string`, `number`, `boolean`) inside aggregates are strictly forbidden.
4. **All Business Logic Lives in `domain`:** Invariants, state transitions, and validations belong inside Value Objects, Entities, Aggregates, or Domain Services.
5. **Public API per Layer:** Expose all public domain contracts through `src/modules/<bounded-context>/domain/index.ts`.

---

## 2. Official Bounded Contexts, Ubiquitous Language & Domain Invariants

| Bounded Context | Module Path | DB Prefix (`app_core`) | Aggregate Roots | DDD Classification |
| :--- | :--- | :--- | :--- | :--- |
| **1. Identidad y Acceso (IAM)** | `src/modules/iam` | `iam_` | `Rol`, `PerfilUsuario` | Generic Subdomain |
| **2. Comercial y Cotizaciones** | `src/modules/commercial` | `com_` | `Cliente`, `PlantillaCotizacion`, `Cotizacion` | Core Domain |
| **3. Gestión de Proyectos** | `src/modules/project-management` | `prj_` | `Proyecto` | Core Domain |
| **4. Tablero de Trabajo (Kanban)** | `src/modules/workboard` | `wb_` | `Tarea` | Supporting Subdomain |

### 2.1 `iam` (Identidad y Acceso)
- **Ubiquitous Language:** `PerfilUsuario`, `RolDinamico`, `Permiso`, `AsignacionRol`.
- **Invariants & Boundaries:**
  - No other context references `auth.users` directly; all contexts reference the `iam_profiles` identifier (`ProfileId`).
  - Roles (`Administrador`, `Gerente`, `Líder`, `Desarrollador`, or newly created dynamic roles) are managed dynamically.
  - A role cannot be deleted if it has active users linked.
  - Only users with the `USER_MANAGE` permission can attach new users to the system.

### 2.2 `commercial` (Comercial y Cotizaciones)
- **Ubiquitous Language:** `Cliente`, `PlantillaCotizacion`, `Cotizacion`, `LevantamientoRequerimiento`, `AcuerdoComercial`, `FirmaDesarrollador`, `FirmaCliente`.
- **Invariants & Boundaries:**
  - Separates the quick client lookup model (name, phone, email) from the detailed view with quote history.
  - Classifies requirements by solution type (`MOBILE`, `WEB`, `BACKEND`, `AUTOMATION`, `DESKTOP`, `OTHER`).
  - Uses an editable base template to define quote-specific `acuerdos`, `objetivos`, and `entregables`.
  - **Double Signature Invariant:** A quote (`Cotizacion`) cannot transition to `ACCEPTED` unless its commercial agreement has both signatures registered (`dev_signature_path` and `client_signature_path`).

### 2.3 `project-management` (Gestión de Proyectos)
- **Ubiquitous Language:** `Proyecto`, `MiembroEquipo`, `HitoTimeline`, `DocumentoProyecto`.
- **Invariants & Boundaries:**
  - A `Proyecto` is created exclusively from a `Cotizacion` in `ACCEPTED` status (`source_quote_id`).
  - Inherits documents attached during the quote phase (`QUOTE_INHERITED`) and allows uploading new documents during execution (`PROJECT_EXECUTION`).
  - **Team Assignment Invariant:** Only users with the `PROJECT_ASSIGN_TEAM` permission can assign members to the project.
  - **Visibility Restriction:** The `Desarrollador` role can only view basic info and `cover_image_path` of projects where they are assigned in `prj_project_members`, without access to management documents or timeline milestones.

### 2.4 `workboard` (Tablero de Trabajo Kanban)
- **Ubiquitous Language:** `Tarea`, `EstadoTarea` (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `BLOCKER`), `PrioridadTarea` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `AdjuntoTarea` (`IMAGE`, `DOCUMENT`).
- **Invariants & Boundaries:**
  - Modeled as an independent `Tarea` aggregate separate from `Proyecto` to enable high concurrency when moving Kanban cards, changing priorities, and uploading evidence without locking the project record.
  - **Blocker Invariant:** If a task transitions to `BLOCKER` status, providing a non-empty `blocker_reason` is mandatory.
  - `Desarrollador` only views and interacts with the board and tasks of projects to which they are assigned.

---

## 3. Directory Structure

```text
src/
├── shared/
│   └── kernel/
│       ├── value-object/
│       │   ├── invalid-argument-error.ts
│       │   ├── value-object.ts
│       │   ├── string-value-object.ts
│       │   ├── number-value-object.ts
│       │   ├── enum-value-object.ts
│       │   ├── uuid.ts
│       │   └── index.ts
│       ├── domain-event.ts
│       ├── aggregate-root.ts
│       └── index.ts
└── modules/
    └── {iam,commercial,project-management,workboard}/
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

## 4. Step-by-Step Procedures

### Step 1: Create Value Objects (`domain/value-objects/`)

1. **IDs:** Extend `Uuid` from `@/shared/kernel`. Generate new IDs in the domain via `<Entity>Id.random()`.
   ```ts
   // src/modules/workboard/domain/value-objects/task-id.ts
   import { Uuid } from "@/shared/kernel";

   export class TaskId extends Uuid {}
   ```
2. **Strings & Numbers:** Extend `StringValueObject` or `NumberValueObject`. Validate invariants in the constructor and throw `InvalidArgumentError`.
   ```ts
   // src/modules/workboard/domain/value-objects/blocker-reason.ts
   import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

   export class BlockerReason extends StringValueObject {
     public constructor(value: string) {
       super(value);
       this.ensureIsNotEmpty(value);
     }

     private ensureIsNotEmpty(value: string): void {
       if (value.trim().length === 0) {
         throw new InvalidArgumentError("Blocker reason cannot be empty when task status is BLOCKER");
       }
     }
   }
   ```
3. **Enums:** Extend `EnumValueObject<T>`.
   ```ts
   // src/modules/workboard/domain/value-objects/task-status.ts
   import { EnumValueObject, InvalidArgumentError } from "@/shared/kernel";

   export enum TaskStatuses {
     Pending = "PENDING",
     InProgress = "IN_PROGRESS",
     Completed = "COMPLETED",
     Blocker = "BLOCKER",
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

### Step 2: Create Aggregates Enforcing Domain Invariants (`domain/aggregates/`)

1. Define an explicit `<Aggregate>Primitives` type using only primitive types (`string`, `number`, `boolean`, `null`) for boundary serialization.
2. Extend `AggregateRoot<<Aggregate>Primitives>`.
3. **Treat every attribute of the Aggregate as a Value Object class** (`Uuid`, `StringValueObject`, `NumberValueObject`, `BooleanValueObject`, `EnumValueObject`). Never store raw primitive fields on the aggregate class.
4. Enforce domain invariants inside domain methods (e.g., requiring `BlockerReason` when transitioning to `BLOCKER`, or requiring both developer and client signatures before marking a quote `ACCEPTED`).
5. Provide `static fromPrimitives(plain: <Aggregate>Primitives)` and `toPrimitives(): <Aggregate>Primitives`.

### Step 3: Define Repository Interfaces & Domain Errors

1. **Repositories (`domain/repositories/`):** Define ports as `interface` (`export interface QuoteRepository { ... }`), named by capability without an `I` prefix (`QuoteRepository`, `ProjectRepository`, `TaskRepository`).
2. **Domain Errors (`domain/errors/`):** Create explicit error classes (`extends Error`) for broken invariants (e.g., `MissingQuoteSignaturesError`, `MissingBlockerReasonError`).

---

## 5. Verification Checklist

- [ ] Does the model reside in one of the 4 official bounded contexts (`iam`, `commercial`, `project-management`, `workboard`) and use its Ubiquitous Language?
- [ ] Does every Value Object validate its input in the constructor and wrap a single `readonly value`?
- [ ] Do all entity/aggregate IDs extend `Uuid`?
- [ ] Does the Aggregate implement `create`, `fromPrimitives`, and `toPrimitives` and enforce its context invariants?
- [ ] Are there zero imports from `solid-js`, `@supabase/*`, `@tauri-apps/*`, `application`, `infrastructure`, `presentation`, or other bounded contexts?
