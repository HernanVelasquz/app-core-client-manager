---
name: tauri-native-integration
description: >-
  Guides the development of Tauri 2.x Rust commands, TypeScript IPC adapters in
   the infrastructure layer, capabilities/permissions configuration, and CSP security.
  Use this skill whenever editing files in src-tauri/, adding Tauri plugins or
  capabilities, or creating IPC adapters in infrastructure/tauri/.
---

# Tauri 2.x Native Integration & IPC Adapters

Use this skill when implementing native desktop capabilities in `src-tauri/` or creating TypeScript IPC adapters in `src/modules/<bounded-context>/infrastructure/tauri/`.

## 1. Core Principles & Non-Negotiable Rules

1. **Strict Infrastructure Isolation:** `@tauri-apps/api` and `@tauri-apps/plugin-*` may **ONLY** be imported inside `src/modules/<bounded-context>/infrastructure/tauri/` (or `src/app/` for bootstrap). Never import Tauri APIs in `domain`, `application`, or `presentation`.
2. **Thin Rust Commands & No Duplicated Business Logic:** Write Rust only for native OS capabilities (filesystem, keyring/secure storage, OS notifications, native dialogs, background jobs). Never duplicate business rules that already live in the TypeScript `domain`.
3. **Port & Adapter Contract:** Every Tauri IPC interaction must be modeled as a port in `domain` or `application/ports/` and implemented by an adapter in `infrastructure/tauri/`.
4. **Least-Privilege Permissions & CSP:**
   - Grant only the minimum required permissions in `src-tauri/capabilities/`. Justify every new plugin or capability before modifying config files.
   - Maintain a strict CSP in `src-tauri/tauri.conf.json` (explicitly allow the self-hosted Supabase VPS domain in `connect-src`; never use `*`).
5. **Rust Code Quality:**
   - Commands must return `Result<T, AppError>` where `AppError` implements `serde::Serialize`.
   - Never use `unwrap()` or `expect()` in production Rust code unless an invariant is statically proven.
   - Long-running operations must be `async` and report progress via Tauri events—never block the main thread.
   - `cargo fmt` and `cargo clippy -- -D warnings` must pass cleanly.

---

## 2. Directory Structure

```text
src-tauri/
├── capabilities/                 # Tauri 2 least-privilege permission files
├── tauri.conf.json               # App config and strict CSP
└── src/
    ├── lib.rs / main.rs          # Bootstrap, state management, and command registration
    ├── commands/                 # Thin IPC handlers: deserialize, delegate, map errors
    └── modules/
        └── <bounded-context>/
            ├── domain/
            ├── application/
            └── infrastructure/
src/
└── modules/
    └── <bounded-context>/
        └── infrastructure/
            └── tauri/            # TypeScript adapters calling invoke()
```

---

## 3. Step-by-Step Procedures

### Step 1: Define the Serializable Error and Thin Command in Rust (`src-tauri/src/commands/`)

```rust
// src-tauri/src/commands/storage_commands.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    IoError(String),
    NotFound(String),
    PermissionDenied(String),
}

#[tauri::command]
pub async fn export_client_report(path: String, payload: String) -> Result<(), AppError> {
    std::fs::write(&path, payload).map_err(|err| AppError::IoError(err.to_string()))
}
```

Register the command in `src-tauri/src/lib.rs` inside `tauri::Builder::default().invoke_handler(tauri::generate_handler![...])`.

### Step 2: Define the Port Interface in TypeScript (`application/ports/` or `domain/repositories/`)

```ts
// src/modules/reports/application/ports/report-exporter.port.ts
export type ExportReportInput = {
  readonly filePath: string;
  readonly content: string;
};

export interface ReportExporter {
  exportReport(input: ExportReportInput): Promise<void>;
}
```

### Step 3: Implement the TypeScript Adapter Class (`infrastructure/tauri/`)

Validate/narrow `unknown` responses and translate IPC errors into typed application errors. Implement adapters as **classes** (`implements <Port>`):

```ts
// src/modules/reports/infrastructure/tauri/tauri-report-exporter.adapter.ts
import { invoke } from "@tauri-apps/api/core";
import type { ExportReportInput, ReportExporter } from "@/modules/reports/application";

export class TauriReportExporter implements ReportExporter {
  public async exportReport(input: ExportReportInput): Promise<void> {
    try {
      await invoke<void>("export_client_report", {
        path: input.filePath,
        payload: input.content,
      });
    } catch (error: unknown) {
      throw new Error(
        error instanceof Error ? error.message : "Error al exportar el reporte nativo",
      );
    }
  }
}
```

#### Secure Storage / Keyring Adapter Class Example (for Supabase Session Persistence)

```ts
// src/modules/iam/infrastructure/tauri/tauri-secure-storage.adapter.ts
import { invoke } from "@tauri-apps/api/core";
import type { SecureStoragePort } from "@/modules/iam/application";

export class TauriSecureStorageAdapter implements SecureStoragePort {
  public async getSecret(key: string): Promise<string | null> {
    const result: unknown = await invoke("get_secret", { key });
    return typeof result === "string" ? result : null;
  }

  public async setSecret(key: string, value: string): Promise<void> {
    await invoke("set_secret", { key, value });
  }
}
```

### Step 4: Configure Capabilities (`src-tauri/capabilities/`)

Add only the specific command or scoped plugin permission needed—never wildcard permissions. Always explain to the user before changing `src-tauri/capabilities/` or `src-tauri/tauri.conf.json`.

---

## 4. Verification Checklist

- [ ] Are `@tauri-apps/*` imports confined strictly to `infrastructure/` (and `src/app/`)?
- [ ] Are Rust commands thin (deserialize, delegate, map errors to `Result<T, AppError>`) with no duplicated business logic?
- [ ] Are there zero `unwrap()` / `expect()` calls in production Rust paths?
- [ ] Do `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test` pass?
- [ ] Are permissions in `src-tauri/capabilities/` and `connect-src` in `tauri.conf.json` minimal and explicitly scoped?
