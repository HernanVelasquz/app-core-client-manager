import type {
  BoundedContextName,
  DomainEvent,
  DomainEventAttributes,
} from "./domain-event";

export type DomainEventOutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED";

export type DomainEventOutboxEntry = {
  readonly id: string;
  readonly aggregateId: string;
  readonly boundedContext: BoundedContextName;
  readonly eventName: string;
  readonly payload: DomainEventAttributes;
  readonly occurredOn: string;
  readonly status: DomainEventOutboxStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly processedAt: string | null;
  readonly triggeredByUserId: string | null;
};

export interface EventBus {
  publish(events: readonly DomainEvent[]): Promise<void>;
}

export interface DomainEventOutboxRepository {
  enqueue(
    events: readonly DomainEvent[],
    triggeredByUserId?: string,
  ): Promise<void>;
  findPending(limit: number): Promise<readonly DomainEventOutboxEntry[]>;
  markAsProcessed(eventId: string): Promise<void>;
  markAsFailed(eventId: string, errorMessage: string): Promise<void>;
}
