import { DomainEvent, type DomainEventAttributes } from "@/shared/kernel";

export class UserAuthenticatedDomainEvent extends DomainEvent {
  public static readonly EVENT_NAME = "iam.user_authenticated" as const;

  public constructor(params: {
    readonly aggregateId: string;
    readonly email: string;
    readonly roleName: string;
    readonly eventId?: string;
    readonly occurredOn?: Date;
  }) {
    super({
      boundedContext: "iam",
      eventName: UserAuthenticatedDomainEvent.EVENT_NAME,
      aggregateId: params.aggregateId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.email = params.email;
    this.roleName = params.roleName;
  }

  public readonly email: string;
  public readonly roleName: string;

  public toPrimitives(): DomainEventAttributes {
    return {
      email: this.email,
      roleName: this.roleName,
    };
  }
}

