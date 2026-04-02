import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// POST add negotiation to a client
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        // Verify ownership (org-level or user-level)
        const clientWhere: any = { id };
        if (session.orgId) clientWhere.orgId = session.orgId;
        else clientWhere.userId = session.userId;
        const client = await prisma.client.findFirst({ where: clientWhere });
        if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const status = body.status || (body.dateAccept ? "aceita" : "prospeccao");

        const negotiation = await prisma.negotiation.create({
            data: {
                clientId: id,
                dateNeg: body.dateNeg || new Date().toISOString().split("T")[0],
                dateAccept: body.dateAccept || (status === "aprovado" ? new Date().toISOString().split("T")[0] : ""),
                status,
                rates: body.rates || {},
                notes: body.notes || "",
                alertDate: body.alertDate || "",
                assigneeId: body.assigneeId || null,
                stageHistory: [{ from: "", to: status, timestamp: new Date().toISOString(), userName: session.name || "Sistema" }],
            },
            include: { assignee: { select: { id: true, name: true, email: true } } },
        });

        // Auto-create task if requested
        if (body.createTask) {
            const assigneeId = body.taskAssigneeId || body.assigneeId || null;
            const statusLabels: Record<string, string> = {
                prospeccao: "Prospecção", proposta_enviada: "Proposta Enviada",
                aguardando_cliente: "Aguardando Cliente", aprovado: "Aprovado",
                recusado: "Recusado", fechado: "Fechado",
            };
            const stLabel = statusLabels[status] || status;

            // Find or create a default list for the current user
            let list = await prisma.taskList.findFirst({
                where: { userId: session.userId },
                orderBy: { createdAt: "asc" },
            });
            if (!list) {
                list = await prisma.taskList.create({
                    data: { name: "Minhas Tarefas", userId: session.userId, orgId: session.orgId || null },
                });
            }

            const rates = body.rates || {};
            const taskTitle = `📋 Renegociação — ${client.name} [${stLabel}]`;
            const taskDesc = [
                `Cliente: ${client.name}`,
                client.stoneCode ? `Stone Code: ${client.stoneCode}` : "",
                client.cnpj ? `CNPJ: ${client.cnpj}` : "",
                `Taxas: Déb ${rates.debit || 0}% | 1x ${rates.credit1x || 0}% | PIX ${rates.pix || 0}%`,
                body.notes ? `Obs: ${body.notes}` : "",
                `\n— Criado automaticamente pelo BitTask`,
            ].filter(Boolean).join("\n");

            await prisma.task.create({
                data: {
                    title: taskTitle,
                    description: taskDesc,
                    date: body.alertDate || body.dateNeg || "",
                    time: "",
                    priority: status === "aprovado" ? "high" : "medium",
                    listId: list.id,
                    createdById: session.userId,
                    assigneeId,
                },
            });
        }

        return NextResponse.json(negotiation, { status: 201 });
    } catch (error) {
        console.error("POST negotiations error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
