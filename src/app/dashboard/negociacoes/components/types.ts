import { formatPercent, BRAND_PRESETS } from "@/lib/calculator";

export const BRAND_NAMES = Object.keys(BRAND_PRESETS);

export interface BrandRateSet { [brand: string]: { debit: number; credit1x: number; credit2to6: number; credit7to12: number } }
export interface RateSnapshot {
    debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number;
    brandRates?: BrandRateSet; ravTipo?: "automatico" | "pontual"; ravRate?: number; ravPontual?: number; ravTiming?: "md" | "ds" | "du";
    [key: string]: any;
}
export interface Assignee { id: string; name: string; email: string }
export interface Negotiation {
    id: string; dateNeg: string; dateAccept: string;
    status: string; stageHistory?: any[]; assigneeId?: string; assignee?: Assignee | null;
    rates: RateSnapshot; notes: string; alertDate?: string; alertSent?: boolean;
}
export interface Client {
    id: string; name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    createdAt: string; negotiations: Negotiation[];
}
export interface UserOption { id: string; name: string; email: string }

export function defaultBrandRates(): BrandRateSet {
    const br: BrandRateSet = {};
    for (const [name, rates] of Object.entries(BRAND_PRESETS)) br[name] = { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    return br;
}

export function defaultRates(): RateSnapshot {
    return { debit: 0.84, credit1x: 1.86, credit2to6: 2.18, credit7to12: 2.41, pix: 0.00, rav: 1.30, brandRates: defaultBrandRates(), ravTipo: "automatico", ravRate: 1.30, ravPontual: 3.79, ravTiming: "md" };
}

export function today() { return new Date().toISOString().split("T")[0]; }
export function fmtDate(d: string) { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }
export function fmtDateTime(iso: string) { try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } }
export function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(); }

/* ═══ PIPELINE STAGES ═══ */
export const STAGES = [
    { id: "prospeccao", label: "Prospecção", color: "slate", bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/20", dot: "bg-slate-500" },
    { id: "proposta_enviada", label: "Proposta Enviada", color: "blue", bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20", dot: "bg-blue-500" },
    { id: "aguardando_cliente", label: "Aguardando Cliente", color: "amber", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20", dot: "bg-amber-500" },
    { id: "aprovado", label: "Aprovado", color: "emerald", bg: "bg-[#00A868]/10", text: "text-[#00A868]", border: "border-[#00A868]/20", dot: "bg-[#00A868]" },
    { id: "recusado", label: "Recusado", color: "red", bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20", dot: "bg-red-500" },
    { id: "fechado", label: "Fechado", color: "purple", bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/20", dot: "bg-purple-500" },
];
export function getStage(id: string) { return STAGES.find(s => s.id === id) || STAGES[0]; }

export function normalizeStatus(s: string) {
    if (s === "pendente") return "prospeccao";
    if (s === "aceita") return "aprovado";
    if (s === "recusada") return "recusado";
    return s;
}

/* ═══ LEAD AGING ═══ */
export function getLeadAge(neg: { dateNeg: string; stageHistory?: any[] }): { days: number; level: "fresh" | "warm" | "hot" | "cold"; label: string; cssClass: string } {
    const lastAction = neg.stageHistory && neg.stageHistory.length > 0
        ? new Date(neg.stageHistory[neg.stageHistory.length - 1].timestamp)
        : new Date(neg.dateNeg + "T00:00:00");
    const days = Math.floor((Date.now() - lastAction.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 2)  return { days, level: "fresh", label: "", cssClass: "" };
    if (days <= 5)  return { days, level: "warm",  label: `⏰ ${days}d sem ação`, cssClass: "lead-warm" };
    if (days <= 10) return { days, level: "hot",   label: `🔥 Esfriando`,       cssClass: "lead-hot" };
    return                  { days, level: "cold",  label: `❄️ Frio (${days}d)`, cssClass: "lead-cold" };
}

/* ═══ STAGE TRANSITION PROMPTS ═══ */
export const TRANSITION_PROMPTS: Record<string, { emoji: string; message: string; action: string; actionType: "whatsapp" | "task" | "accept" | "reneg" }> = {
    "prospeccao→proposta_enviada":    { emoji: "📤", message: "Proposta enviada!",      action: "Enviar via WhatsApp?",       actionType: "whatsapp" },
    "proposta_enviada→aguardando_cliente": { emoji: "⏳", message: "Aguardando retorno.", action: "Criar lembrete em 2 dias?", actionType: "task" },
    "aguardando_cliente→aprovado":    { emoji: "🎉", message: "Negociação aprovada!",   action: "Registrar data de aceite?",  actionType: "accept" },
    "*→recusado":                     { emoji: "📅", message: "Negociação recusada.",   action: "Reagendar em 30 dias?",      actionType: "reneg" },
};
export function getTransitionPrompt(from: string, to: string) {
    return TRANSITION_PROMPTS[`${from}→${to}`] || TRANSITION_PROMPTS[`*→${to}`] || null;
}

/* ═══ GOOGLE CALENDAR ═══ */
export function gcalLink(neg: { clientName: string; clientPhone?: string; stoneCode?: string; cnpj?: string; dateNeg: string; rates: RateSnapshot; notes?: string; status: string }) {
    const title = `Negociação — ${neg.clientName}`;
    const followUp = new Date();
    followUp.setDate(followUp.getDate() + 3);
    const start = followUp.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const end = new Date(followUp.getTime() + 3600000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    let desc = `Cliente: ${neg.clientName}\n`;
    if (neg.stoneCode) desc += `Stone Code: ${neg.stoneCode}\n`;
    if (neg.cnpj) desc += `CNPJ: ${neg.cnpj}\n`;
    if (neg.clientPhone) desc += `Tel: ${neg.clientPhone}\n`;
    desc += `\nTaxas: Déb ${formatPercent(neg.rates.debit)} | 1x ${formatPercent(neg.rates.credit1x)} | PIX ${formatPercent(neg.rates.pix)}\n`;
    if (neg.notes) desc += `\nObs: ${neg.notes}\n`;
    desc += `\n— BitTask`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(desc)}`;
}

/* ═══ SHARE WHATSAPP ═══ */
export function shareWhatsApp(neg: { clientName: string; stoneCode?: string; cnpj?: string; clientPhone?: string; rates: RateSnapshot; notes?: string }) {
    let txt = `PROPOSTA DE TAXAS — ${neg.clientName}\n`;
    if (neg.stoneCode) txt += `Stone Code: ${neg.stoneCode}\n`;
    if (neg.cnpj) txt += `CNPJ: ${neg.cnpj}\n`;
    txt += `\nTAXAS PROPOSTAS (VISA/MASTER):\n`;
    txt += `Débito: ${formatPercent(neg.rates.debit)} | Crédito 1x: ${formatPercent(neg.rates.credit1x)}\n`;
    txt += `2-6x: ${formatPercent(neg.rates.credit2to6)} | 7-12x: ${formatPercent(neg.rates.credit7to12)}\n`;
    txt += `PIX: ${formatPercent(neg.rates.pix)}\n`;
    txt += `RAV: ${formatPercent(neg.rates.ravRate ?? neg.rates.rav)}\n`;
    if (neg.notes) txt += `\nObs: ${neg.notes}\n`;
    txt += `\n— BitTask`;
    window.open(`https://wa.me/${neg.clientPhone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(txt)}`, "_blank");
}
