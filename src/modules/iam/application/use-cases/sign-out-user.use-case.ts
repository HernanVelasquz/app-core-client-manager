import type { AuthService } from "../ports";

export class SignOutUserUseCase {
  public constructor(private readonly authService: AuthService) { }

  public async execute(): Promise<void> {
    await this.authService.signOut();
  }
}
