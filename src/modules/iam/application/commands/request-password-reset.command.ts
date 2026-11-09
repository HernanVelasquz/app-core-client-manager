export class RequestPasswordResetCommand {
  public readonly email: string;

  public constructor(params: { readonly email: string }) {
    this.email = params.email;
  }
}
