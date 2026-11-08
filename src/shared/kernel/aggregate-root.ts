import type { DomainEvent } from "./domain-event";

export abstract class AggregateRoot<TPrimitives extends object> {
  private domainEvents: DomainEvent[] = [];

  public pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents.slice();
    this.domainEvents = [];
    return events;
  }

  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public abstract toPrimitives(): TPrimitives;
}

