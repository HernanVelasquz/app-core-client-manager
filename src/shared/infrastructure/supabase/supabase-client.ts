import { createClient } from "@supabase/supabase-js";
import { APP_CORE_SCHEMA } from "./app-core-schema";

export type SupabaseClientConfig = {
  readonly url: string;
  readonly anonKey: string;
  readonly persistSession?: boolean;
};

const createInternalClient = (config: SupabaseClientConfig) =>
  createClient(config.url, config.anonKey, {
    db: {
      schema: APP_CORE_SCHEMA,
    },
    auth: {
      persistSession: config.persistSession ?? true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

export type AppCoreSupabaseClient = ReturnType<typeof createInternalClient>;

export class AppCoreSupabaseClientFactory {
  public static create(config: SupabaseClientConfig): AppCoreSupabaseClient {
    return createInternalClient(config);
  }

  public static resolveConfigFromEnv(): SupabaseClientConfig | null {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

    if (url.length === 0 || anonKey.length === 0) {
      return null;
    }

    return {
      url,
      anonKey,
    };
  }
}
