import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuditLog } from '../models';
import { successResponse } from '../utils/response';

export async function getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;

    const skip = (page - 1) * limit;

    const query: any = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorUserId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);

    const mapped = logs.map((log: any) => ({
      id: log._id.toString(),
      actorUserId: log.actorUserId?._id?.toString(),
      actorUser: log.actorUserId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return successResponse(res, 'Audit logs retrieved', {
      logs: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}
