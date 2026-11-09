export class InvalidCredentialsError extends Error {
  public constructor() {
    super("The provided email or password is invalid");
    this.name = "InvalidCredentialsError";
  }
}

