import { describe, expect, it } from "vitest";
import {
  InactiveUserProfileError,
  InvalidCredentialsError,
  PerfilUsuario,
  ProfileId,
  ProfileNotFoundError,
  type PerfilUsuarioRepository,
  type UserEmail,
} from "@/modules/iam/domain";
import { InvalidArgumentError, type DomainEvent, type EventBus } from "@/shared/kernel";
import { SignInWithPasswordCommand } from "../commands";
import type { AuthService, SignInCredentials } from "../ports";
import { SignInWithPasswordUseCase } from "../use-cases";

class InMemoryPerfilUsuarioRepository implements PerfilUsuarioRepository {
  public constructor(private readonly items: readonly PerfilUsuario[]) { }

  public async findById(id: ProfileId): Promise<PerfilUsuario | null> {
    return this.items.find((profile) => profile.id.equals(id)) ?? null;
  }

  public async findByEmail(email: UserEmail): Promise<PerfilUsuario | null> {
    return this.items.find((profile) => profile.email.equals(email)) ?? null;
  }
}

class InMemoryAuthService implements AuthService {
  private signedOut = false;

  public constructor(
    private readonly params: {
      readonly validEmail: string;
      readonly validPassword: string;
      readonly profileId: ProfileId;
    },
  ) { }

  public isSignedOut(): boolean {
    return this.signedOut;
  }

  public async signInWithPassword(credentials: SignInCredentials): Promise<ProfileId> {
    if (
      credentials.email.value !== this.params.validEmail ||
      credentials.password.value !== this.params.validPassword
    ) {
      throw new InvalidCredentialsError();
    }
    this.signedOut = false;
    return this.params.profileId;
  }

  public async signOut(): Promise<void> {
    this.signedOut = true;
  }

  public async getCurrentProfileId(): Promise<ProfileId | null> {
    return this.signedOut ? null : this.params.profileId;
  }

  public async requestPasswordReset(_email: UserEmail): Promise<void> { }
}

class InMemoryEventBus implements EventBus {
  public readonly publishedEvents: DomainEvent[] = [];

  public async publish(events: readonly DomainEvent[]): Promise<void> {
    this.publishedEvents.push(...events);
  }
}

describe("SignInWithPasswordUseCase", () => {
  const activeProfilePrimitives = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    roleId: "660e8400-e29b-41d4-a716-446655440001",
    roleName: "Administrador",
    fullName: "Hernán Velásquez",
    email: "hernan@focus.studio",
    avatarUrl: null,
    isActive: true,
    permissions: ["ROLE_MANAGE", "USER_MANAGE"],
  } as const;

  it("debería autenticar con email y password válidos y devolver PerfilUsuarioPrimitives", async () => {
    const profile = PerfilUsuario.fromPrimitives(activeProfilePrimitives);
    const profiles = new InMemoryPerfilUsuarioRepository([profile]);
    const authService = new InMemoryAuthService({
      validEmail: "hernan@focus.studio",
      validPassword: "FocusPassword123",
      profileId: profile.id,
    });
    const eventBus = new InMemoryEventBus();

    const useCase = new SignInWithPasswordUseCase(authService, profiles, eventBus);
    const result = await useCase.execute(
      new SignInWithPasswordCommand({
        email: "  HERNAN@focus.studio ",
        password: "FocusPassword123",
        keepSignedIn: true,
      }),
    );

    expect(result).toEqual(activeProfilePrimitives);
    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus.publishedEvents[0]?.eventName).toBe("iam.user_authenticated");
  });

  it("debería rechazar credenciales inválidas lanzando InvalidCredentialsError", async () => {
    const profile = PerfilUsuario.fromPrimitives(activeProfilePrimitives);
    const profiles = new InMemoryPerfilUsuarioRepository([profile]);
    const authService = new InMemoryAuthService({
      validEmail: "hernan@focus.studio",
      validPassword: "FocusPassword123",
      profileId: profile.id,
    });

    const useCase = new SignInWithPasswordUseCase(authService, profiles);

    await expect(
      useCase.execute(
        new SignInWithPasswordCommand({
          email: "hernan@focus.studio",
          password: "WrongPassword999",
          keepSignedIn: false,
        }),
      ),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("debería rechazar formato de email o password inválido antes de llamar a AuthService", async () => {
    const profile = PerfilUsuario.fromPrimitives(activeProfilePrimitives);
    const profiles = new InMemoryPerfilUsuarioRepository([profile]);
    const authService = new InMemoryAuthService({
      validEmail: "hernan@focus.studio",
      validPassword: "FocusPassword123",
      profileId: profile.id,
    });

    const useCase = new SignInWithPasswordUseCase(authService, profiles);

    await expect(
      useCase.execute(
        new SignInWithPasswordCommand({
          email: "invalid-email",
          password: "FocusPassword123",
          keepSignedIn: true,
        }),
      ),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("debería cerrar sesión y lanzar InactiveUserProfileError si el perfil está inactivo", async () => {
    const inactiveProfile = PerfilUsuario.fromPrimitives({
      ...activeProfilePrimitives,
      isActive: false,
    });
    const profiles = new InMemoryPerfilUsuarioRepository([inactiveProfile]);
    const authService = new InMemoryAuthService({
      validEmail: "hernan@focus.studio",
      validPassword: "FocusPassword123",
      profileId: inactiveProfile.id,
    });

    const useCase = new SignInWithPasswordUseCase(authService, profiles);

    await expect(
      useCase.execute(
        new SignInWithPasswordCommand({
          email: "hernan@focus.studio",
          password: "FocusPassword123",
          keepSignedIn: true,
        }),
      ),
    ).rejects.toThrow(InactiveUserProfileError);

    expect(authService.isSignedOut()).toBe(true);
  });

  it("debería cerrar sesión y lanzar ProfileNotFoundError si no existe en iam_profiles", async () => {
    const missingProfileId = new ProfileId(activeProfilePrimitives.id);
    const profiles = new InMemoryPerfilUsuarioRepository([]);
    const authService = new InMemoryAuthService({
      validEmail: "hernan@focus.studio",
      validPassword: "FocusPassword123",
      profileId: missingProfileId,
    });

    const useCase = new SignInWithPasswordUseCase(authService, profiles);

    await expect(
      useCase.execute(
        new SignInWithPasswordCommand({
          email: "hernan@focus.studio",
          password: "FocusPassword123",
          keepSignedIn: true,
        }),
      ),
    ).rejects.toThrow(ProfileNotFoundError);

    expect(authService.isSignedOut()).toBe(true);
  });
});
