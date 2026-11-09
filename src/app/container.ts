import {
  GetCurrentSessionProfileUseCase,
  RequestPasswordResetUseCase,
  SignInWithPasswordUseCase,
  SignOutUserUseCase,
} from "@/modules/iam/application";
import {
  SupabaseAuthService,
  SupabasePerfilUsuarioRepository,
} from "@/modules/iam/infrastructure";
import type { IamUseCasesContract } from "@/modules/iam/presentation";
import { AppCoreSupabaseClientFactory } from "@/shared/infrastructure";

export type AppContainer = {
  readonly iam: IamUseCasesContract;
};

export const createAppContainer = (): AppContainer => {
  const supabaseClient = AppCoreSupabaseClientFactory.createFromEnv();
  const authService = new SupabaseAuthService(supabaseClient);
  const profilesRepository = new SupabasePerfilUsuarioRepository(supabaseClient);

  const signInWithPasswordUseCase = new SignInWithPasswordUseCase(
    authService,
    profilesRepository,
  );
  const getCurrentSessionProfileUseCase = new GetCurrentSessionProfileUseCase(
    authService,
    profilesRepository,
  );
  const signOutUserUseCase = new SignOutUserUseCase(authService);
  const requestPasswordResetUseCase = new RequestPasswordResetUseCase(authService);

  return {
    iam: {
      signInWithPassword: (command) => signInWithPasswordUseCase.execute(command),
      getCurrentSessionProfile: () => getCurrentSessionProfileUseCase.execute(),
      signOutUser: () => signOutUserUseCase.execute(),
      requestPasswordReset: (command) => requestPasswordResetUseCase.execute(command),
    },
  };
};
