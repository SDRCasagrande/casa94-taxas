import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const uid = session.userId;
        const clientFilter: any = session.orgId ? { orgId: session.orgId } : { userId: uid };
        const negFilter: any = session.orgId ? { client: { orgId: session.orgId } } : { client: { userId: uid } };

        // Counts
        const totalClients = await prisma.client.count({ where: clientFilter });
        const activeClients = await prisma.client.count({ where: { ...clientFilter, status: "ativo" } });
        const canceledClients = await prisma.client.count({ where: { ...clientFilter, status: "cancelado" } });

        // All negotiations
        const allNegs = await prisma.negotiation.findMany({
            where: negFilter,
            select: { id: true, status: true, rates: true, dateNeg: true, dateAccept: true, stageHistory: true },
        });
        const totalNegotiations = allNegs.length;

        // Pipeline stage counts (handles both legacy and new stages)
        const normalize = (s: string) => {
            if (s === "pendente") return "proposta_enviada";
            if (s === "aceita") return "aprovado";
            // Keep retention statuses as-is — they go into their own pipeline slots
            return s;
        };
        const pipeline: Record<string, number> = {
            prospeccao: 0, proposta_enviada: 0, aguardando_cliente: 0,
            aprovado: 0, recusado: 0, fechado: 0,
            analise: 0, proposta_retencao: 0, aplicada: 0, recusada: 0,
        };
        allNegs.forEach(n => {
            const stage = normalize(n.status);
            if (pipeline[stage] !== undefined) pipeline[stage]++;
            else pipeline[stage] = (pipeline[stage] || 0) + 1;
        });

        // Legacy compat counts
        const pendingNeg = pipeline.proposta_enviada + pipeline.aguardando_cliente + pipeline.prospeccao + (pipeline.analise || 0) + (pipeline.proposta_retencao || 0);
        const acceptedNeg = pipeline.aprovado + pipeline.fechado + (pipeline.aplicada || 0);
        const rejectedNeg = pipeline.recusado + (pipeline.recusada || 0);
        const conversionRate = totalNegotiations > 0 ? (acceptedNeg / totalNegotiations) * 100 : 0;

        // Average rates from accepted/approved negotiations
        const approvedNegs = allNegs.filter(n => ["aceita", "aprovado", "fechado", "aplicada"].includes(n.status));
        let avgRates = { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, pix: 0, rav: 0 };
        if (approvedNegs.length > 0) {
            const sum = { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, pix: 0, rav: 0 };
            for (const n of approvedNegs) {
                const r = n.rates as Record<string, number>;
                sum.debit += r.debit || 0;
                sum.credit1x += r.credit1x || 0;
                sum.credit2to6 += r.credit2to6 || 0;
                sum.credit7to12 += r.credit7to12 || 0;
                sum.pix += r.pix || 0;
                sum.rav += r.rav || 0;
            }
            const count = approvedNegs.length;
            avgRates = {
                debit: sum.debit / count, credit1x: sum.credit1x / count,
                credit2to6: sum.credit2to6 / count, credit7to12: sum.credit7to12 / count,
                pix: sum.pix / count, rav: sum.rav / count,
            };
        }

        // Recent clients with last negotiation
        const recentClients = await prisma.client.findMany({
            where: clientFilter,
            include: { negotiations: { orderBy: { createdAt: "desc" }, take: 1 } },
            orderBy: { createdAt: "desc" },
            take: 6,
        });



        // TPV portfolio — last 4 months (including current)
        const now = new Date();
        const months = Array.from({ length: 4 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }).reverse(); // chronological [oldest ... current]
        
        let tpvTotal = 0, revenueTotal = 0, agentCommission = 0;
        const currentMonth = months[3];
        const historicalPortfolio = months.map(m => ({ month: m, tpvTotal: 0, revenueTotal: 0, agentCommission: 0 }));

        try {
            const historicalVolumes = await prisma.clientMonth.findMany({
                where: { client: clientFilter, month: { in: months } },
            });
            historicalVolumes.forEach(v => {
                const tpv = v.tpvDebit + v.tpvCredit + v.tpvPix;
                const rev = (v.tpvDebit * v.rateDebit / 100) + (v.tpvCredit * v.rateCredit / 100) + (v.tpvPix * v.ratePix / 100);
                
                const histIdx = historicalPortfolio.findIndex(h => h.month === v.month);
                if (histIdx !== -1) {
                    historicalPortfolio[histIdx].tpvTotal += tpv;
                    historicalPortfolio[histIdx].revenueTotal += rev;
                    historicalPortfolio[histIdx].agentCommission += rev * 0.30 * 0.10;
                }

                if (v.month === currentMonth) {
                    tpvTotal += tpv;
                    revenueTotal += rev;
                    agentCommission += rev * 0.30 * 0.10;
                }
            });
        } catch { /* clientMonth table may not exist yet */ }

        // Upcoming renegotiations (60-day deadline from dateAccept)
        const RENEG_DAYS = 60;
        const acceptedNegsAll = await prisma.negotiation.findMany({
            where: {
                client: clientFilter,
                status: { in: ["aceita", "aprovado"] },
                dateAccept: { not: "" },
            },
            include: { client: { select: { id: true, name: true, stoneCode: true } } },
            orderBy: { dateAccept: "asc" },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingRenegotiations = acceptedNegsAll
            .map((neg) => {
                const acceptDate = new Date(neg.dateAccept);
                if (isNaN(acceptDate.getTime())) return null;
                const renegDate = new Date(acceptDate);
                renegDate.setDate(renegDate.getDate() + RENEG_DAYS);
                renegDate.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((renegDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysLeft > 7) return null;
                return {
                    negId: neg.id, clientId: neg.client.id, clientName: neg.client.name,
                    stoneCode: neg.client.stoneCode, dateAccept: neg.dateAccept,
                    renegDate: renegDate.toISOString().split("T")[0], daysLeft,
                };
            })
            .filter(Boolean)
            .sort((a, b) => (a!.daysLeft - b!.daysLeft));

        // Monthly credentialing count — clients credentialed this month
        const allClients = await prisma.client.findMany({
            where: clientFilter,
            select: { credentialDate: true },
        });
        const monthlyCredentialings = allClients.filter(c => {
            if (!c.credentialDate) return false;
            try {
                return c.credentialDate.startsWith(currentMonth);
            } catch { return false; }
        }).length;

        // Pending tasks for this user
        let pendingTasks = 0;
        try {
            pendingTasks = await prisma.task.count({
                where: {
                    OR: [
                        { createdById: uid },
                        { assigneeId: uid },
                    ],
                    completed: false,
                },
            });
        } catch { /* */ }

        // Average time per stage (days) from stageHistory
        const avgTimePerStage: Record<string, number> = {};
        const stageDurations: Record<string, number[]> = {};
        for (const neg of allNegs) {
            const history = (neg.stageHistory as any[]) || [];
            for (let i = 0; i < history.length - 1; i++) {
                const stage = history[i].stage;
                const from = new Date(history[i].date);
                const to = new Date(history[i + 1].date);
                const days = Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
                if (!stageDurations[stage]) stageDurations[stage] = [];
                stageDurations[stage].push(days);
            }
        }
        for (const [stage, durations] of Object.entries(stageDurations)) {
            avgTimePerStage[stage] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10;
        }

        const response = NextResponse.json({
            totalClients, activeClients, canceledClients,
            totalNegotiations, pendingNeg, acceptedNeg, rejectedNeg, conversionRate,
            pipeline, avgRates, recentClients, upcomingRenegotiations,
            pendingTasks, monthlyCredentialings, avgTimePerStage,
            portfolio: { tpvTotal, revenueTotal, agentCommission, month: currentMonth },
            historicalPortfolio,
        });

        // Cache for 60 seconds to reduce DB load on repeated visits
        response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
        return response;
    } catch (error) {
        console.error("GET /api/metrics error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
