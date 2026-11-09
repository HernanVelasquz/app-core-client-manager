import type { AuthService, SignInCredentials } from "@/modules/iam/application";
import {
  InvalidCredentialsError,
  ProfileId,
  type UserEmail,
} from "@/modules/iam/domain";
import type { AppCoreSupabaseClient } from "@/shared/infrastructure";

export class AuthInfrastructureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AuthInfrastructureError";
  }
}

export class SupabaseAuthService implements AuthService {
  public constructor(private readonly client: AppCoreSupabaseClient) { }

  public async signInWithPassword(credentials: SignInCredentials): Promise<ProfileId> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: credentials.email.value,
      password: credentials.password.value,
    });

    if (error !== null || data.user === null) {
      const normalizedMsg = error?.message.toLowerCase() ?? "";
      if (
        normalizedMsg.includes("invalid login credentials") ||
        normalizedMsg.includes("invalid_credentials") ||
        error?.status === 400
      ) {
        throw new InvalidCredentialsError();
      }
      throw new AuthInfrastructureError(
        "No fue posible conectar con el servicio de autenticación.",
      );
    }

    return new ProfileId(data.user.id);
  }

  public async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error !== null) {
      throw new AuthInfrastructureError("No se pudo cerrar la sesión de forma segura.");
    }
  }

  public async getCurrentProfileId(): Promise<ProfileId | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error !== null || data.user === null) {
      return null;
    }
    return new ProfileId(data.user.id);
  }

  public async requestPasswordReset(email: UserEmail): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email.value);
    if (error !== null) {
      throw new AuthInfrastructureError(
        "No se pudo enviar el correo de recuperación de contraseña.",
      );
    }
  }
}
