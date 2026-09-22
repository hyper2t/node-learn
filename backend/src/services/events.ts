import { createRow } from '../db/repo';
import type { AuditEventRow, DomainEventRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { log } from '../log';

/** Outbox-style domain events. Writes are best-effort after the business write (TablesDB has no cross-table tx). */
export async function emitEvent(e: { eventType: string; aggregateType: string; aggregateId: string; actorId: string; payload: unknown; requestId?: string }): Promise<void> {
  try {
    await createRow<DomainEventRow>(TABLES.domainEvents, {
      eventType: e.eventType, aggregateType: e.aggregateType, aggregateId: e.aggregateId, actorId: e.actorId,
      payloadVersion: 1, payloadJson: JSON.stringify(e.payload ?? {}), requestId: e.requestId ?? null, occurredAt: new Date().toISOString(), status: 'pending',
    });
  } catch (err) {
    log('warn', 'domain_event_write_failed', { eventType: e.eventType, message: err instanceof Error ? err.message : String(err) });
  }
}

export async function audit(a: { actorId: string; action: string; resourceType: string; resourceId: string; reason?: string; requestId?: string }): Promise<void> {
  try {
    await createRow<AuditEventRow>(TABLES.auditEvents, { ...a, reason: a.reason ?? null, requestId: a.requestId ?? null });
  } catch (err) {
    log('warn', 'audit_write_failed', { action: a.action });
  }
}
