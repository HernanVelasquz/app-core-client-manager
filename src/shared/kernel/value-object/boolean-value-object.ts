import { InvalidArgumentError } from "./invalid-argument-error";
import { ValueObject } from "./value-object";

export abstract class BooleanValueObject extends ValueObject<boolean> {
  public constructor(value: boolean) {
    super(value);
    this.ensureIsBoolean(value);
  }

  private ensureIsBoolean(value: boolean): void {
    if (typeof value !== "boolean") {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow non-boolean values`,
      );
    }
  }
}

