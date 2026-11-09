export class ProfileNotFoundError extends Error {
  public constructor(identifier: string) {
    super(`No user profile was found in app_core.iam_profiles for <${identifier}>`);
    this.name = "ProfileNotFoundError";
  }
}

