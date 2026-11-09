import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

const MAX_ROLE_NAME_LENGTH = 80;

export class RoleName extends StringValueObject {
  public constructor(value: string) {
    const normalized = typeof value === "string" ? value.trim() : value;
    super(normalized);
    this.ensureIsValidRoleName(normalized);
  }

  private ensureIsValidRoleName(value: string): void {
    if (value.length === 0 || value.length > MAX_ROLE_NAME_LENGTH) {
      throw new InvalidArgumentError(`The role name <${value}> is invalid`);
    }
  }
}

