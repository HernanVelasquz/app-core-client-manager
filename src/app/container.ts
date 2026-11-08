// Composition Root: Dependency Injection container
// Instantiate infrastructure adapters (Supabase, Tauri IPC) here and inject them into application use cases.
export type AppContainer = Readonly<Record<string, never>>;

export const createAppContainer = (): AppContainer => ({});

