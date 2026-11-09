import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

const MAX_AVATAR_URL_LENGTH = 2048;

export class UserAvatarUrl extends StringValueObject {
  public constructor(value: string) {
    const normalized = typeof value === "string" ? value.trim() : value;
    super(normalized);
    this.ensureIsValidAvatarUrl(normalized);
  }

  public static empty(): UserAvatarUrl {
    return new UserAvatarUrl("");
  }

  public static fromNullable(value: string | null): UserAvatarUrl {
    return new UserAvatarUrl(value ?? "");
  }

  public hasAvatar(): boolean {
    return this.value.length > 0;
  }

  public toNullable(): string | null {
    return this.value.length > 0 ? this.value : null;
  }

  private ensureIsValidAvatarUrl(value: string): void {
    if (value.length > MAX_AVATAR_URL_LENGTH) {
      throw new InvalidArgumentError(`The avatar url <${value}> exceeds maximum length`);
    }

    if (
      value.length > 0 &&
      !value.startsWith("https://") &&
      !value.startsWith("http://") &&
      !value.startsWith("/")
    ) {
      throw new InvalidArgumentError(`The avatar url <${value}> must be a valid URL or path`);
    }
  }
}

