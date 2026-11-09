import { Uuid } from "./value-object/uuid";

export class DomainEventId extends Uuid {}

export type BoundedContextName =
  | "iam"
  | "commercial"
  | "project-management"
  | "workboard";

export type DomainEventAttributes = Readonly<
  Record<string, string | number | boolean | null>
>;

export type DomainEventParams = {
  readonly boundedContext: BoundedContextName;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly eventId?: string;
  readonly occurredOn?: Date;
};

export abstract class DomainEvent {
  public readonly boundedContext: BoundedContextName;
  public readonly aggregateId: string;
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName: string;

  public constructor(params: DomainEventParams) {
    this.boundedContext = params.boundedContext;
    this.aggregateId = params.aggregateId;
    this.eventId = params.eventId ?? DomainEventId.random().value;
    this.occurredOn = params.occurredOn ?? new Date();
    this.eventName = params.eventName;
  }

  public abstract toPrimitives(): DomainEventAttributes;
}
