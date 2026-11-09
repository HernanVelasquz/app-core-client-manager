import { UserEmail } from "@/modules/iam/domain";
import type { RequestPasswordResetCommand } from "../commands";
import type { AuthService } from "../ports";

export class RequestPasswordResetUseCase {
  public constructor(private readonly authService: AuthService) { }

  public async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = new UserEmail(command.email);
    await this.authService.requestPasswordReset(email);
  }
}
