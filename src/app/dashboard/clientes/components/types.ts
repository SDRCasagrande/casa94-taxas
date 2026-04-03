import { formatPercent, calculateCET } from "@/lib/calculator";
import { CheckCircle, XCircle } from "lucide-react";

/* ═══ TYPES ═══ */
export interface MonthVolume { id: string; month: string; tpvDebit: number; tpvCredit: number; tpvPix: number; rateDebit: number; rateCredit: number; ratePix: number; notes: string }
export interface Negotiation { id: string; dateNeg: string; dateAccept: string; status: string; rates: any; notes: string; stageHistory?: any[]; assignee?: { id: string; name: string } | null }
export interface Client {
    id: string; name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    brand: string; safra: string;
    status: string; credentialDate: string; cancelDate: string; segment: string;
    createdAt: string; negotiations: Negotiation[]; monthlyVolumes: MonthVolume[];
}

/* ═══ HELPERS ═══ */
export function fmtDate(d: string) { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }
export function fmtMoney(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function fmtMonth(m: string) { if (!m) return "—"; const [y, mo] = m.split("-"); const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; return `${months[parseInt(mo) - 1]} ${y}`; }
export function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
export function daysBetween(d1: string, d2?: string) { const a = new Date(d1); const b = d2 ? new Date(d2) : new Date(); return Math.floor((b.getTime() - a.getTime()) / 86400000); }

/* Commission calc */
export function calcCommission(vol: MonthVolume) {
    const revDebit = vol.tpvDebit * (vol.rateDebit / 100);
    const revCredit = vol.tpvCredit * (vol.rateCredit / 100);
    const revPix = vol.tpvPix * (vol.ratePix / 100);
    const totalRevenue = revDebit + revCredit + revPix;
    const franchise = totalRevenue * 0.30;
    const agent = franchise * 0.10;
    return { totalRevenue, franchise, agent, tpvTotal: vol.tpvDebit + vol.tpvCredit + vol.tpvPix };
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
        txt += `  Crédito: ${fmtMoney(cm.tpvCredit)}\n`;
        txt += `  PIX: ${fmtMoney(cm.tpvPix)}\n`;
        txt += `\nReceita de Taxas: ${fmtMoney(comm.totalRevenue)}\n`;
        txt += `Comissão Franquia (30%): ${fmtMoney(comm.franchise)}\n`;
        txt += `Comissão Agente (10%): ${fmtMoney(comm.agent)}\n`;
    }
    txt += `\n— BitTask`;
    window.open(`https://wa.me/${c.phone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(txt)}`, "_blank");
}
