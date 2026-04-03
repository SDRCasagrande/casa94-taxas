import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { askLizze } from "@/lib/gemini";
import { formatPercent } from "@/lib/calculator";

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { question } = await request.json();
        if (!question?.trim()) return NextResponse.json({ error: "Pergunta é obrigatória" }, { status: 400 });

        // ═══ GUARDRAIL: Only answer BitTask-related questions ═══
        const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const bitTaskKeywords = [
            "taxa", "cet", "mdr", "rav", "debito", "credito", "pix",
            "cliente", "carteira", "stone", "ton", "adquirencia", "adquirente",
            "negociacao", "renegoci", "proposta", "pipeline", "prospeccao",
            "tarefa", "equipe", "team", "atribuir", "prazo",
            "tpv", "volume", "comissao", "receita", "faturamento", "meta",
            "safra", "credenciamento", "churn", "risco", "cancelado",
            "comparativ", "simulacao", "simulador", "conversao",
            "bittask", "lizze", "agenda", "calendar", "calendario",
            "import", "csv", "relatorio", "pdf", "whatsapp",
            "sugira", "ajude", "analise", "resuma", "recomend", "melhor", "pior",
            "como", "qual", "quais", "quanto", "quando", "onde", "porque",
        ];
        const isRelated = bitTaskKeywords.some(kw => q.includes(kw)) || q.length <= 15;

        if (!isRelated) {
            return NextResponse.json({
                answer: "🔒 Sou a **Lizze**, assistente exclusiva do **BitTask**. Só posso ajudar com:\n\n• 📊 Análise de taxas, CET e MDR\n• 💼 Gestão de carteira e clientes Stone/Ton\n• 🤝 Estratégias de negociação e renegociação\n• 📋 Tarefas e produtividade da equipe\n• 📈 Métricas, metas e pipeline\n• 💰 Comissões e TPV\n\nReformule sua pergunta sobre a carteira ou negociações! 😊",
                question,
            });
        }

        // Build context from user's actual data
        const clientWhere: any = session.orgId ? { orgId: session.orgId } : { userId: session.userId };
        const negWhere: any = session.orgId ? { client: { orgId: session.orgId } } : { client: { userId: session.userId } };

        const [clients, negotiations, tasks] = await Promise.all([
            prisma.client.findMany({
                where: clientWhere,
                select: { id: true, name: true, stoneCode: true, status: true, brand: true },
                take: 50,
            }),
            prisma.negotiation.findMany({
                where: negWhere,
                include: { client: { select: { name: true, stoneCode: true } } },
                orderBy: { createdAt: "desc" },
                take: 30,
            }),
            prisma.task.count({
                where: {
                    OR: [{ createdById: session.userId }, { assigneeId: session.userId }],
                    completed: false,
                },
            }),
        ]);

        // Summarize portfolio for context
        const activeClients = clients.filter(c => c.status === "ativo").length;
        const totalClients = clients.length;

        // Rate averages
        let rateSum = { debit: 0, credit1x: 0, pix: 0, count: 0 };
        const stageCount: Record<string, number> = {};

        for (const n of negotiations) {
            const r = n.rates as any;
            if (r?.debit) {
                rateSum.debit += r.debit;
                rateSum.credit1x += r.credit1x || 0;
                rateSum.pix += r.pix || 0;
                rateSum.count++;
            }
            stageCount[n.status] = (stageCount[n.status] || 0) + 1;
        }

        const context = `
RESUMO DA CARTEIRA DO AGENTE:
- Total de clientes: ${totalClients} (${activeClients} ativos)
- Negociações: ${negotiations.length} total
- Pipeline: ${Object.entries(stageCount).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Tarefas pendentes: ${tasks}
${rateSum.count > 0 ? `- Taxa média praticada: Débito ${(rateSum.debit / rateSum.count).toFixed(2)}% | Crédito 1x ${(rateSum.credit1x / rateSum.count).toFixed(2)}% | PIX ${(rateSum.pix / rateSum.count).toFixed(2)}%` : ""}

ÚLTIMAS NEGOCIAÇÕES:
${negotiations.slice(0, 10).map(n => {
            const r = n.rates as any;
            return `- ${n.client.name} (SC: ${n.client.stoneCode || "—"}) | Status: ${n.status} | Déb: ${r?.debit ? formatPercent(r.debit) : "—"} | 1x: ${r?.credit1x ? formatPercent(r.credit1x) : "—"}`;
        }).join("\n")}

CLIENTES:
${clients.slice(0, 20).map(c => `- ${c.name} | SC: ${c.stoneCode || "—"} | ${c.status} | ${c.brand || "—"}`).join("\n")}
`.trim();

        const answer = await askLizze(question, context);

        return NextResponse.json({ answer, question });
    } catch (error) {
        console.error("POST /api/ai/chat error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
