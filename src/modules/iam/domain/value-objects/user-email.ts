import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 150;

export class UserEmail extends StringValueObject {
  public constructor(value: string) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
    super(normalized);
    this.ensureIsValidEmail(normalized);
  }

  private ensureIsValidEmail(value: string): void {
    if (value.length === 0 || value.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(value)) {
      throw new InvalidArgumentError(`The email <${value}> is invalid`);
    }
  }
}

