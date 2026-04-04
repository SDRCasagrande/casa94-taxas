/**
 * BitTask — Lead Scoring Engine
 * 
 * Calculates a 0-100 score for each client based on:
 * - TPV volume (40 pts)
 * - Fidelity / credential age (20 pts)
 * - Negotiation engagement: number of negotiations (15 pts)
 * - Pipeline health: latest negotiation status (15 pts)
 * - Data completeness: phone, email, cnpj filled (10 pts)
 */

interface MonthVolume {
    tpvDebit: number;
    tpvCredit: number;
    tpvPix: number;
}

interface Negotiation {
    status: string;
    dateNeg: string;
}

interface ClientForScoring {
    name: string;
    cnpj: string;
    phone: string;
    email: string;
    stoneCode: string;
    status: string;
    credentialDate: string;
    safra: string;
    monthlyVolumes: MonthVolume[];
    negotiations: Negotiation[];
}

export interface LeadScoreResult {
    score: number;            // 0-100
    tier: "vip" | "high" | "medium" | "low" | "risk";
    label: string;            // "⭐ VIP", "🔥 Alto Potencial", etc.
    emoji: string;
    color: string;            // CSS class
    breakdown: {
        tpv: number;          // 0-40
        fidelity: number;     // 0-20
        engagement: number;   // 0-15
        pipeline: number;     // 0-15
        completeness: number; // 0-10
    };
}

export function calculateLeadScore(client: ClientForScoring): LeadScoreResult {
    let tpv = 0;
    let fidelity = 0;
    let engagement = 0;
    let pipeline = 0;
    let completeness = 0;

    // ═══ 1. TPV Score (0-40 pts) ═══
    const totalTPV = client.monthlyVolumes.reduce(
        (sum, v) => sum + (v.tpvDebit || 0) + (v.tpvCredit || 0) + (v.tpvPix || 0), 0
    );
    const avgMonthlyTPV = client.monthlyVolumes.length > 0
        ? totalTPV / client.monthlyVolumes.length
        : 0;

    if (avgMonthlyTPV >= 500000) tpv = 40;          // 500k+/mês = max
    else if (avgMonthlyTPV >= 200000) tpv = 35;
    else if (avgMonthlyTPV >= 100000) tpv = 28;
    else if (avgMonthlyTPV >= 50000) tpv = 20;
    else if (avgMonthlyTPV >= 10000) tpv = 12;
    else if (avgMonthlyTPV > 0) tpv = 5;
    else tpv = 0;                                     // No TPV

    // ═══ 2. Fidelity (0-20 pts) ═══
    if (client.credentialDate) {
        const cd = new Date(client.credentialDate + "T00:00:00");
        const monthsSince = (Date.now() - cd.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsSince >= 12) fidelity = 20;         // 1yr+ = loyal
        else if (monthsSince >= 6) fidelity = 15;
        else if (monthsSince >= 3) fidelity = 10;
        else fidelity = 5;                             // Fresh
    }

    // ═══ 3. Engagement (0-15 pts) ═══
    const negCount = client.negotiations.length;
    if (negCount >= 5) engagement = 15;
    else if (negCount >= 3) engagement = 12;
    else if (negCount >= 2) engagement = 8;
    else if (negCount >= 1) engagement = 5;

    // ═══ 4. Pipeline Health (0-15 pts) ═══
    const latestNeg = client.negotiations[0]; // Assuming sorted desc
    if (latestNeg) {
        const statusScores: Record<string, number> = {
            aprovado: 15,
            fechado: 14,
            aguardando_cliente: 10,
            proposta_enviada: 8,
            prospeccao: 5,
            recusado: 2,
        };
        pipeline = statusScores[latestNeg.status] || 3;
    }

    // ═══ 5. Data Completeness (0-10 pts) ═══
    if (client.cnpj) completeness += 3;
    if (client.phone) completeness += 3;
    if (client.email) completeness += 2;
    if (client.stoneCode) completeness += 2;

    const score = Math.min(100, tpv + fidelity + engagement + pipeline + completeness);

    // Penalize canceled clients
    const finalScore = client.status === "cancelado" ? Math.max(0, score - 30) : score;

    // Determine tier
    let tier: LeadScoreResult["tier"];
    let label: string;
    let emoji: string;
    let color: string;

    if (finalScore >= 80) {
        tier = "vip"; label = "VIP"; emoji = "⭐"; color = "text-amber-500 bg-amber-500/10";
    } else if (finalScore >= 60) {
        tier = "high"; label = "Alto Potencial"; emoji = "🔥"; color = "text-[#00A868] bg-[#00A868]/10";
    } else if (finalScore >= 40) {
        tier = "medium"; label = "Regular"; emoji = "📊"; color = "text-blue-500 bg-blue-500/10";
    } else if (finalScore >= 20) {
        tier = "low"; label = "Baixo Engajamento"; emoji = "📉"; color = "text-slate-500 bg-slate-500/10";
    } else {
        tier = "risk"; label = "Risco de Churn"; emoji = "⚠️"; color = "text-red-500 bg-red-500/10";
    }

    return {
        score: finalScore,
        tier,
        label,
        emoji,
        color,
        breakdown: { tpv, fidelity, engagement, pipeline, completeness },
    };
}
