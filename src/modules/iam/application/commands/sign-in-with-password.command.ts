export class SignInWithPasswordCommand {
  public readonly email: string;
  public readonly password: string;
  public readonly keepSignedIn: boolean;

  public constructor(params: {
    readonly email: string;
    readonly password: string;
    readonly keepSignedIn: boolean;
  }) {
    this.email = params.email;
    this.password = params.password;
    this.keepSignedIn = params.keepSignedIn;
  }
}
