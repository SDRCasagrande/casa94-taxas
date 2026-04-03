import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

// PUT update a negotiation (edit rates, dates, status, notes, stage)
export async function PUT(request: Request, { params }: { params: Promise<{ negId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { negId } = await params;

        const neg = await prisma.negotiation.findUnique({ where: { id: negId }, include: { client: true } });
        if (!neg || neg.client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();

        // Track stage transition with timestamp
        let stageHistory = (neg.stageHistory as any[]) || [];
        if (body.status && body.status !== neg.status) {
            stageHistory = [
                ...stageHistory,
                {
                    from: neg.status,
                    to: body.status,
                    timestamp: new Date().toISOString(),
                    userId: session.userId,
                    userName: session.name || "Sistema",
                },
            ];
        }

        // Auto-set dateAccept when moving to 'aprovado'
        const dateAccept = body.status === "aprovado" && !neg.dateAccept
            ? new Date().toISOString().split("T")[0]
            : (body.dateAccept ?? neg.dateAccept);

        const updated = await prisma.negotiation.update({
            where: { id: negId },
            data: {
                dateNeg: body.dateNeg ?? neg.dateNeg,
                dateAccept,
                status: body.status ?? neg.status,
                stageHistory,
                assigneeId: body.assigneeId !== undefined ? (body.assigneeId || null) : neg.assigneeId,
                rates: body.rates ?? neg.rates,
                notes: body.notes ?? neg.notes,
                alertDate: body.alertDate !== undefined ? body.alertDate : neg.alertDate,
                alertSent: body.alertDate !== undefined ? false : neg.alertSent,
            },
            include: {
                assignee: { select: { id: true, name: true, email: true } },
                client: { select: { id: true, name: true, cnpj: true, stoneCode: true, phone: true } },
            },
        });

        // ═══ AUTO-FOLLOWUP: Create task and calendar event when moving to 'aguardando_cliente' ═══
        if (body.status === "aguardando_cliente" && neg.status !== "aguardando_cliente") {
            try {
                const { createCalendarEvent } = await import("@/lib/google-calendar");
                const assigneeId = updated.assigneeId || session.userId;
                    
                let list = await prisma.taskList.findFirst({
                    where: { userId: assigneeId }
                });
                if (!list) {
                    list = await prisma.taskList.create({
                        data: { name: "Prospecção & Follow-up", userId: assigneeId }
                    });
                }

                const fDate = new Date();
                fDate.setDate(fDate.getDate() + 2); // 2 days from now
                const dateStr = fDate.toISOString().split("T")[0];
                const timeStr = "10:00";
                const title = `Follow-up: ${updated.client.name}`;
                const desc = `Cliente: ${updated.client.name}\nContato: ${updated.client.phone || '-'}\nNegociação no estágio: Aguardando Cliente`;

                const task = await prisma.task.create({
                    data: {
                        listId: list.id,
                        title,
                        description: desc,
                        date: dateStr,
                        time: timeStr,
                        assigneeId: assigneeId,
                        createdById: session.userId,
                        priority: "high"
                    }
                });

                const eventId = await createCalendarEvent(assigneeId, {
                    title,
                    description: desc,
                    date: dateStr,
                    time: timeStr
                });

                if (eventId) {
                    await prisma.task.update({
                        where: { id: task.id },
                        data: { googleCalendarEventId: eventId, scheduled: true }
                    });
                }
            } catch (err) {
                console.error("[Auto-FollowUp] Error:", err);
            }
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PUT negotiations error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// DELETE a negotiation
export async function DELETE(request: Request, { params }: { params: Promise<{ negId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { negId } = await params;

        const neg = await prisma.negotiation.findUnique({ where: { id: negId }, include: { client: true } });
        if (!neg || neg.client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Parse reason from body
        let reason = "";
        try { const body = await request.json(); reason = body.reason || ""; } catch { /* no body */ }

        await prisma.negotiation.delete({ where: { id: negId } });

        // Audit log
        await logAudit({
            userId: session.userId,
            userName: session.name || "Sistema",
            action: AUDIT_ACTIONS.DELETE_NEGOTIATION,
            entityType: "negotiation",
            entityId: negId,
            entityName: `${neg.client.name} - ${neg.status}`,
            reason,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("DELETE negotiations error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
