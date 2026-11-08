import { InvalidArgumentError } from "./invalid-argument-error";

export type Primitives = string | number | boolean | Date;

export abstract class ValueObject<T extends Primitives> {
  public readonly value: T;

  public constructor(value: T) {
    this.value = value;
    this.ensureValueIsDefined(value);
  }

  private ensureValueIsDefined(value: T): void {
    if (value === null || value === undefined) {
      throw new InvalidArgumentError("Value must be defined");
    }
  }

  // Se compara la referencia del constructor (no `constructor.name`) para que
  // la igualdad siga siendo correcta cuando el bundler minifica los nombres.
  public equals(other: ValueObject<T>): boolean {
    if (other.constructor !== this.constructor) return false;
    return this.value instanceof Date && other.value instanceof Date
      ? this.value.getTime() === other.value.getTime()
      : this.value === other.value;
  }

  public toString(): string {
    return this.value.toString();
  }
}

