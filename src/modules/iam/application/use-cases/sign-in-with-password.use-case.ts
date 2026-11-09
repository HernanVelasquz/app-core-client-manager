import {
  PlainPassword,
  ProfileNotFoundError,
  UserEmail,
  type PerfilUsuarioPrimitives,
  type PerfilUsuarioRepository,
} from "@/modules/iam/domain";
import type { EventBus } from "@/shared/kernel";
import type { SignInWithPasswordCommand } from "../commands";
import { SignInCredentials, type AuthService } from "../ports";

export class SignInWithPasswordUseCase {
  public constructor(
    private readonly authService: AuthService,
    private readonly profiles: PerfilUsuarioRepository,
    private readonly eventBus?: EventBus,
  ) { }

  public async execute(
    command: SignInWithPasswordCommand,
  ): Promise<PerfilUsuarioPrimitives> {
    const email = new UserEmail(command.email);
    const password = new PlainPassword(command.password);

    const profileId = await this.authService.signInWithPassword(
      new SignInCredentials({
        email,
        password,
        keepSignedIn: command.keepSignedIn,
      }),
    );

    const profile = await this.profiles.findById(profileId);
    if (profile === null) {
      await this.authService.signOut();
      throw new ProfileNotFoundError(profileId.value);
    }

    try {
      profile.ensureCanAuthenticate();
    } catch (error: unknown) {
      await this.authService.signOut();
      throw error;
    }

    const events = profile.pullDomainEvents();
    if (this.eventBus !== undefined && events.length > 0) {
      await this.eventBus.publish(events);
    }

    return profile.toPrimitives();
  }
}
