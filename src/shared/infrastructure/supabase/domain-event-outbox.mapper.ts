import type {
  BoundedContextName,
  DomainEvent,
  DomainEventAttributes,
  DomainEventOutboxEntry,
  DomainEventOutboxStatus,
} from "@/shared/kernel";

export type SysDomainEventRow = {
  readonly id: string;
  readonly aggregate_id: string;
  readonly bounded_context: BoundedContextName;
  readonly event_name: string;
  readonly payload: DomainEventAttributes;
  readonly occurred_on: string;
  readonly status: DomainEventOutboxStatus;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly processed_at: string | null;
  readonly triggered_by_user_id: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
};

export type SysDomainEventInsertRow = {
  readonly id: string;
  readonly aggregate_id: string;
  readonly bounded_context: BoundedContextName;
  readonly event_name: string;
  readonly payload: DomainEventAttributes;
  readonly occurred_on: string;
  readonly status: DomainEventOutboxStatus;
  readonly triggered_by_user_id: string | null;
};

export const domainEventToOutboxInsertRow = (
  event: DomainEvent,
  triggeredByUserId?: string,
): SysDomainEventInsertRow => ({
  id: event.eventId,
  aggregate_id: event.aggregateId,
  bounded_context: event.boundedContext,
  event_name: event.eventName,
  payload: event.toPrimitives(),
  occurred_on: event.occurredOn.toISOString(),
  status: "PENDING",
  triggered_by_user_id: triggeredByUserId ?? null,
});

export const outboxRowToDomainEventEntry = (
  row: SysDomainEventRow,
): DomainEventOutboxEntry => ({
  id: row.id,
  aggregateId: row.aggregate_id,
  boundedContext: row.bounded_context,
  eventName: row.event_name,
  payload: row.payload,
  occurredOn: row.occurred_on,
  status: row.status,
  attempts: row.attempts,
  lastError: row.last_error,
  processedAt: row.processed_at,
  triggeredByUserId: row.triggered_by_user_id,
});

