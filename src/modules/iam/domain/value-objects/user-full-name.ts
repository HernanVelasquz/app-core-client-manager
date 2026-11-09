import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

const MAX_FULL_NAME_LENGTH = 150;

export class UserFullName extends StringValueObject {
  public constructor(value: string) {
    const normalized = typeof value === "string" ? value.trim() : value;
    super(normalized);
    this.ensureIsValidFullName(normalized);
  }

  private ensureIsValidFullName(value: string): void {
    if (value.length === 0 || value.length > MAX_FULL_NAME_LENGTH) {
      throw new InvalidArgumentError(`The user full name <${value}> is invalid`);
    }
  }
}

