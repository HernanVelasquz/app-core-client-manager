import { v4, validate } from "uuid";
import { InvalidArgumentError } from "./invalid-argument-error";
import { ValueObject } from "./value-object";

export abstract class Uuid extends ValueObject<string> {
  public constructor(value: string) {
    super(value);
    this.ensureIsValidUuid(value);
  }

  // Polimórfico: `TaskId.random()` devuelve un `TaskId`.
  public static random<T extends Uuid>(this: new (value: string) => T): T {
    return new this(v4());
  }

  private ensureIsValidUuid(id: string): void {
    if (!validate(id)) {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow the value <${id}>`,
      );
    }
  }
}

