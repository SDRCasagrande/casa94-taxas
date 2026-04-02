import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // 1. Overdue tasks (date < today and not completed)
        const overdueTasks = await prisma.task.findMany({
            where: {
                OR: [
                    { createdById: session.userId },
                    { assigneeId: session.userId },
                ],
                completed: false,
                date: { not: "", lt: todayStr },
            },
            select: { id: true, title: true, date: true, listId: true },
            orderBy: { date: "desc" },
            take: 10,
        });

        // 2. Tasks assigned to me (not completed)
        const assignedTasks = await prisma.task.findMany({
            where: {
                assigneeId: session.userId,
                completed: false,
            },
            select: { id: true, title: true, date: true, priority: true, listId: true },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        // 3. Upcoming renegotiations (negotiations with alertDate approaching)
        const negotiations = await prisma.negotiation.findMany({
            where: {
                client: { userId: session.userId },
                status: { in: ["aprovado", "aceita", "fechado"] },
                dateAccept: { not: "" },
            },
            include: { client: { select: { name: true, stoneCode: true } } },
        });

        const renegAlerts = negotiations
            .map(n => {
                if (!n.dateAccept) return null;
                const acceptDate = new Date(n.dateAccept + "T00:00:00");
                const renegDate = new Date(acceptDate);
                renegDate.setDate(renegDate.getDate() + 60);
                const daysLeft = Math.ceil((renegDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (daysLeft > 7) return null;
                return {
                    id: n.id,
                    clientName: n.client.name,
                    stoneCode: n.client.stoneCode,
                    daysLeft,
                    urgency: daysLeft <= 0 ? "critical" : daysLeft <= 3 ? "warning" : "info",
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.daysLeft - b.daysLeft);

        // Build unified alerts
        const alerts: any[] = [];

        for (const t of overdueTasks) {
            alerts.push({
                type: "overdue_task",
                title: t.title,
                subtitle: `Venceu em ${new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}`,
                link: "/dashboard/tarefas",
                urgency: "critical",
                id: t.id,
            });
        }

        for (const r of renegAlerts) {
            if (!r) continue;
            alerts.push({
                type: "renegotiation",
                title: r.clientName,
                subtitle: r.daysLeft <= 0 ? "Renegociação vence HOJE!" : `Renegociação em ${r.daysLeft} dia(s)`,
                link: "/dashboard/clientes",
                urgency: r.urgency,
                id: r.id,
            });
        }

        for (const t of assignedTasks) {
            // Skip if already in overdue
            if (overdueTasks.some(ot => ot.id === t.id)) continue;
            alerts.push({
                type: "assigned_task",
                title: t.title,
                subtitle: t.date ? `Para ${new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}` : "Sem data definida",
                link: "/dashboard/tarefas",
                urgency: t.priority === "high" ? "warning" : "info",
                id: t.id,
            });
        }

        return NextResponse.json({ alerts, count: alerts.length });
    } catch (error) {
        console.error("GET /api/alerts error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
