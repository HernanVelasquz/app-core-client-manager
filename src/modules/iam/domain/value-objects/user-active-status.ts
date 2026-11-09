import { BooleanValueObject } from "@/shared/kernel";

export class UserActiveStatus extends BooleanValueObject {
  public static active(): UserActiveStatus {
    return new UserActiveStatus(true);
  }

  public static inactive(): UserActiveStatus {
    return new UserActiveStatus(false);
  }

  public isActive(): boolean {
    return this.value;
  }
}

