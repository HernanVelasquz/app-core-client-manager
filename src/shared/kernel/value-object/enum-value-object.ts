export abstract class EnumValueObject<T> {
  public constructor(
    public readonly value: T,
    public readonly validValues: readonly T[],
  ) {
    this.checkValueIsValid(value);
  }

  public checkValueIsValid(value: T): void {
    if (!this.validValues.includes(value)) {
      this.throwErrorForInvalidValue(value);
    }
  }

  protected abstract throwErrorForInvalidValue(value: T): void;
}

