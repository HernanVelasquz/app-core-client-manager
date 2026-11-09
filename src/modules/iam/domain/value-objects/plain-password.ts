import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export class PlainPassword extends StringValueObject {
  public constructor(value: string) {
    super(value);
    this.ensureIsValidPassword(value);
  }

  private ensureIsValidPassword(value: string): void {
    if (
      value.trim().length === 0 ||
      value.length < MIN_PASSWORD_LENGTH ||
      value.length > MAX_PASSWORD_LENGTH
    ) {
      throw new InvalidArgumentError(
        `Password must contain between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
      );
    }
  }
}

