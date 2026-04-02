import { prisma } from "./prisma";

interface AuditEntry {
    userId: string;
    userName: string;
    action: string;
    entityType: string;
    entityId?: string;
    entityName?: string;
    reason?: string;
    metadata?: Record<string, any>;
}

export async function logAudit(entry: AuditEntry) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: entry.userId,
                userName: entry.userName,
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                entityName: entry.entityName,
                reason: entry.reason,
                metadata: entry.metadata,
            },
        });
    } catch (e) {
        console.error("[AUDIT] Failed to log:", e);
    }
}

export const AUDIT_ACTIONS = {
    DELETE_NEGOTIATION: "DELETE_NEGOTIATION",
    DELETE_CLIENT: "DELETE_CLIENT",
    CANCEL_CLIENT: "CANCEL_CLIENT",
    DELETE_USER: "DELETE_USER",
    DELETE_ROLE: "DELETE_ROLE",
    DELETE_TASK: "DELETE_TASK",
    DELETE_TASK_LIST: "DELETE_TASK_LIST",
    DISCONNECT_GCAL: "DISCONNECT_GCAL",
} as const;
