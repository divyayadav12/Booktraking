import { AuditLog } from '../models';

export interface AuditLogParams {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: any;
}

export async function logAudit(params: AuditLogParams) {
  try {
    await AuditLog.create({
      actorUserId: params.actorUserId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
  }
}
