import type {
  PerfilUsuarioPrimitives,
  PerfilUsuarioRepository,
} from "@/modules/iam/domain";
import type { AuthService } from "../ports";

export class GetCurrentSessionProfileUseCase {
  public constructor(
    private readonly authService: AuthService,
    private readonly profiles: PerfilUsuarioRepository,
  ) { }

  public async execute(): Promise<PerfilUsuarioPrimitives | null> {
    const profileId = await this.authService.getCurrentProfileId();
    if (profileId === null) {
      return null;
    }

    const profile = await this.profiles.findById(profileId);
    if (profile === null || !profile.isActive()) {
      await this.authService.signOut();
      return null;
    }

    return profile.toPrimitives();
}
}
