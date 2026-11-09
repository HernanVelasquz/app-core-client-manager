export class InactiveUserProfileError extends Error {
  public constructor(email: string) {
    super(`The user profile associated with <${email}> is inactive`);
    this.name = "InactiveUserProfileError";
  }
}

