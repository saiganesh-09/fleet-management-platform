import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

interface AuditInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Writes an audit log entry. Never throws — auditing must not break business logic. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        oldValue: input.oldValue === undefined ? Prisma.JsonNull : (input.oldValue as Prisma.InputJsonValue),
        newValue: input.newValue === undefined ? Prisma.JsonNull : (input.newValue as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    console.error('audit log failed', err);
  }
}
