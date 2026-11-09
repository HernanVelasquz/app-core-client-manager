import {
  GetCurrentSessionProfileUseCase,
  RequestPasswordResetUseCase,
  SignInWithPasswordUseCase,
  SignOutUserUseCase,
  type AuthService,
} from "@/modules/iam/application";
import type { PerfilUsuarioRepository } from "@/modules/iam/domain";
import {
  LocalDemoAuthService,
  LocalDemoIamState,
  LocalDemoPerfilUsuarioRepository,
  SupabaseAuthService,
  SupabasePerfilUsuarioRepository,
} from "@/modules/iam/infrastructure";
import type { IamUseCasesContract } from "@/modules/iam/presentation";
import { AppCoreSupabaseClientFactory } from "@/shared/infrastructure";

export type AppContainer = {
  readonly iam: IamUseCasesContract;
};

const createIamAdapters = (): {
  readonly authService: AuthService;
  readonly profiles: PerfilUsuarioRepository;
} => {
  const supabaseConfig = AppCoreSupabaseClientFactory.resolveConfigFromEnv();

  if (supabaseConfig !== null) {
    const client = AppCoreSupabaseClientFactory.create(supabaseConfig);
    return {
      authService: new SupabaseAuthService(client),
      profiles: new SupabasePerfilUsuarioRepository(client),
    };
  }

  const demoState = new LocalDemoIamState();
  return {
    authService: new LocalDemoAuthService(demoState),
    profiles: new LocalDemoPerfilUsuarioRepository(demoState),
  };
};

export const createAppContainer = (): AppContainer => {
  const adapters = createIamAdapters();

  const signInWithPasswordUseCase = new SignInWithPasswordUseCase(
    adapters.authService,
    adapters.profiles,
  );
  const getCurrentSessionProfileUseCase = new GetCurrentSessionProfileUseCase(
    adapters.authService,
    adapters.profiles,
  );
  const signOutUserUseCase = new SignOutUserUseCase(adapters.authService);
  const requestPasswordResetUseCase = new RequestPasswordResetUseCase(
    adapters.authService,
  );

  return {
    iam: {
      signInWithPassword: (command) => signInWithPasswordUseCase.execute(command),
      getCurrentSessionProfile: () => getCurrentSessionProfileUseCase.execute(),
      signOutUser: () => signOutUserUseCase.execute(),
      requestPasswordReset: (command) => requestPasswordResetUseCase.execute(command),
    },
  };
};
