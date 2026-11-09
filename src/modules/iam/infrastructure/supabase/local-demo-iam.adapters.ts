import type { AuthService, SignInCredentials } from "@/modules/iam/application";
import {
  InvalidCredentialsError,
  PerfilUsuario,
  ProfileId,
  SystemPermissions,
  type PerfilUsuarioRepository,
  type UserEmail,
} from "@/modules/iam/domain";

const DEMO_PROFILE_ID = "550e8400-e29b-41d4-a716-446655440000";
const DEMO_ROLE_ID = "660e8400-e29b-41d4-a716-446655440001";

export class LocalDemoIamState {
  private activeProfile: PerfilUsuario | null = null;

  public static createDefaultProfile(email = "hernan@focus.studio"): PerfilUsuario {
    return PerfilUsuario.fromPrimitives({
      id: DEMO_PROFILE_ID,
      roleId: DEMO_ROLE_ID,
      roleName: "Administrador",
      fullName: "Hernán Velásquez",
      email,
      avatarUrl: null,
      isActive: true,
      permissions: Object.values(SystemPermissions),
    });
  }

  public getActiveProfile(): PerfilUsuario | null {
    return this.activeProfile;
  }

  public setActiveProfile(profile: PerfilUsuario | null): void {
    this.activeProfile = profile;
  }
}

export class LocalDemoAuthService implements AuthService {
  public constructor(private readonly state: LocalDemoIamState) { }

  public async signInWithPassword(credentials: SignInCredentials): Promise<ProfileId> {
    if (credentials.password.value === "wrong-password") {
      throw new InvalidCredentialsError();
    }

    const profile = LocalDemoIamState.createDefaultProfile(credentials.email.value);
    this.state.setActiveProfile(profile);
    return profile.id;
  }

  public async signOut(): Promise<void> {
    this.state.setActiveProfile(null);
  }

  public async getCurrentProfileId(): Promise<ProfileId | null> {
    const active = this.state.getActiveProfile();
    return active !== null ? active.id : null;
  }

  public async requestPasswordReset(_email: UserEmail): Promise<void> { }
}

export class LocalDemoPerfilUsuarioRepository implements PerfilUsuarioRepository {
  public constructor(private readonly state: LocalDemoIamState) { }

  public async findById(id: ProfileId): Promise<PerfilUsuario | null> {
    const candidate =
      this.state.getActiveProfile() ?? LocalDemoIamState.createDefaultProfile();
    return candidate.id.equals(id) ? candidate : null;
  }

  public async findByEmail(email: UserEmail): Promise<PerfilUsuario | null> {
    const candidate =
      this.state.getActiveProfile() ??
      LocalDemoIamState.createDefaultProfile(email.value);
    return candidate.email.equals(email) ? candidate : null;
  }
}
