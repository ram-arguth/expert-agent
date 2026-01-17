/**
 * Audit Logging Service
 *
 * Logs and retrieves audit events for enterprise compliance.
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.2
 */

import { prisma } from "@/lib/db";
import type { AuditAction, AuditLog, Prisma } from "@prisma/client";

// =============================================================================
// Types
// =============================================================================

export interface AuditEventInput {
  userId?: string | null;
  orgId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  errorMessage?: string | null;
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
}

export interface PaginatedAuditLogs {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// Audit Service
// =============================================================================

/**
 * Log an audit event
 */
export async function logAuditEvent(event: AuditEventInput): Promise<AuditLog> {
  return prisma.auditLog.create({
    data: {
      userId: event.userId,
      orgId: event.orgId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      metadata: event.metadata as Prisma.InputJsonValue,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success ?? true,
      errorMessage: event.errorMessage,
    },
  });
}

/**
 * Get audit logs for an organization with filters and pagination
 */
export async function getAuditLogs(
  orgId: string,
  filters: AuditLogFilters = {},
  page = 1,
  pageSize = 50,
): Promise<PaginatedAuditLogs> {
  const where: Prisma.AuditLogWhereInput = {
    orgId,
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.action && { action: filters.action }),
    ...(filters.resourceType && { resourceType: filters.resourceType }),
    ...(filters.success !== undefined && { success: filters.success }),
    ...(filters.startDate || filters.endDate
      ? {
          createdAt: {
            ...(filters.startDate && { gte: filters.startDate }),
            ...(filters.endDate && { lte: filters.endDate }),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Helper to extract request context for audit logging
 */
export function extractRequestContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const userAgent = request.headers.get("user-agent") || null;

  return { ipAddress, userAgent };
}

// Re-export AuditAction for convenience
export { AuditAction } from "@prisma/client";
