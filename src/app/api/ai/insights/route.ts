import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface Insight {
    type: "rate_suggestion" | "churn_risk" | "renegotiation_timing" | "opportunity";
    title: string;
    description: string;
    urgency: "high" | "medium" | "low";
    clientName?: string;
    clientId?: string;
    data?: Record<string, any>;
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const insights: Insight[] = [];

        // ═══ 1. RATE SUGGESTIONS — Compare each client's rates to the average ═══
        const approvedNegs = await prisma.negotiation.findMany({
            where: {
                client: { userId: session.userId },
                status: { in: ["aprovado", "aceita", "fechado"] },
            },
            include: { client: { select: { id: true, name: true, stoneCode: true } } },
        });

        if (approvedNegs.length >= 3) {
            // Calculate average rates
            const avgRates = { debit: 0, credit1x: 0, pix: 0 };
            let count = 0;
            for (const n of approvedNegs) {
                const r = n.rates as any;
                if (r?.debit && r?.credit1x) {
                    avgRates.debit += r.debit;
                    avgRates.credit1x += r.credit1x;
                    avgRates.pix += r.pix || 0;
                    count++;
                }
            }
            if (count > 0) {
                avgRates.debit /= count;
                avgRates.credit1x /= count;
                avgRates.pix /= count;

                // Find clients with rates significantly above average (they could renegotiate down)
                for (const n of approvedNegs) {
                    const r = n.rates as any;
                    if (!r?.debit) continue;
                    const debitDiff = r.debit - avgRates.debit;
                    const creditDiff = r.credit1x - avgRates.credit1x;

                    if (debitDiff > 0.15 || creditDiff > 0.25) {
                        insights.push({
                            type: "rate_suggestion",
                            title: `${n.client.name} paga acima da média`,
                            description: `Débito ${r.debit.toFixed(2)}% (média ${avgRates.debit.toFixed(2)}%) · Crédito 1x ${r.credit1x.toFixed(2)}% (média ${avgRates.credit1x.toFixed(2)}%). Considere renegociar para manter o cliente.`,
                            urgency: debitDiff > 0.3 ? "high" : "medium",
                            clientName: n.client.name,
                            clientId: n.client.id,
                            data: {
                                currentDebit: r.debit,
                                avgDebit: avgRates.debit,
                                suggestedDebit: Math.max(avgRates.debit - 0.05, 0.5),
                                currentCredit: r.credit1x,
                                avgCredit: avgRates.credit1x,
                            },
                        });
                    }
                }

                // Also suggest competitive rates for new proposals
                insights.push({
                    type: "rate_suggestion",
                    title: "Taxas competitivas para novas propostas",
                    description: `Baseado nas ${count} negociações aprovadas, sua faixa ideal é: Débito ${(avgRates.debit - 0.05).toFixed(2)}%-${avgRates.debit.toFixed(2)}% · Crédito 1x ${(avgRates.credit1x - 0.1).toFixed(2)}%-${avgRates.credit1x.toFixed(2)}%`,
                    urgency: "low",
                    data: { avgDebit: avgRates.debit, avgCredit: avgRates.credit1x, avgPix: avgRates.pix },
                });
            }
        }

        // ═══ 2. CHURN RISK — Clients that might leave ═══
        const allClients = await prisma.client.findMany({
            where: { userId: session.userId, status: "ativo" },
            include: {
                negotiations: { orderBy: { createdAt: "desc" }, take: 3 },
                monthlyVolumes: { orderBy: { month: "desc" }, take: 3 },
            },
        });

        for (const client of allClients) {
            const riskFactors: string[] = [];
            let riskScore = 0;

            // Factor 1: No activity in last 60 days
            const lastNeg = client.negotiations[0];
            if (lastNeg) {
                const daysSinceNeg = Math.floor((Date.now() - new Date(lastNeg.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceNeg > 90) {
                    riskFactors.push(`Sem atividade há ${daysSinceNeg} dias`);
                    riskScore += 3;
                } else if (daysSinceNeg > 60) {
                    riskFactors.push(`Última interação há ${daysSinceNeg} dias`);
                    riskScore += 2;
                }
            }

            // Factor 2: Rejected negotiations
            const rejectedCount = client.negotiations.filter(n => ["recusado", "recusada"].includes(n.status)).length;
            if (rejectedCount >= 2) {
                riskFactors.push(`${rejectedCount} propostas recusadas`);
                riskScore += 2;
            }

            // Factor 3: Declining TPV
            if (client.monthlyVolumes.length >= 2) {
                const latest = client.monthlyVolumes[0];
                const previous = client.monthlyVolumes[1];
                const latestTPV = (latest as any).tpvDebit + (latest as any).tpvCredit + (latest as any).tpvPix;
                const prevTPV = (previous as any).tpvDebit + (previous as any).tpvCredit + (previous as any).tpvPix;
                if (prevTPV > 0 && latestTPV < prevTPV * 0.7) {
                    riskFactors.push(`TPV caiu ${Math.round((1 - latestTPV / prevTPV) * 100)}% no último mês`);
                    riskScore += 3;
                }
            }

            // Factor 4: No phone/email (hard to reach)
            if (!client.phone && !client.email) {
                riskFactors.push("Sem telefone ou email cadastrado");
                riskScore += 1;
            }

            if (riskScore >= 3) {
                insights.push({
                    type: "churn_risk",
                    title: `⚠️ ${client.name} — Risco de churn`,
                    description: riskFactors.join(" · "),
                    urgency: riskScore >= 5 ? "high" : "medium",
                    clientName: client.name,
                    clientId: client.id,
                    data: { riskScore, factors: riskFactors },
                });
            }
        }

        // ═══ 3. RENEGOTIATION TIMING — Best time to renegotiate ═══
        const now = new Date();
        for (const client of allClients) {
            const approved = client.negotiations.find(n => ["aprovado", "aceita", "fechado"].includes(n.status));
            if (!approved || !approved.dateAccept) continue;

            const acceptDate = new Date(approved.dateAccept + "T00:00:00");
            const daysSinceAccept = Math.floor((now.getTime() - acceptDate.getTime()) / (1000 * 60 * 60 * 24));

            // Optimal window: 45-55 days (before the 60-day renegotiation deadline)
            if (daysSinceAccept >= 45 && daysSinceAccept <= 55) {
                insights.push({
                    type: "renegotiation_timing",
                    title: `🎯 Momento ideal: renegociar ${client.name}`,
                    description: `Proposta aceita há ${daysSinceAccept} dias. A janela ideal de renegociação é agora (45-55 dias), antes do vencimento aos 60 dias.`,
                    urgency: daysSinceAccept >= 50 ? "high" : "medium",
                    clientName: client.name,
                    clientId: client.id,
                    data: { daysSinceAccept, renegDeadline: 60 - daysSinceAccept },
                });
            }
        }

        // ═══ 4. OPPORTUNITIES — Clients without negotiations ═══
        const clientsWithoutNegs = allClients.filter(c => c.negotiations.length === 0);
        if (clientsWithoutNegs.length > 0) {
            insights.push({
                type: "opportunity",
                title: `${clientsWithoutNegs.length} cliente(s) sem proposta`,
                description: `Os clientes ${clientsWithoutNegs.slice(0, 3).map(c => c.name).join(", ")}${clientsWithoutNegs.length > 3 ? ` e mais ${clientsWithoutNegs.length - 3}` : ""} ainda não têm negociação. Oportunidade de primeira proposta!`,
                urgency: "medium",
                data: { count: clientsWithoutNegs.length, clients: clientsWithoutNegs.slice(0, 5).map(c => ({ id: c.id, name: c.name })) },
            });
        }

        // Sort: high urgency first
        const priority = { high: 0, medium: 1, low: 2 };
        insights.sort((a, b) => priority[a.urgency] - priority[b.urgency]);

        return NextResponse.json({ insights, count: insights.length });
    } catch (error) {
        console.error("GET /api/ai/insights error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
