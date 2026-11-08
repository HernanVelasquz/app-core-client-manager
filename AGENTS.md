# AGENTS.md — Reglas de trabajo del proyecto

Este documento define cómo se trabaja en este repositorio. Toda persona o agente de IA que modifique el código debe seguirlo. Si una regla entra en conflicto con una petición, **señala el conflicto antes de actuar**.

## 1. Contexto

App de escritorio construida con:

- **Frontend:** SolidJS + TypeScript (strict)
- **Shell/nativo:** Tauri 2.x (Rust)
- **Estilos:** Tailwind CSS
- **Backend de datos:** Supabase autoalojado en un VPS (Postgres, Auth, Realtime, Storage)
- **Arquitectura:** Hexagonal (Ports & Adapters) + Domain-Driven Design (DDD)
- **Arquitectura de UI (`presentation`):** Atomic Design (`atoms`, `molecules`, `organisms`, `templates`, `screens`) + patrón **MVVM** (`model`, `view`, `viewModel`) en cada `screen`
- **Patrón táctico central:** Value Objects con clases base abstractas

Principio rector: **el dominio no sabe nada de SolidJS, Tauri, Supabase, el DOM ni el sistema de archivos.** Cada capa contiene únicamente la lógica que le corresponde y nada más.

---

## 2. Reglas absolutas (no negociables)

1. **Prohibido `any`**, explícito o implícito. Usa `unknown` y estrecha el tipo, genéricos o tipos específicos.
2. **Obligatorio usar funciones de flecha.** Prohibida la palabra clave `function` (declaraciones y expresiones).
3. **Los ids de entidades son Value Objects** que extienden de la clase abstracta `Uuid`. Prohibido usar `string` crudo como id en el dominio.
4. **La regla de dependencia apunta siempre hacia el dominio.**
5. **Sin lógica de negocio fuera de `domain`.**

### 2.1 Regla de funciones de flecha

```ts
// ✅ Correcto
export const calculateTotal = (items: readonly Item[]): Money => { /* ... */ };
const handleClick = (): void => { /* ... */ };
items.map((item) => item.price);

// ❌ Incorrecto
export function calculateTotal(items: Item[]): Money { /* ... */ }
const handler = function () { /* ... */ };
```

- Casos de uso, servicios, adaptadores funcionales, factories, handlers y callbacks: **siempre flecha**.
- Componentes SolidJS: `export const TaskList = (props: TaskListProps): JSX.Element => { ... }`.
- **Única excepción:** los *miembros de una clase* (métodos, constructores, métodos abstractos, `static`). La sintaxis de método es necesaria para `abstract`, `super.metodo()`, herencia por prototipo y para no crear una función por instancia. Para todo lo demás se usan flechas. Si algo puede ser una función flecha en lugar de una clase, **prefiere la flecha**.
- Los métodos auxiliares de utilería (fuera de clases) son siempre `const nombre = () => {}`.

Cumplimiento por lint (ver sección 9):

```jsonc
// eslint: reglas mínimas
{
  "func-style": ["error", "expression"],
  "prefer-arrow-callback": "error",
  "no-restricted-syntax": [
    "error",
    { "selector": "FunctionDeclaration", "message": "Usa funciones de flecha." },
    { "selector": "FunctionExpression", "message": "Usa funciones de flecha." }
  ]
}
```

> Nota: `FunctionExpression` también captura los métodos de clase en algunos parsers. Si el lint los marca, limita ese selector a `:not(MethodDefinition > FunctionExpression)`.

### 2.2 Regla de `any`

- `"@typescript-eslint/no-explicit-any": "error"`
- `"@typescript-eslint/no-unsafe-assignment" | "no-unsafe-call" | "no-unsafe-member-access" | "no-unsafe-return": "error"`
- `tsconfig`: `"strict": true`, `"noImplicitAny": true`, `"useUnknownInCatchVariables": true`.
- Para datos externos (respuestas de Supabase, IPC de Tauri, JSON) valida/estrecha en el adaptador antes de que crucen a `application`/`domain`.
- Prohibidos `@ts-ignore` y `as any`. Si es inevitable, usa `@ts-expect-error` con comentario explicando el motivo y enlaza una issue.

---

## 3. Arquitectura

### 3.1 Capas y aislamiento

```
presentation ─┐
              ├──▶ application ──▶ domain
infrastructure┘
```

| Capa | Responsabilidad (y solo esa) | Puede importar de | NO puede importar de |
|------|------------------------------|-------------------|----------------------|
| `domain` | Entidades, Value Objects, Agregados, eventos de dominio, servicios de dominio, **interfaces** de repositorio | `domain`, `shared/kernel` | `solid-js`, `@tauri-apps/*`, `@supabase/*`, `application`, `infrastructure`, `presentation` |
| `application` | Casos de uso, **commands**, puertos adicionales, orquestación | `domain`, `shared/kernel` | `solid-js`, `@tauri-apps/*`, `@supabase/*`, `infrastructure`, `presentation` |
| `infrastructure` | Adaptadores que **implementan** puertos: Supabase, Tauri IPC, almacenamiento seguro, mappers | `domain`, `application`, librerías externas | `presentation` |
| `presentation` | Componentes SolidJS bajo **Atomic Design** (`atoms`, `molecules`, `organisms`, `templates`), pantallas (`screens` con **MVVM**: `model`, `view`, `viewModel`), estado de UI | `application` (casos de uso inyectados), `shared/ui`, tipos primitivos de lectura | `infrastructure` |

Reglas de aislamiento:

- **Cada capa contiene solo la lógica que le corresponde.** No se duplica lógica entre capas ni se agregan utilidades "por si acaso" (YAGNI).
- Cada módulo expone una **API pública** mediante `index.ts` por capa. Nada se importa saltándose ese `index.ts` desde otro módulo.
- El cableado de dependencias (qué adaptador implementa qué puerto) ocurre **únicamente en `src/app/` (composition root)**.
- `domain` y `application` deben poder ejecutarse en Node puro con Vitest, sin DOM, sin Tauri y sin red.

### 3.1.1 Commands (capa de aplicación)

Los objetos de transferencia de datos de la capa de aplicación **se llaman siempre `commands`**. No se usa el sufijo `Dto` ni la carpeta `dto/`.

- Viven en `application/commands/` y se nombran `<Verbo><Objeto>Command` (`CreateTaskCommand`, `CompleteTaskCommand`).
- Son tipos inmutables de **primitivos** (`string`, `number`, `boolean`), sin Value Objects, entidades ni clases del dominio; el caso de uso los convierte a Value Objects.
- Un caso de uso recibe como máximo **un** command.
- Sin lógica: solo datos. La validación ocurre al construir los Value Objects en el dominio.
- Los casos de uso de lectura devuelven primitivos tipados (por ejemplo `TaskPrimitives`), no entidades.

```ts
// modules/tasks/application/commands/complete-task.command.ts
export type CompleteTaskCommand = {
  readonly taskId: string;
};
```

### 3.2 Estructura de carpetas (frontend)

```
src/
├── app/                          # Composition root: DI, router, providers, bootstrap
├── modules/
│   └── <bounded-context>/
│       ├── domain/
│       │   ├── entities/
│       │   ├── value-objects/    # Ids, Email, Money, etc.
│       │   ├── aggregates/
│       │   ├── events/
│       │   ├── services/
│       │   ├── errors/
│       │   └── repositories/     # Interfaces (puertos de salida)
│       ├── application/
│       │   ├── use-cases/
│       │   ├── commands/         # Commands: único tipo de DTO de la capa
│       │   └── ports/
│       ├── infrastructure/
│       │   ├── supabase/         # Repositorios/adaptadores Supabase
│       │   ├── tauri/            # Adaptadores IPC
│       │   └── mappers/          # fila/payload externo ⇄ dominio
│       └── presentation/
│           ├── atoms/
│           ├── molecules/
│           ├── organisms/
│           ├── templates/
│           ├── screens/          # Reemplaza a "pages"; cada pantalla implementa MVVM
│           │   └── <screen-name>/
│           │       ├── <screen-name>.model.ts       # Tipos, contratos de UI y del ViewModel
│           │       ├── <screen-name>.view-model.ts  # Hook (use<Screen>) con estado reactivo y casos de uso
│           │       ├── <screen-name>.view.tsx       # Vista declarativa de la pantalla
│           │       └── index.ts
│           └── state/
└── shared/
    ├── kernel/                   # value-object/ (ValueObject, StringValueObject, NumberValueObject, EnumValueObject, Uuid), AggregateRoot, DomainEvent, InvalidArgumentError
    └── ui/                       # Design system transversal bajo Atomic Design (sin lógica de negocio)
        ├── atoms/
        ├── molecules/
        ├── organisms/
        └── templates/
```

### 3.3 Estructura en Rust (`src-tauri`)

```
src-tauri/
├── capabilities/                 # Permisos Tauri 2 (mínimo necesario)
└── src/
    ├── lib.rs / main.rs          # Bootstrap y registro de comandos
    ├── commands/                 # Capa delgada: valida, delega, mapea errores
    └── modules/<bounded-context>/{domain,application,infrastructure}
```

Solo se escribe Rust para capacidades nativas (sistema de archivos, almacenamiento seguro, notificaciones, etc.). **No se duplica en Rust la lógica de negocio que ya vive en el dominio TypeScript.**

---

## 4. Patrón Value Object y clases abstractas base

Patrón de referencia: `CodelyTV/typescript-ddd-example` (value objects abstractos en el kernel compartido: `ValueObject`, `StringValueObject`, `NumberValueObject`, `EnumValueObject`, `Uuid`, y `AggregateRoot` con `toPrimitives`/`fromPrimitives`). Si este documento y el repositorio de referencia difieren, **prevalece este documento**.

### 4.1 Reglas de Value Objects

1. Un Value Object **envuelve un único valor primitivo** (`value`), es inmutable (`readonly`) y se compara **por valor y por tipo**.
2. Se **valida en el constructor**: un Value Object inválido no puede existir. La validación lanza `InvalidArgumentError` (o un error de dominio derivado).
3. Todo concepto con reglas propias es un Value Object (`TaskTitle`, `Email`, `TaskStatus`…), no un `string`/`number` suelto.
4. Se hereda de las clases abstractas base según el tipo de dato: `StringValueObject`, `NumberValueObject`, `EnumValueObject` o, para ids, `Uuid`.
5. Cada Value Object vive en `domain/value-objects/` de su módulo. Solo los transversales van en `shared/kernel/value-object/`.
6. Sin lógica de infraestructura ni de UI dentro de un Value Object.
7. Las clases base viven en `shared/kernel/value-object/` y son lo único del dominio autorizado a importar la librería `uuid`.

### 4.2 Clases base (en `shared/kernel/value-object/`)

```ts
// invalid-argument-error.ts
export class InvalidArgumentError extends Error {}
```

```ts
// value-object.ts
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

  // Se compara la referencia del constructor (no `constructor.name`) para que
  // la igualdad siga siendo correcta cuando el bundler minifica los nombres.
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
// string-value-object.ts
export abstract class StringValueObject extends ValueObject<string> {}

// number-value-object.ts
export abstract class NumberValueObject extends ValueObject<number> {
  public isBiggerThan(other: NumberValueObject): boolean {
    return this.value > other.value;
  }
}
```

```ts
// enum-value-object.ts
export abstract class EnumValueObject<T> {
  public constructor(
    public readonly value: T,
    public readonly validValues: readonly T[],
  ) {
    this.checkValueIsValid(value);
  }

  public checkValueIsValid(value: T): void {
    if (!this.validValues.includes(value)) {
      this.throwErrorForInvalidValue(value);
    }
  }

  protected abstract throwErrorForInvalidValue(value: T): void;
}
```

```ts
// uuid.ts
import { v4, validate } from "uuid";

export abstract class Uuid extends ValueObject<string> {
  public constructor(value: string) {
    super(value);
    this.ensureIsValidUuid(value);
  }

  // Polimórfico: `TaskId.random()` devuelve un `TaskId`.
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
// aggregate-root.ts
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

> `DomainEvent` es una clase abstracta del kernel (`domain-event.ts`) con `eventId`, `aggregateId` y `occurredOn`. Sin `any`: los agregados tipan sus primitivos con un `TPrimitives` explícito.

### 4.3 Ejemplos de uso

```ts
// modules/tasks/domain/value-objects/task-id.ts
export class TaskId extends Uuid {}

// modules/tasks/domain/value-objects/task-title.ts
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

```ts
// modules/tasks/domain/value-objects/task-status.ts
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

```ts
// modules/tasks/domain/aggregates/task.ts
export type TaskPrimitives = { id: string; title: string; status: string };

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
    return { id: this.id.value, title: this.title.value, status: this.status.value };
  }
}
```

### 4.4 Reglas para ids, entidades y agregados

- Todo id es un Value Object que **extiende de `Uuid`** (`TaskId`, `UserId`…). No existe `string` crudo como id dentro del dominio.
- Los ids **se generan en el dominio** (`TaskId.random()`), no en la base de datos ni en la UI.
- Los ids cruzan fronteras como `string` solo en commands, filas de Supabase y `toPrimitives()`; al volver se reconstruyen (`new TaskId(value)`).
- Un id de un agregado **no** es intercambiable con el de otro (clases distintas; `equals` compara también el tipo).
- Los agregados exponen `toPrimitives()` y `fromPrimitives()`; **los mappers de infraestructura** (Supabase ⇄ dominio) usan estos métodos y nunca acceden a campos internos.
- Los agregados registran eventos con `record()` y los casos de uso los publican con `pullDomainEvents()`.

---

## 5. Supabase autoalojado (VPS)

Supabase es un **detalle de infraestructura**. Solo existe dentro de `infrastructure/`.

1. `@supabase/supabase-js` **solo se importa en `infrastructure`**. Nunca en `domain`, `application` ni `presentation`.
2. El cliente se crea **una vez** en el composition root (`src/app/`) y se **inyecta** en los adaptadores.
3. Cada repositorio Supabase implementa una interfaz definida en `domain/repositories` (p. ej. `SupabaseTaskRepository implements TaskRepository`).
4. **Mappers obligatorios:** fila de Postgres ⇄ entidad/agregado de dominio. Los tipos generados (`supabase gen types`) **no salen de `infrastructure`**.
5. La autenticación se expone mediante un puerto (`AuthService`) implementado por un adaptador de Supabase Auth. El dominio y la aplicación no conocen sesiones ni JWT.
6. **Seguridad:**
   - En la app solo se usa la clave `anon`. **Jamás** se incluye `service_role` en el cliente ni en el bundle.
   - **Row Level Security (RLS) activo en todas las tablas**; las políticas se versionan.
   - URL y claves se leen desde configuración de entorno, nunca hardcodeadas ni commiteadas.
   - Persistir la sesión en almacenamiento seguro del sistema (plugin de Tauri para secretos/keyring), no en `localStorage` sin cifrar.
7. **Tauri y CSP:** el dominio del VPS debe estar permitido explícitamente en `connect-src` de la CSP en `tauri.conf.json` (y en las capabilities/scopes HTTP si aplica). No abrir `*`.
8. Siempre HTTPS (proxy inverso con TLS) hacia el VPS. Postgres no se expone directamente a internet.
9. **Migraciones** versionadas en `supabase/migrations/`; ningún cambio de esquema se hace "a mano" en producción sin su migración.
10. **Realtime:** las suscripciones son adaptadores con `unsubscribe` garantizado al limpiar (`onCleanup`). Los eventos externos se traducen a eventos/commands de aplicación.
11. **Errores:** el adaptador captura los errores de Supabase/red y los traduce a errores de aplicación tipados (`NetworkError`, `NotFoundError`, `PermissionDeniedError`…). Los mensajes técnicos van a logs, no a la UI.
12. Consultas con filtros e índices apropiados; prohibido traer tablas completas para filtrar en el cliente.

---

## 6. Presentación: SolidJS, Atomic Design y MVVM

### 6.1 Reglas de SolidJS

1. **No desestructurar props** (rompe la reactividad): usa `props.x`, `splitProps` o `mergeProps`.
2. Solid **no es React**: los componentes se ejecutan una sola vez. No usar patrones de React (`useEffect`, `useMemo`, arrays de dependencias).
3. `createSignal`, `createMemo`, `createEffect`, `createResource`, `createStore` según corresponda. Valores derivados con `createMemo`; no uses `createEffect` para sincronizar estado.
4. Control de flujo con `<Show>`, `<For>`, `<Switch>/<Match>`, `<Index>`; no `.map()` ni ternarios largos en JSX para listas/condiciones complejas.
5. Los componentes **no instancian adaptadores**: los casos de uso se inyectan mediante `createContext`, provisto desde `app/`, y son consumidos únicamente por el `viewModel` de cada `screen`.
6. Limpia listeners, timers, suscripciones Realtime y eventos de Tauri con `onCleanup`.
7. El estado transversal de UI vive en `presentation/state`; el estado y orquestación de cada pantalla vive en su `viewModel`; el estado de negocio vive en el dominio y se obtiene vía casos de uso.
8. La UI envía **commands** a los casos de uso y consume primitivos tipados (`toPrimitives()`), nunca entidades ni agregados.

### 6.2 Atomic Design (`atoms`, `molecules`, `organisms`, `templates`, `screens`)

La creación de interfaces y pantallas sigue **Atomic Design**, reemplazando el término `pages` por **`screens`** (en aplicaciones de escritorio cada vista completa es una pantalla, no una página web).

| Nivel | Carpeta | Responsabilidad | Estado permitido / Dependencias |
|-------|---------|-----------------|---------------------------------|
| **Atoms** | `atoms/` | Unidades visuales mínimas e indivisibles (`Button`, `Input`, `Badge`, `Icon`, `Label`). | Solo props visuales y eventos básicos. Sin estado de negocio ni casos de uso. |
| **Molecules** | `molecules/` | Combinación simple de átomos con un propósito funcional único de UI (`SearchField`, `FormField`, `StatCard`). | Puramente presentacionales (dirigidos por props). Compuestos de `atoms`. |
| **Organisms** | `organisms/` | Secciones completas de interfaz con significado funcional (`TaskHeader`, `TaskFilterBar`, `TaskTable`, `ClientForm`). | Pueden tener estado estrictamente visual local (ej. abrir/cerrar un menú), pero **no invocan casos de uso**: reciben datos y callbacks por props. Compuestos de `atoms` y `molecules`. |
| **Templates** | `templates/` | Estructuras de layout y distribución espacial (`DashboardTemplate`, `SplitPaneTemplate`, `ModalTemplate`). | Reciben regiones/slots (`JSX.Element` / `children`) por props. Sin datos reales ni llamadas a casos de uso. |
| **Screens** | `screens/` | Nivel final (**reemplaza a `pages`**). Conecta un `template` y sus `organisms`/`molecules`/`atoms` con los datos y casos de uso mediante el patrón **MVVM**. | Único nivel autorizado para consumir casos de uso a través de su `viewModel`. |

Reglas de distribución y composición:

1. **Prohibido usar `pages`:** Tanto en nombres de carpetas como de componentes o rutas internas de módulo se usa siempre **`screens`** (`presentation/screens/<screen-name>/`).
2. **Doble alcance (`shared/ui` vs `modules/<bounded-context>/presentation`):**
   - `src/shared/ui/{atoms,molecules,organisms,templates}`: componentes genéricos del Design System reutilizables entre módulos y agnósticos al dominio.
   - `src/modules/<bounded-context>/presentation/{atoms,molecules,organisms,templates,screens}`: componentes específicos del bounded context y las pantallas (`screens`) del módulo.
3. **Jerarquía estricta de importación:** El flujo de composición es siempre ascendente (`atoms` → `molecules` → `organisms` → `templates` → `screens`). Un nivel inferior **jamás** importa de un nivel superior (por ejemplo, un `molecule` no puede importar un `organism` ni una `screen`).

### 6.3 Patrón MVVM dentro de `screens/`

Cada pantalla dentro de `presentation/screens/<screen-name>/` se divide obligatoriamente en tres responsabilidades bajo el patrón **MVVM (Model – View – ViewModel)**:

```
presentation/screens/<screen-name>/
├── <screen-name>.model.ts       # Model: tipos, contratos de UI y del ViewModel
├── <screen-name>.view-model.ts  # ViewModel: hook (use<Screen>) con estado reactivo y casos de uso
├── <screen-name>.view.tsx       # View: componente visual de la pantalla (Templates + Organisms)
└── index.ts                     # API pública de la pantalla
```

1. **`model` (`<screen-name>.model.ts`) — Tipos y contratos de la pantalla:**
   - Contiene **únicamente definiciones de tipos** (`type`), estados de filtro/formulario de la vista, props y el contrato que expone el `viewModel` (`<Screen>ViewModel`).
   - Puede importar tipos primitivos de lectura (`TaskPrimitives`) y commands (`CreateTaskCommand`, `CompleteTaskCommand`) desde `application`/`domain`, pero **nunca clases de dominio, entidades ni código ejecutable**.
2. **`viewModel` (`<screen-name>.view-model.ts`) — Hook de la pantalla (`use<Screen>`):**
   - Se implementa como una **función de flecha** con nombre `use<Screen>` (por ejemplo, `useTaskList` para `task-list`).
   - Es el **único responsable** de:
     - Obtener los casos de uso desde el contexto de inyección de dependencias.
     - Declarar señales y estado reactivo de SolidJS (`createSignal`, `createMemo`, `createResource`, `createStore`, `onCleanup`).
     - Construir y despachar `commands` hacia la capa `application` y traducir errores a estados legibles para la vista.
   - Devuelve un objeto inmutable tipado con `<Screen>ViewModel` (accesores reactivos `Accessor<T>` y handlers de eventos). **Prohibido devolver JSX o manipular el DOM.**
3. **`view` (`<screen-name>.view.tsx`) — Pantalla declarativa:**
   - Componente SolidJS (`<Screen>Screen`, ej. `TaskListScreen`) escrito como función de flecha que consume el hook `use<Screen>()` (o recibe un `viewModel` opcional por props para facilitar tests de UI).
   - Ensambla el `template` de la pantalla con sus `organisms`, `molecules` y `atoms`, conectándolos a las propiedades y acciones del `viewModel`.
   - **Prohibido** instanciar señales de negocio, llamar a casos de uso o escribir lógica de transformación de datos dentro de `.view.tsx`.

#### Ejemplo completo de una `screen` con MVVM

```ts
// modules/tasks/presentation/screens/task-list/task-list.model.ts
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

```ts
// modules/tasks/presentation/screens/task-list/task-list.view-model.ts
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

```tsx
// modules/tasks/presentation/screens/task-list/task-list.view.tsx
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

```ts
// modules/tasks/presentation/screens/task-list/index.ts
export { TaskListScreen } from "./task-list.view";
export { useTaskList } from "./task-list.view-model";
export type { TaskFilter, TaskListScreenProps, TaskListViewModel } from "./task-list.model";
```

---

## 7. Tauri 2.0

1. **Solo `infrastructure` usa `@tauri-apps/api` y plugins.** Nunca desde componentes, `application` ni `domain`.
2. Cada comando de Rust tiene un adaptador TypeScript que implementa un puerto.
3. Los comandos son una **capa delgada**: deserializan, delegan y mapean errores. Sin lógica de negocio.
4. **Permisos mínimos** en `src-tauri/capabilities/`. Cada plugin o permiso nuevo requiere justificación.
5. Los comandos devuelven `Result<T, AppError>` con error serializable (`serde`); el adaptador TS lo traduce a error de aplicación.
6. Contratos IPC definidos en un solo lugar y sincronizados entre Rust y TS (ideal generar tipos con `tauri-specta` si se adopta).
7. Operaciones largas: comandos `async`; el progreso se reporta con eventos. Nunca bloquear el hilo principal.
8. Estado compartido en Rust con `tauri::State` y tipos seguros para concurrencia.
9. No exponer rutas, secretos ni información del sistema más allá de lo necesario.
10. Rust: `cargo fmt` y `cargo clippy -- -D warnings` limpios; sin `unwrap()`/`expect()` en producción salvo invariantes demostradas.

---

## 8. Tailwind CSS

1. Estilos con clases utilitarias; CSS propio solo cuando Tailwind no lo cubra.
2. Colores, espaciados y tipografías en el **tema** (design tokens). Evita valores arbitrarios (`w-[137px]`) salvo excepción justificada.
3. Patrones repetidos → **componentes de Solid**, no `@apply` masivo.
4. Orden de clases automático (plugin de Prettier para Tailwind).
5. Tema claro/oscuro con variantes `dark:` y tokens.
6. Accesibilidad: contraste, `focus-visible`, navegación completa por teclado.
7. Clases condicionales con una utilidad (`cn`/`clsx`), no concatenando strings.

---

## 9. Convenciones y herramientas de calidad

- **TypeScript `strict: true`**, sin `any`, sin `function`.
- **Nombres:**
  - Archivos: `kebab-case` (`create-task.use-case.ts`, `task-id.ts`, `supabase-task.repository.ts`, `task-list.model.ts`, `task-list.view-model.ts`, `task-list.view.tsx`).
  - Componentes (`atoms`, `molecules`, `organisms`, `templates`, `screens`): `PascalCase` (`TaskListScreen`, `TaskTable`). Value Objects y entidades: `PascalCase`.
  - Hooks de `viewModel` en `screens`: `use<Screen>` en `camelCase` (`useTaskList`).
  - Puertos: describen capacidad (`TaskRepository`, `AuthService`), sin prefijo `I`.
  - Eventos en pasado (`TaskCompleted`); casos de uso verbo + objeto (`CompleteTask`).
- **Imports** con alias (`@/modules/...`); sin `../../../`.
- **Sin dependencias circulares.** Lint de límites de capas con `eslint-plugin-boundaries` o `dependency-cruiser` (obligatorio en CI).
- **Inmutabilidad** por defecto: `readonly`, `as const`, sin mutar objetos fuera de sus métodos.
- **Comentarios:** explican el *por qué*, no el *qué*.
- Casos de uso como funciones flecha con dependencias inyectadas:

```ts
export const completeTask =
  (deps: { readonly tasks: TaskRepository }) =>
  async (command: CompleteTaskCommand): Promise<void> => {
    const task = await deps.tasks.search(new TaskId(command.taskId));
    if (task === null) throw new TaskNotFoundError(command.taskId);
    task.complete();
    await deps.tasks.save(task);
  };
```

---

## 10. Manejo de errores

1. Errores de dominio: tipos explícitos en `domain/errors`.
2. Los Value Objects y agregados lanzan errores de dominio tipados (`InvalidArgumentError` y derivados) al violar una invariante. Los casos de uso los dejan propagar o los traducen a errores de aplicación; la UI los captura en el borde (`presentation`).
3. Errores de infraestructura: se capturan en el adaptador y se traducen a errores de aplicación.
4. La UI muestra mensajes comprensibles; detalles técnicos a logs.
5. Prohibido silenciar errores (`catch {}` vacío).

---

## 11. Testing

| Nivel | Qué prueba | Herramienta |
|-------|-----------|-------------|
| Dominio | Entidades, Value Objects, agregados, servicios | Vitest / `cargo test` |
| Aplicación | Casos de uso con repositorios en memoria | Vitest |
| Integración | Adaptadores Supabase/Tauri contra su dependencia real o instancia local | Vitest / `cargo test` |
| Presentación (`ViewModel` y `View`) | Estado reactivo de `use<Screen>` (`viewModel`) y comportamiento visual de `atoms`/`molecules`/`organisms`/`screens` (`view`) | Vitest + `@solidjs/testing-library` |
| E2E | Flujos críticos en la app real | WebDriver / Playwright |

Reglas:
- Todo cambio en `domain` y `application` incluye tests.
- Todo Value Object tiene tests de: creación válida, rechazo de valores inválidos, igualdad por valor e inmutabilidad.
- Los tests de dominio son puros: sin mocks de frameworks, sin red.
- Prefiere **fakes en memoria** de los repositorios antes que mocks complejos.
- Nombres que describen comportamiento: `debería rechazar un título vacío`.
- Un bug corregido = un test que lo reproduce.

---

## 12. Flujo de trabajo para agentes de IA

Antes de escribir código:
1. Identifica el **bounded context** y la **capa** afectada.
2. Busca si ya existe un Value Object, puerto o caso de uso reutilizable.
3. Si la tarea es ambigua o afecta al modelo de dominio, **pregunta antes de implementar**.

Al implementar:
1. Orden: **dominio (+ tests) → aplicación → infraestructura → presentación**.
2. Cambios pequeños y enfocados; no mezclar refactors con funcionalidades.
3. Sin dependencias nuevas (npm/crates) sin justificar y confirmar.
4. No modificar `tauri.conf.json`, capabilities, `tsconfig`, lint ni políticas RLS sin explicar el motivo.
5. Mantener el estilo existente.

Al terminar:
1. Ejecutar lint, type-check y tests.
2. Resumir qué cambió, en qué capas y qué decisiones se tomaron.
3. Declarar deuda técnica y suposiciones.

### Prohibido

- Usar `any` o la palabra clave `function`.
- Usar `string` crudo como id dentro del dominio.
- Importar `@tauri-apps/*`, `@supabase/*` o `solid-js` en `domain` o `application`.
- Lógica de negocio en componentes, comandos de Tauri, adaptadores o políticas SQL.
- Usar el término o carpeta `pages` en lugar de `screens`.
- Invocar casos de uso en `atoms`, `molecules`, `organisms`, `templates` o directamente en `.view.tsx` (solo el `viewModel` mediante `use<Screen>` puede hacerlo).
- Exponer entidades de dominio directamente a la UI (usar commands de entrada y primitivos tipados de salida).
- Llamar a `invoke` o al cliente de Supabase fuera de `infrastructure`.
- Incluir la clave `service_role` o secretos en el cliente.
- Permisos de Tauri más amplios de lo necesario.
- Comunicar bounded contexts mediante imports directos.
- Dejar `console.log`, código muerto o `TODO` sin issue asociada.

---

## 13. Git y revisión

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) con el bounded context como scope (`feat(tasks): permite completar una tarea`).
- **Ramas:** `feat/…`, `fix/…`, `refactor/…`, `chore/…`.
- **PRs** pequeños, con el *qué* y el *por qué*, y checklist cumplido.
- No se hace merge con CI en rojo.

### Checklist antes de cada PR

- [ ] Se respeta la regla de dependencia entre capas
- [ ] La lógica de negocio está en `domain`
- [ ] Los ids son Value Objects que extienden de `Uuid`
- [ ] Sin `any` y sin `function` (solo funciones de flecha)
- [ ] La UI respeta Atomic Design (`atoms`, `molecules`, `organisms`, `templates`, `screens`) y MVVM (`model`, `view`, `viewModel` con `use<Screen>`)
- [ ] Supabase/Tauri solo aparecen en `infrastructure`
- [ ] Hay tests nuevos/actualizados y pasan
- [ ] Lint, formato y type-check limpios (TS y Rust)
- [ ] RLS y permisos de Tauri revisados
- [ ] Sin dependencias nuevas sin justificar
- [ ] Glosario/documentación actualizados si cambió el lenguaje del dominio
