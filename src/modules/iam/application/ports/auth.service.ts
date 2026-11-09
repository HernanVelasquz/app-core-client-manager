import type { PlainPassword, ProfileId, UserEmail } from "@/modules/iam/domain";

export class SignInCredentials {
  public readonly email: UserEmail;
  public readonly password: PlainPassword;
  public readonly keepSignedIn: boolean;

  public constructor(params: {
    readonly email: UserEmail;
    readonly password: PlainPassword;
    readonly keepSignedIn: boolean;
  }) {
  this.email = params.email;
  this.password = params.password;
  this.keepSignedIn = params.keepSignedIn;
}
}

export interface AuthService {
  signInWithPassword(credentials: SignInCredentials): Promise<ProfileId>;
  signOut(): Promise<void>;
  getCurrentProfileId(): Promise<ProfileId | null>;
  requestPasswordReset(email: UserEmail): Promise<void>;
}
