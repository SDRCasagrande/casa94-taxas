import { formatPercent, calculateCET } from "@/lib/calculator";
import { CheckCircle, XCircle } from "lucide-react";

/* ═══ TYPES ═══ */
export interface MonthVolume {
    id: string; month: string;
    tpvDebit: number; tpvCredit: number; tpvCredit2to6?: number; tpvCredit7to12?: number; tpvPix: number;
    rateDebit: number; rateCredit: number; rateCredit2to6?: number; rateCredit7to12?: number; ratePix: number; rateRav?: number;
    notes: string;
}
export interface Negotiation { id: string; dateNeg: string; dateAccept: string; status: string; rates: any; notes: string; stageHistory?: any[]; assignee?: { id: string; name: string } | null }
export interface Client {
    id: string; name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    brand: string; safra: string; category: string;
    status: string; credentialDate: string; cancelDate: string; segment: string;
    createdAt: string; negotiations: Negotiation[]; monthlyVolumes: MonthVolume[];
    user?: { id: string; name: string; position: string };
    targetTpv?: number; 
    fallbackRates?: any;
}

/* ═══ HELPERS ═══ */
export function fmtDate(d: string) { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }
export function fmtMoney(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function fmtMonth(m: string) { if (!m) return "—"; const [y, mo] = m.split("-"); const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; return `${months[parseInt(mo) - 1]} ${y}`; }
export function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
export function daysBetween(d1: string, d2?: string) { const a = new Date(d1); const b = d2 ? new Date(d2) : new Date(); return Math.floor((b.getTime() - a.getTime()) / 86400000); }

/* Commission calc — detailed breakdown */
export interface CommissionBreakdown {
    lines: { label: string; volume: number; rate: number; revenue: number; isRav?: boolean }[];
    totalRevenue: number;
    franchise: number;
    agent: number;
    tpvTotal: number;
}

export function calcCommission(vol: MonthVolume): CommissionBreakdown {
    const lines: CommissionBreakdown["lines"] = [];
    const tpvC2 = vol.tpvCredit2to6 || 0;
    const tpvC7 = vol.tpvCredit7to12 || 0;
    const rateC2 = vol.rateCredit2to6 || vol.rateCredit || 0;
    const rateC7 = vol.rateCredit7to12 || vol.rateCredit || 0;
    const rav = vol.rateRav || 0;

    // Débito
    const revDebit = vol.tpvDebit * (vol.rateDebit / 100);
    if (vol.tpvDebit > 0) lines.push({ label: "Débito", volume: vol.tpvDebit, rate: vol.rateDebit, revenue: revDebit });

    // Crédito à vista (1x)
    const revCredit = vol.tpvCredit * (vol.rateCredit / 100);
    if (vol.tpvCredit > 0) lines.push({ label: "Créd 1x", volume: vol.tpvCredit, rate: vol.rateCredit, revenue: revCredit });

    // Crédito parcelado 2-6x
    const revC2 = tpvC2 * (rateC2 / 100);
    if (tpvC2 > 0) lines.push({ label: "Créd 2-6x", volume: tpvC2, rate: rateC2, revenue: revC2 });
    const ravC2 = tpvC2 * (rav / 100);
    if (tpvC2 > 0 && rav > 0) lines.push({ label: "+ RAV 2-6x", volume: tpvC2, rate: rav, revenue: ravC2, isRav: true });

    // Crédito parcelado 7-12x
    const revC7 = tpvC7 * (rateC7 / 100);
    if (tpvC7 > 0) lines.push({ label: "Créd 7-12x", volume: tpvC7, rate: rateC7, revenue: revC7 });
    const ravC7 = tpvC7 * (rav / 100);
    if (tpvC7 > 0 && rav > 0) lines.push({ label: "+ RAV 7-12x", volume: tpvC7, rate: rav, revenue: ravC7, isRav: true });

    // PIX
    const revPix = vol.tpvPix * (vol.ratePix / 100);
    if (vol.tpvPix > 0) lines.push({ label: "PIX", volume: vol.tpvPix, rate: vol.ratePix, revenue: revPix });

    const totalRevenue = revDebit + revCredit + revC2 + ravC2 + revC7 + ravC7 + revPix;
    const franchise = totalRevenue * 0.30;
    const agent = franchise * 0.10;
    const tpvTotal = vol.tpvDebit + vol.tpvCredit + tpvC2 + tpvC7 + vol.tpvPix;
    return { lines, totalRevenue, franchise, agent, tpvTotal };
}

export function calcClientTotalCommission(volumes: MonthVolume[]) {
    return volumes.reduce((acc, v) => { const c = calcCommission(v); return { totalRevenue: acc.totalRevenue + c.totalRevenue, franchise: acc.franchise + c.franchise, agent: acc.agent + c.agent, tpvTotal: acc.tpvTotal + c.tpvTotal }; }, { totalRevenue: 0, franchise: 0, agent: 0, tpvTotal: 0 });
}

export function calcSafra(credDate: string): string {
    if (!credDate) return "M0";
    const cd = new Date(credDate + "T00:00:00");
    const now = new Date();
    const diff = (now.getFullYear() - cd.getFullYear()) * 12 + (now.getMonth() - cd.getMonth());
    if (diff <= 0) return "M0";
    if (diff === 1) return "M1";
    if (diff === 2) return "M2";
    if (diff === 3) return "M3";
    return "BASE";
}

export function shareWhatsApp(c: Client) {
    const cm = c.monthlyVolumes.find(v => v.month === currentMonth());
    let txt = `RELATÓRIO MENSAL — ${c.name}\n`;
    if (c.stoneCode) txt += `Stone Code: ${c.stoneCode}\n`;
    if (c.cnpj) txt += `CNPJ: ${c.cnpj}\n`;
    if (cm) {
        const comm = calcCommission(cm);
        txt += `\nMÊS: ${fmtMonth(cm.month)}\n`;
        txt += `TPV Total: ${fmtMoney(comm.tpvTotal)}\n`;
        txt += `  Débito: ${fmtMoney(cm.tpvDebit)}\n`;
        txt += `  Crédito: ${fmtMoney(cm.tpvCredit + (cm.tpvCredit2to6 || 0) + (cm.tpvCredit7to12 || 0))}\n`;
        txt += `  PIX: ${fmtMoney(cm.tpvPix)}\n`;
        txt += `\nReceita de Taxas: ${fmtMoney(comm.totalRevenue)}\n`;
        txt += `Comissão Franquia (30%): ${fmtMoney(comm.franchise)}\n`;
        txt += `Comissão Agente (10%): ${fmtMoney(comm.agent)}\n`;
    }
    txt += `\n— BitTask`;
    window.open(`https://wa.me/${c.phone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(txt)}`, "_blank");
}
