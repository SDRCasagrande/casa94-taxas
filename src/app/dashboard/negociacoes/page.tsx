"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatPercent, calculateCET, BRAND_PRESETS, type BrandRates } from "@/lib/calculator";
import { RI } from "@/components/rate-input";
import { formatarDocumento, validarDocumento } from "@/lib/documento";
import { DocumentInput } from "@/components/DocumentInput";
import { PhoneInput } from "@/components/PhoneInput";
import {
    Handshake, Plus, X, ChevronLeft, LayoutGrid, List, Search,
    Calendar, CalendarPlus, CalendarDays, MessageSquare, Clock, User, Trash2, CheckCircle,
    AlertCircle, Loader2, ExternalLink, GripVertical, ArrowRight, FileDown,
    Flame, Snowflake, Timer
} from "lucide-react";
import { generateProposalPDF } from "@/lib/proposal-pdf";
import { BrandIcon } from "@/components/BrandIcons";
import { useConfirm } from "@/components/ConfirmModal";
import { BrandStrip, BrandSelectorModal } from "@/components/BrandSelectorModal";
import SlideDrawer from "@/components/SlideDrawer";

const BRAND_NAMES = Object.keys(BRAND_PRESETS);
interface BrandRateSet { [brand: string]: { debit: number; credit1x: number; credit2to6: number; credit7to12: number } }
interface RateSnapshot {
    debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number;
    brandRates?: BrandRateSet; ravTipo?: "automatico" | "pontual"; ravRate?: number; ravPontual?: number; ravTiming?: "md" | "ds" | "du";
}
function defaultBrandRates(): BrandRateSet {
    const br: BrandRateSet = {};
    for (const [name, rates] of Object.entries(BRAND_PRESETS)) br[name] = { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    return br;
}
interface Assignee { id: string; name: string; email: string }
interface Negotiation {
    id: string; dateNeg: string; dateAccept: string;
    status: string; stageHistory?: any[]; assigneeId?: string; assignee?: Assignee | null;
    rates: RateSnapshot; notes: string; alertDate?: string; alertSent?: boolean;
}
interface Client {
    id: string; name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    createdAt: string; negotiations: Negotiation[];
}
interface UserOption { id: string; name: string; email: string }

function defaultRates(): RateSnapshot {
    return { debit: 0.84, credit1x: 1.86, credit2to6: 2.18, credit7to12: 2.41, pix: 0.00, rav: 1.30, brandRates: defaultBrandRates(), ravTipo: "automatico", ravRate: 1.30, ravPontual: 3.79, ravTiming: "md" };
}
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }
function fmtDateTime(iso: string) { try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } }
function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(); }

/* ═══ LEAD AGING ═══ */
function getLeadAge(neg: { dateNeg: string; stageHistory?: any[] }): { days: number; level: "fresh" | "warm" | "hot" | "cold"; label: string; cssClass: string } {
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
const TRANSITION_PROMPTS: Record<string, { emoji: string; message: string; action: string; actionType: "whatsapp" | "task" | "accept" | "reneg" }> = {
    "prospeccao→proposta_enviada":    { emoji: "📤", message: "Proposta enviada!",      action: "Enviar via WhatsApp?",       actionType: "whatsapp" },
    "proposta_enviada→aguardando_cliente": { emoji: "⏳", message: "Aguardando retorno.", action: "Criar lembrete em 2 dias?", actionType: "task" },
    "aguardando_cliente→aprovado":    { emoji: "🎉", message: "Negociação aprovada!",   action: "Registrar data de aceite?",  actionType: "accept" },
    "*→recusado":                     { emoji: "📅", message: "Negociação recusada.",   action: "Reagendar em 30 dias?",      actionType: "reneg" },
};
function getTransitionPrompt(from: string, to: string) {
    return TRANSITION_PROMPTS[`${from}→${to}`] || TRANSITION_PROMPTS[`*→${to}`] || null;
}

/* ═══ GOOGLE CALENDAR ═══ */
function gcalLink(neg: { clientName: string; clientPhone?: string; stoneCode?: string; cnpj?: string; dateNeg: string; rates: RateSnapshot; notes?: string; status: string }) {
    const title = `Negociação — ${neg.clientName}`;
    // Schedule follow-up for 3 days from now or use negotiation date
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

/* ═══ PIPELINE STAGES ═══ */
const STAGES = [
    { id: "prospeccao", label: "Prospecção", color: "slate", bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/20", dot: "bg-slate-500" },
    { id: "proposta_enviada", label: "Proposta Enviada", color: "blue", bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20", dot: "bg-blue-500" },
    { id: "aguardando_cliente", label: "Aguardando Cliente", color: "amber", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20", dot: "bg-amber-500" },
    { id: "aprovado", label: "Aprovado", color: "emerald", bg: "bg-[#00A868]/10", text: "text-[#00A868]", border: "border-[#00A868]/20", dot: "bg-[#00A868]" },
    { id: "recusado", label: "Recusado", color: "red", bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20", dot: "bg-red-500" },
    { id: "fechado", label: "Fechado", color: "purple", bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/20", dot: "bg-purple-500" },
];
function getStage(id: string) { return STAGES.find(s => s.id === id) || STAGES[0]; }

// Map old statuses to new
function normalizeStatus(s: string) {
    if (s === "pendente") return "prospeccao";
    if (s === "aceita") return "aprovado";
    if (s === "recusada") return "recusado";
    return s;
}

/* ═══ STATUS BADGE ═══ */
function StageBadge({ status }: { status: string }) {
    const st = getStage(normalizeStatus(status));
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
        </span>
    );
}

/* ═══ RATES FORM (simplified for Kanban modal) ═══ */
function RatesForm({ rates, set }: { rates: RateSnapshot; set: (r: RateSnapshot) => void }) {
    const [activeBrand, setActiveBrand] = useState("VISA/MASTER");
    const [showBrandModal, setShowBrandModal] = useState(false);
    const [enabledBrands, setEnabledBrands] = useState<Record<string, boolean>>(() => {
        const eb: Record<string, boolean> = {};
        Object.keys(rates.brandRates || defaultBrandRates()).forEach(b => eb[b] = ["VISA/MASTER", "ELO"].includes(b));
        return eb;
    });
    const br = rates.brandRates || defaultBrandRates();
    const cb = br[activeBrand] || { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    function up(f: string, v: number) { const n = { ...br, [activeBrand]: { ...cb, [f]: v } }; const vm = n["VISA/MASTER"] || cb; set({ ...rates, brandRates: n, debit: vm.debit, credit1x: vm.credit1x, credit2to6: vm.credit2to6, credit7to12: vm.credit7to12 }); }

    function handleBrandClick(b: string) {
        const isEnabled = enabledBrands[b] !== false;
        if (isEnabled) {
            // If it's the active brand, deactivate it and select next
            if (activeBrand === b) {
                setEnabledBrands(prev => ({ ...prev, [b]: false }));
                const next = Object.keys(br).find(k => k !== b && enabledBrands[k] !== false);
                if (next) setActiveBrand(next);
            } else {
                // Just select it as active
                setActiveBrand(b);
            }
        } else {
            // Enable and select
            setEnabledBrands(prev => ({ ...prev, [b]: true }));
            setActiveBrand(b);
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] text-muted-foreground font-medium">Bandeiras Ativas</span>
                <button type="button" onClick={() => setShowBrandModal(true)}
                    className="text-[10px] font-bold text-[#00A868] hover:text-[#008f58] transition-colors">
                    + Gerenciar
                </button>
            </div>
            
            {showBrandModal && (
                <BrandSelectorModal
                    brands={Object.keys(br)}
                    enabledBrands={enabledBrands}
                    activeBrand={activeBrand}
                    onToggle={(b, enabled) => setEnabledBrands(prev => ({ ...prev, [b]: enabled }))}
                    onSelect={setActiveBrand}
                    onClose={() => setShowBrandModal(false)}
                />
            )}

            <div className="space-y-1.5">
                {Object.keys(br).map(b => {
                    const isEnabled = enabledBrands[b] !== false;
                    const isSelected = activeBrand === b && isEnabled;
                    const bRates = br[b];
                    return (
                        <div key={b} className={`rounded-xl transition-all overflow-hidden ${
                            isSelected
                                ? "bg-[#00A868]/5 border-2 border-[#00A868] shadow-sm shadow-[#00A868]/10"
                                : isEnabled
                                    ? "bg-[#00A868]/5 border border-[#00A868]/20"
                                    : "bg-secondary/30 border border-border/50"
                        }`}>
                            <div className="flex items-center gap-0 px-1.5 py-1.5">
                                {/* Toggle ✓/✗ */}
                                <button type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isEnabled) {
                                            setEnabledBrands(prev => ({ ...prev, [b]: false }));
                                            if (activeBrand === b) {
                                                const next = Object.keys(br).find(k => k !== b && enabledBrands[k] !== false);
                                                if (next) setActiveBrand(next);
                                            }
                                        } else {
                                            setEnabledBrands(prev => ({ ...prev, [b]: true }));
                                            setActiveBrand(b);
                                        }
                                    }}
                                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold transition-all ${
                                        isEnabled
                                            ? "bg-[#00A868] text-white shadow-sm shadow-[#00A868]/30"
                                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    }`}>
                                    {isEnabled ? "✓" : "✗"}
                                </button>
                                {/* Brand info */}
                                <button type="button"
                                    onClick={() => { if (isEnabled) setActiveBrand(isSelected ? "" : b); }}
                                    className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${isEnabled ? "hover:bg-[#00A868]/5 cursor-pointer" : "cursor-default"}`}>
                                    <BrandIcon brand={b} size={14} />
                                    <span className={`text-xs font-bold truncate ${isEnabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>{b}</span>
                                </button>
                            </div>
                            
                            {/* Accordion content */}
                            {isSelected && (
                                <div className="p-3 bg-card/60 border-t border-[#00A868]/20 space-y-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <RI l="Débito" v={bRates.debit} set={v => up("debit", v)} />
                                        <RI l="Crédito 1x" v={bRates.credit1x} set={v => up("credit1x", v)} />
                                        <RI l="2-6x" v={bRates.credit2to6} set={v => up("credit2to6", v)} />
                                        <RI l="7-12x" v={bRates.credit7to12} set={v => up("credit7to12", v)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                                        <RI l="PIX" v={rates.pix} set={v => set({ ...rates, pix: v })} />
                                        <RI l="RAV" v={rates.ravRate ?? rates.rav} set={v => set({ ...rates, ravRate: v, rav: v })} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══ MAIN COMPONENT ═══ */
export default function NegociacoesPage() {
    const confirmAction = useConfirm();
    const [clients, setClients] = useState<Client[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<"board" | "list" | "detail" | "new">("board");
    const [selId, setSelId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "all">("month");
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);
    const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
    const CARDS_LIMIT = 10;
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    // Stage Transition Toast
    const [stageToast, setStageToast] = useState<{ negId: string; neg: any; from: string; to: string; prompt: typeof TRANSITION_PROMPTS[string] } | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // SlideDrawer
    const [drawerNeg, setDrawerNeg] = useState<any | null>(null);
    const [editingRates, setEditingRates] = useState(false);
    const [drawerRates, setDrawerRates] = useState<RateSnapshot | null>(null);
    const [savingRates, setSavingRates] = useState(false);

    // New client form
    const [fn, setFN] = useState(""); const [fsc, setFSC] = useState(""); const [fcnpj, setFCNPJ] = useState("");
    const [fph, setFPH] = useState(""); const [fem, setFEM] = useState("");
    const [fDocMsg, setFDocMsg] = useState(""); const [fDocOk, setFDocOk] = useState<boolean | null>(null);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [fRates, setFRates] = useState<RateSnapshot>(defaultRates());
    const [fDateN, setFDateN] = useState(today()); const [fNotes, setFNotes] = useState("");
    const [fAssignee, setFAssignee] = useState("");

    const loadAll = useCallback(async () => {
        try {
            const [cRes, uRes] = await Promise.all([fetch("/api/clients"), fetch("/api/admin/users")]);
            const cData = await cRes.json(); const uData = await uRes.json();
            if (Array.isArray(cData)) setClients(cData);
            if (Array.isArray(uData)) setUsers(uData.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
        } catch { /* */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Auto-archive old negotiations on first load
    useEffect(() => {
        fetch("/api/negotiations/archive", { method: "POST" }).then(r => r.json()).then(d => {
            if (d.archived > 0) loadAll();
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // All negotiations flat (exclude archived from pipeline)
    const allNegs = clients.flatMap(c => c.negotiations.filter(n => n.status !== "arquivado").map(n => ({ ...n, clientName: c.name, clientId: c.id, cnpj: c.cnpj, stoneCode: c.stoneCode, clientPhone: c.phone })));

    // Time filter
    const timeFiltered = (() => {
        if (timeFilter === "all") return allNegs;
        const now = new Date();
        let cutoff: Date;
        if (timeFilter === "today") { cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
        else if (timeFilter === "week") { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7); }
        else { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30); }
        return allNegs.filter(n => {
            try { return new Date(n.dateNeg + "T00:00:00") >= cutoff; } catch { return true; }
        });
    })();

    const filtered = search ? timeFiltered.filter(n => n.clientName.toLowerCase().includes(search.toLowerCase()) || n.cnpj.includes(search) || n.stoneCode.includes(search)) : timeFiltered;

    // Stage transition
    const changeStage = async (negId: string, newStatus: string) => {
        try {
            await fetch(`/api/negotiations/${negId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            loadAll();
        } catch { /* */ }
    };

    const assignNeg = async (negId: string, assigneeId: string | null) => {
        try {
            await fetch(`/api/negotiations/${negId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigneeId }),
            });
            loadAll();
        } catch { /* */ }
    };

    const deleteNeg = async (negId: string) => {
        const { confirmed, justification } = await confirmAction({
            title: "Excluir Negociação",
            message: "Tem certeza que deseja excluir esta negociação? Esta ação é irreversível e será registrada no log.",
            variant: "danger",
            confirmText: "Excluir Negociação",
            requireJustification: true,
            justificationLabel: "Motivo da exclusão (obrigatório)",
        });
        if (!confirmed) return;
        try {
            await fetch(`/api/negotiations/${negId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: justification }) });
            loadAll();
        } catch { /* */ }
    };

    // New client + negotiation
    function resetNewForm() { setFN(""); setFSC(""); setFCNPJ(""); setFPH(""); setFEM(""); setFRates(defaultRates()); setFDateN(today()); setFNotes(""); setFAssignee(""); setFDocMsg(""); setFDocOk(null); }

    async function handleCnpjFetch(data: { name?: string; fantasia?: string; telefone?: string; email?: string }) {
        if (data.name && !fn.trim()) setFN(data.fantasia || data.name);
        if (data.telefone && !fph.trim()) setFPH(data.telefone);
        if (data.email && !fem.trim()) setFEM(data.email.toLowerCase());
    }

    async function handleSaveClient() {
        if (!fn.trim()) return;
        try {
            const r = await fetch("/api/clients", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fn, stoneCode: fsc, cnpj: fcnpj, phone: fph, email: fem,
                    negotiation: { dateNeg: fDateN, rates: fRates, notes: fNotes, assigneeId: fAssignee || undefined, status: "prospeccao" },
                }),
            });
            if (r.ok) { setMsg({ type: "ok", text: `${fn} adicionado ao pipeline!` }); resetNewForm(); setView("board"); loadAll(); }
        } catch { setMsg({ type: "err", text: "Erro ao salvar" }); }
    }

    function shareWhatsApp(neg: typeof allNegs[0]) {
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

    // ─── Drag and Drop ───
    function onDragStart(negId: string) { setDragId(negId); }
    function onDragOver(e: React.DragEvent, stageId: string) { e.preventDefault(); setDragOverStage(stageId); }
    function onDragLeave() { setDragOverStage(null); }
    async function onDrop(stageId: string) {
        if (dragId && stageId) {
            // Find current stage for transition prompt
            const neg = allNegs.find(n => n.id === dragId);
            const fromStage = neg ? normalizeStatus(neg.status) : "";
            if (fromStage !== stageId) {
                await changeStage(dragId, stageId);
                // Show stage transition toast
                const prompt = getTransitionPrompt(fromStage, stageId);
                if (prompt && neg) {
                    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                    setStageToast({ negId: dragId, neg, from: fromStage, to: stageId, prompt });
                    toastTimerRef.current = setTimeout(() => setStageToast(null), 8000);
                }
            }
        }
        setDragId(null); setDragOverStage(null);
    }

    function handleToastAction() {
        if (!stageToast) return;
        const { neg, prompt } = stageToast;
        if (prompt.actionType === "whatsapp") {
            shareWhatsApp(neg);
        } else if (prompt.actionType === "task") {
            // Create follow-up task in 2 days
            const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 2);
            const fd = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
            fetch("/api/tasks").then(r => r.json()).then(data => {
                const list = data.lists?.find((l: any) => l.name.toLowerCase().includes("follow")) || data.lists?.[0];
                if (list) {
                    fetch(`/api/tasks/${list.id}/items`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: `Follow-up — ${neg.clientName}`, date: fd, time: "10:00", priority: "high" })
                    });
                }
            });
            setMsg({ type: "ok", text: `Lembrete criado para ${neg.clientName} em 2 dias!` });
        } else if (prompt.actionType === "accept") {
            // Set dateAccept to today
            fetch(`/api/negotiations/${stageToast.negId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dateAccept: today() })
            }).then(() => loadAll());
            setMsg({ type: "ok", text: `Data de aceite registrada para ${neg.clientName}!` });
        } else if (prompt.actionType === "reneg") {
            // Schedule renegotiation in 30 days
            const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 30);
            const fd = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
            fetch("/api/tasks").then(r => r.json()).then(data => {
                const list = data.lists?.[0];
                if (list) {
                    fetch(`/api/tasks/${list.id}/items`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: `Renegociar — ${neg.clientName}`, date: fd, time: "09:00", priority: "high" })
                    });
                }
            });
            setMsg({ type: "ok", text: `Reagendamento em 30 dias criado para ${neg.clientName}!` });
        }
        setStageToast(null);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00A868]" /></div>;

    /* ═══ NEW CLIENT FORM ═══ */
    if (view === "new") {
        return (
            <div className="max-w-2xl mx-auto space-y-5 pb-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView("board")} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
                    <h1 className="text-lg font-bold text-foreground">Novo Cliente + Negociação</h1>
                </div>
                <div className="card-elevated p-4 sm:p-5 space-y-3">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Dados do Cliente</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Nome / Razão Social *</label>
                            <input value={fn} onChange={e => setFN(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        <div className="sm:col-span-2 lg:col-span-1"><label className="text-xs font-medium text-muted-foreground block mb-1">CNPJ/CPF</label>
                            <DocumentInput value={fcnpj} onChange={setFCNPJ} onCNPJData={handleCnpjFetch} allowBypass /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Stone Code</label>
                            <input value={fsc} onChange={e => setFSC(e.target.value)} placeholder="123456" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Telefone</label>
                            <PhoneInput value={fph} onChange={setFPH} /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">E-mail</label>
                            <input value={fem} onChange={e => setFEM(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    </div>
                </div>
                <div className="bg-card border border-[#00A868]/20 rounded-2xl p-4 sm:p-5 space-y-3">
                    <h3 className="text-sm font-bold text-[#00A868] uppercase tracking-wider">Taxas Negociadas</h3>
                    <RatesForm rates={fRates} set={setFRates} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data Negociação</label>
                            <input type="date" value={fDateN} onChange={e => setFDateN(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Responsável</label>
                            <select value={fAssignee} onChange={e => setFAssignee(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none">
                                <option value="">Selecione...</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select></div>
                    </div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Observações</label>
                        <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} placeholder="Detalhes..." className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm resize-none focus:outline-none" /></div>
                </div>
                <button onClick={handleSaveClient} disabled={!fn.trim()} className="w-full py-3 rounded-xl bg-[#00A868] text-white font-bold hover:bg-[#00A868] disabled:opacity-50">Salvar e Adicionar ao Pipeline</button>
            </div>
        );
    }

    /* ═══ BOARD VIEW (KANBAN) ═══ */
    return (
        <>
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20"><Handshake className="w-4 h-4" /></div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Pipeline de Negociações</h1>
                        <p className="text-xs text-muted-foreground">{allNegs.length} negociações · {clients.length} clientes</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Time filters */}
                    <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg">
                        {(["today", "week", "month", "all"] as const).map(tf => {
                            const labels = { today: "Hoje", week: "Semana", month: "Mês", all: "Todos" };
                            return (
                                <button key={tf} onClick={() => setTimeFilter(tf)}
                                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${timeFilter === tf ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                    {labels[tf]}
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative"><Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                            className="pl-8 pr-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground w-48 focus:outline-none focus:border-[#00A868]/50" />
                    </div>
                    <button onClick={() => setView(view === "board" ? "list" : "board")} className={`p-2 rounded-xl ${view === "board" ? "bg-[#00A868]/10 text-[#00A868]" : "bg-muted text-muted-foreground"}`} title="Alternar vista">
                        {view === "board" ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { resetNewForm(); setView("new"); }} className="flex items-center gap-2 px-4 py-2 bg-[#00A868] hover:bg-[#00A868] text-white rounded-xl text-sm font-medium shadow-lg shadow-[#00A868]/20">
                        <Plus className="w-4 h-4" /> Novo Cliente
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium mb-4 ${msg.type === "ok" ? "bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20" : "bg-red-500/10 text-red-600 border border-red-500/20"}`}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />} {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-auto p-0.5 rounded hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {view === "board" ? (
                /* ═══ KANBAN BOARD ═══ */
                <div className="flex-1 overflow-x-auto -mx-4 lg:-mx-6 px-4 lg:px-6">
                    <div className="flex flex-col lg:flex-row gap-2 min-h-0 lg:min-h-[calc(100vh-220px)] pb-4 lg:pr-4" style={{ minWidth: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${STAGES.length * 230}px` : 'auto' }}>
                        {STAGES.map(stage => {
                            const stageNegs = filtered.filter(n => normalizeStatus(n.status) === stage.id);
                            const isDragOver = dragOverStage === stage.id;
                            return (
                                <div key={stage.id}
                                    className={`lg:flex-1 lg:min-w-[200px] lg:max-w-[280px] flex flex-col rounded-2xl transition-all ${isDragOver ? "ring-2 ring-blue-500/50 bg-blue-500/5" : "bg-card/50"}`}
                                    onDragOver={e => onDragOver(e, stage.id)} onDragLeave={onDragLeave} onDrop={() => onDrop(stage.id)}>
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                                            <span className="text-xs font-bold text-foreground">{stage.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.text}`}>{stageNegs.length}</span>
                                    </div>

                                    {/* Cards */}
                                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                                        {(() => {
                                            const isTerminal = stage.id === "fechado" || stage.id === "recusado";
                                            const stageLimit = isTerminal ? 5 : CARDS_LIMIT;
                                            const isExpanded = expandedStages[stage.id];
                                            const visible = isExpanded ? stageNegs : stageNegs.slice(0, stageLimit);
                                            const remaining = stageNegs.length - stageLimit;
                                            return (<>
                                        {visible.map(neg => {
                                            const age = (stage.id !== "fechado" && stage.id !== "recusado") ? getLeadAge(neg) : { days: 0, level: "fresh" as const, label: "", cssClass: "" };
                                            return (
                                            <div key={neg.id} draggable
                                                onDragStart={() => onDragStart(neg.id)}
                                                onClick={() => setDrawerNeg(neg)}
                                                className={`card-elevated rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[#00A868]/30 transition-all group overflow-hidden ${dragId === neg.id ? "opacity-50 scale-95" : ""} ${age.cssClass}`}>
                                                {/* Lead Aging Badge */}
                                                {age.label && (
                                                    <div className={`flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold w-fit ${
                                                        age.level === "warm" ? "bg-amber-500/10 text-amber-500"
                                                        : age.level === "hot" ? "bg-red-500/10 text-red-500"
                                                        : "bg-indigo-500/10 text-indigo-400"
                                                    }`}>
                                                        {age.label}
                                                    </div>
                                                )}
                                                {/* Client + Drag */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-8 h-8 rounded-lg bg-[#00A868]/10 flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-[#00A868]">{initials(neg.clientName)}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{neg.clientName}</p>
                                                        {neg.stoneCode && <p className="text-[10px] text-muted-foreground/70">SC: {neg.stoneCode}</p>}
                                                    </div>
                                                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0" />
                                                </div>

                                                {/* Rates row */}
                                                <div className="flex items-center gap-0.5 mb-2">
                                                    {[{ l: "Déb", v: neg.rates.debit }, { l: "1x", v: neg.rates.credit1x }, { l: "PIX", v: neg.rates.pix }].map(r => (
                                                        <div key={r.l} className="flex-1 bg-secondary/60 rounded-lg px-1.5 py-1 text-center">
                                                            <p className="text-[9px] text-muted-foreground/60 uppercase">{r.l}</p>
                                                            <p className="text-[11px] font-bold text-foreground">{formatPercent(r.v)}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Meta: date + assignee */}
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                        <Calendar className="w-2.5 h-2.5" /> {fmtDate(neg.dateNeg)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {neg.assignee ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-medium text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                                                                <div className="w-3.5 h-3.5 rounded-full bg-purple-500 flex items-center justify-center text-[7px] text-white font-bold shrink-0">{initials(neg.assignee.name)}</div>
                                                                {neg.assignee.name.split(" ")[0]}
                                                            </span>
                                                        ) : (
                                                            <select value="" onChange={e => assignNeg(neg.id, e.target.value || null)}
                                                                className="text-[10px] bg-transparent text-muted-foreground/50 border-none p-0 focus:outline-none cursor-pointer w-16">
                                                                <option value="">Atribuir</option>
                                                                {users.map(u => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quick actions — always visible on mobile, hover on desktop */}
                                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
                                                    <button onClick={() => shareWhatsApp(neg)} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-[#00A868] bg-[#00A868]/8 hover:bg-[#00A868]/15 flex items-center justify-center gap-0.5 transition-colors" title="WhatsApp">
                                                        <MessageSquare className="w-3 h-3" /> Zap
                                                    </button>
                                                    <a href={gcalLink(neg)} target="_blank" rel="noopener noreferrer" className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-blue-500 bg-blue-500/8 hover:bg-blue-500/15 flex items-center justify-center gap-0.5 transition-colors" title="Calendário">
                                                        <CalendarPlus className="w-3 h-3" /> Agendar
                                                    </a>
                                                    <button onClick={() => generateProposalPDF(
                                                        { name: neg.clientName, stoneCode: neg.stoneCode, cnpj: neg.cnpj, phone: neg.clientPhone },
                                                        neg,
                                                        "Agente"
                                                    )} className="py-1.5 px-2 rounded-lg text-[10px] font-semibold text-purple-500 bg-purple-500/8 hover:bg-purple-500/15 flex items-center justify-center gap-0.5 transition-colors" title="Exportar PDF">
                                                        <FileDown className="w-3 h-3" /> PDF
                                                    </button>
                                                    {normalizeStatus(neg.status) !== "fechado" && normalizeStatus(neg.status) !== "recusado" && (
                                                        <button onClick={() => {
                                                            const idx = STAGES.findIndex(s => s.id === normalizeStatus(neg.status));
                                                            if (idx < STAGES.length - 2) changeStage(neg.id, STAGES[idx + 1].id);
                                                        }} className="py-1.5 px-2 rounded-lg text-[10px] font-semibold text-foreground bg-secondary hover:bg-muted flex items-center justify-center gap-0.5 transition-colors" title="Avançar">
                                                            <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => deleteNeg(neg.id)} className="py-1.5 px-2 rounded-lg text-[10px] font-semibold text-red-400/60 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Excluir">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>

                                                {/* Stage timestamp */}
                                                {neg.stageHistory && neg.stageHistory.length > 0 && (
                                                    <p className="text-[9px] text-muted-foreground/40 mt-1.5 flex items-center gap-0.5 truncate">
                                                        <Clock className="w-2.5 h-2.5 shrink-0" />
                                                        {fmtDateTime(neg.stageHistory[neg.stageHistory.length - 1].timestamp)}
                                                        {neg.stageHistory[neg.stageHistory.length - 1].userName && ` por ${neg.stageHistory[neg.stageHistory.length - 1].userName}`}
                                                    </p>
                                                )}
                                            </div>
                                            );
                                        })}
                                        {!isExpanded && remaining > 0 && (
                                            <button onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: true }))}
                                                className="w-full py-2 text-[11px] font-medium text-blue-500 hover:bg-blue-500/5 rounded-xl border border-dashed border-blue-500/30 transition-colors">
                                                Ver mais {remaining} negociação{remaining > 1 ? "ões" : ""}
                                            </button>
                                        )}
                                        {isExpanded && remaining > 0 && (
                                            <button onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: false }))}
                                                className="w-full py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-xl transition-colors">
                                                Recolher
                                            </button>
                                        )}
                                        </>);
                                        })()}

                                        {stageNegs.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/30">
                                                <Handshake className="w-8 h-8 mb-1" />
                                                <p className="text-[10px]">Nenhuma</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* ═══ LIST VIEW ═══ */
                <div className="flex-1 overflow-auto">
                    <div className="space-y-2">
                        {filtered.length === 0 ? (
                            <div className="card-elevated p-12 text-center">
                                <Handshake className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                                <p className="font-semibold text-foreground">Nenhuma negociação</p>
                                <p className="text-sm text-muted-foreground">Cadastre clientes para iniciar o pipeline.</p>
                            </div>
                        ) : filtered.map(neg => (
                            <div key={neg.id} className="card-elevated rounded-xl p-4 flex items-center gap-4 hover:border-[#00A868]/30 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-[#00A868]/10 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-[#00A868]">{neg.clientName.charAt(0)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{neg.clientName}</p>
                                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                        {neg.stoneCode && <span>SC: {neg.stoneCode}</span>}
                                        <span>Déb: {formatPercent(neg.rates.debit)}</span>
                                        <span>1x: {formatPercent(neg.rates.credit1x)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {neg.assignee && <span className="text-[10px] bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full font-medium">{neg.assignee.name.split(" ")[0]}</span>}
                                    <StageBadge status={neg.status} />
                                    <div className="flex gap-0.5">
                                        {/* Quick stage forward */}
                                        {normalizeStatus(neg.status) !== "fechado" && normalizeStatus(neg.status) !== "recusado" && (
                                            <button onClick={() => {
                                                const idx = STAGES.findIndex(s => s.id === normalizeStatus(neg.status));
                                                if (idx < STAGES.length - 2) changeStage(neg.id, STAGES[idx + 1].id);
                                            }} className="p-1.5 rounded-lg bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20" title="Avançar estágio">
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => shareWhatsApp(neg)} className="p-1.5 rounded-lg bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => deleteNeg(neg.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

            {/* ═══ Stage Transition Toast ═══ */}
            {stageToast && (
                <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[80] w-[90%] max-w-md toast-enter">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-3">
                        <span className="text-2xl shrink-0">{stageToast.prompt.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground">{stageToast.prompt.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{stageToast.neg.clientName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={handleToastAction}
                                className="px-3 py-1.5 rounded-xl bg-[#00A868] text-white text-xs font-bold hover:bg-[#008f58] transition-colors shadow-sm">
                                {stageToast.prompt.action}
                            </button>
                            <button onClick={() => { setStageToast(null); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    {/* Auto-dismiss progress bar */}
                    <div className="mx-4 h-0.5 bg-border rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-[#00A868] rounded-full" style={{ animation: "shrinkBar 8s linear forwards" }} />
                    </div>
                    <style>{`@keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }`}</style>
                </div>
            )}

            {/* ═══ Negotiation Detail Drawer ═══ */}
            <SlideDrawer
                open={!!drawerNeg}
                onClose={() => setDrawerNeg(null)}
                title={drawerNeg?.clientName || ""}
                subtitle={drawerNeg?.stoneCode ? `SC: ${drawerNeg.stoneCode}` : drawerNeg?.cnpj || ""}
            >
                {drawerNeg && (
                    <div className="p-5 space-y-5">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                            <StageBadge status={drawerNeg.status} />
                            {(() => {
                                const age = getLeadAge(drawerNeg);
                                return age.label ? (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        age.level === "warm" ? "bg-amber-500/10 text-amber-500"
                                        : age.level === "hot" ? "bg-red-500/10 text-red-500"
                                        : age.level === "cold" ? "bg-indigo-500/10 text-indigo-400"
                                        : ""
                                    }`}>{age.label}</span>
                                ) : null;
                            })()}
                        </div>

                        {/* Client Info */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dados do Cliente</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-secondary rounded-xl p-3">
                                    <p className="text-[9px] text-muted-foreground uppercase">CNPJ</p>
                                    <p className="text-xs font-bold text-foreground">{drawerNeg.cnpj || "—"}</p>
                                </div>
                                <div className="bg-secondary rounded-xl p-3">
                                    <p className="text-[9px] text-muted-foreground uppercase">Telefone</p>
                                    <p className="text-xs font-bold text-foreground">{drawerNeg.clientPhone || "—"}</p>
                                </div>
                                <div className="bg-secondary rounded-xl p-3">
                                    <p className="text-[9px] text-muted-foreground uppercase">Data Negociação</p>
                                    <p className="text-xs font-bold text-foreground">{fmtDate(drawerNeg.dateNeg)}</p>
                                </div>
                                {drawerNeg.assignee && (
                                    <div className="bg-secondary rounded-xl p-3">
                                        <p className="text-[9px] text-muted-foreground uppercase">Responsável</p>
                                        <p className="text-xs font-bold text-foreground">{drawerNeg.assignee.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rates Summary — Editable */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxas Negociadas</h4>
                                {!editingRates ? (
                                    <button onClick={() => { setEditingRates(true); setDrawerRates({ ...drawerNeg.rates }); }}
                                        className="text-[10px] font-bold text-[#00A868] hover:text-[#008f58] transition-colors px-2 py-0.5 rounded-lg hover:bg-[#00A868]/10">
                                        ✏️ Editar
                                    </button>
                                ) : (
                                    <div className="flex gap-1">
                                        <button onClick={async () => {
                                            if (!drawerRates) return;
                                            setSavingRates(true);
                                            try {
                                                await fetch(`/api/negotiations/${drawerNeg.id}`, {
                                                    method: "PUT", headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ rates: drawerRates })
                                                });
                                                drawerNeg.rates = { ...drawerRates };
                                                setEditingRates(false);
                                                loadAll();
                                                setMsg({ type: "ok", text: "Taxas atualizadas!" });
                                            } catch { setMsg({ type: "err", text: "Erro ao salvar" }); }
                                            setSavingRates(false);
                                        }} disabled={savingRates}
                                            className="text-[10px] font-bold text-white bg-[#00A868] hover:bg-[#008f58] px-2.5 py-0.5 rounded-lg transition-colors disabled:opacity-50">
                                            {savingRates ? "Salvando..." : "Salvar"}
                                        </button>
                                        <button onClick={() => { setEditingRates(false); setDrawerRates(null); }}
                                            className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-lg hover:bg-muted transition-colors">
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Rate Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { l: "Débito", k: "debit" },
                                    { l: "Créd 1x", k: "credit1x" },
                                    { l: "2-6x", k: "credit2to6" },
                                    { l: "7-12x", k: "credit7to12" },
                                    { l: "PIX", k: "pix" },
                                    { l: "RAV", k: "rav" },
                                ].map(r => {
                                    const val = editingRates && drawerRates
                                        ? (drawerRates as any)[r.k === "rav" ? "ravRate" : r.k] ?? (drawerRates as any)[r.k] ?? 0
                                        : r.k === "rav" ? (drawerNeg.rates.ravRate ?? drawerNeg.rates.rav) : drawerNeg.rates[r.k];
                                    return (
                                        <div key={r.l} className={`rounded-xl p-2.5 text-center border transition-all ${
                                            editingRates ? "bg-card border-[#00A868]/30" : "bg-[#00A868]/5 border-[#00A868]/10"
                                        }`}>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold">{r.l}</p>
                                            {editingRates && drawerRates ? (
                                                <input type="number" step="0.01" value={val}
                                                    onChange={e => {
                                                        const key = r.k === "rav" ? "ravRate" : r.k;
                                                        setDrawerRates(prev => prev ? { ...prev, [key]: parseFloat(e.target.value) || 0, ...(r.k === "rav" ? { rav: parseFloat(e.target.value) || 0 } : {}) } : prev);
                                                    }}
                                                    className="w-full text-center text-sm font-black text-[#00A868] bg-transparent focus:outline-none border-b border-[#00A868]/30 pb-0.5" />
                                            ) : (
                                                <p className="text-sm font-black text-[#00A868]">{formatPercent(val)}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CET Block */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                📊 Custo Efetivo Total (CET)
                            </h4>
                            {(() => {
                                const rates = editingRates && drawerRates ? drawerRates : drawerNeg.rates;
                                const ravVal = rates.ravRate ?? rates.rav ?? 0;
                                const cetRows = [
                                    { label: "Débito", mdr: rates.debit, parcelas: 1 },
                                    { label: "Créd 1x", mdr: rates.credit1x, parcelas: 1 },
                                    { label: "Créd 2x", mdr: rates.credit2to6, parcelas: 2 },
                                    { label: "Créd 6x", mdr: rates.credit2to6, parcelas: 6 },
                                    { label: "Créd 12x", mdr: rates.credit7to12, parcelas: 12 },
                                ];
                                return (
                                    <div className="rounded-xl border border-border overflow-hidden">
                                        <div className="grid grid-cols-4 gap-0 text-center bg-secondary/50 py-1.5">
                                            <span className="text-[8px] font-bold uppercase text-muted-foreground">Modalidade</span>
                                            <span className="text-[8px] font-bold uppercase text-muted-foreground">MDR</span>
                                            <span className="text-[8px] font-bold uppercase text-muted-foreground">RAV</span>
                                            <span className="text-[8px] font-bold uppercase text-[#00A868]">CET</span>
                                        </div>
                                        {cetRows.map(row => {
                                            const cet = calculateCET(row.mdr, ravVal, row.parcelas);
                                            return (
                                                <div key={row.label} className="grid grid-cols-4 gap-0 text-center py-2 border-t border-border/50 hover:bg-muted/30 transition-colors">
                                                    <span className="text-[10px] font-semibold text-foreground">{row.label}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">{formatPercent(row.mdr)}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">{formatPercent(ravVal)}</span>
                                                    <span className="text-[10px] font-black text-[#00A868]">{formatPercent(cet)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Stage History */}
                        {drawerNeg.stageHistory && drawerNeg.stageHistory.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Histórico</h4>
                                <div className="space-y-1">
                                    {[...drawerNeg.stageHistory].reverse().map((h: any, i: number) => {
                                        const st = getStage(h.to || h.status);
                                        return (
                                            <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/50 min-w-0">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                                                <span className="text-xs font-medium text-foreground shrink-0">{st.label}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto truncate min-w-0">
                                                    {fmtDateTime(h.timestamp)}
                                                    {h.userName && ` · ${h.userName}`}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {drawerNeg.notes && (
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observações</h4>
                                <p className="text-xs text-foreground bg-secondary rounded-xl p-3 whitespace-pre-wrap break-words">{drawerNeg.notes}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-2 pt-2 border-t border-border">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ações</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { shareWhatsApp(drawerNeg); setDrawerNeg(null); }}
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00A868]/10 text-[#00A868] text-xs font-bold hover:bg-[#00A868]/20 transition-colors">
                                    <MessageSquare className="w-4 h-4" /> WhatsApp
                                </button>
                                <a href={gcalLink(drawerNeg)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 text-blue-500 text-xs font-bold hover:bg-blue-500/20 transition-colors">
                                    <CalendarPlus className="w-4 h-4" /> Agendar
                                </a>
                                <button onClick={() => {
                                    generateProposalPDF(
                                        { name: drawerNeg.clientName, stoneCode: drawerNeg.stoneCode, cnpj: drawerNeg.cnpj, phone: drawerNeg.clientPhone },
                                        drawerNeg,
                                        "Agente"
                                    );
                                    setDrawerNeg(null);
                                }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500/20 transition-colors">
                                    <FileDown className="w-4 h-4" /> Exportar PDF
                                </button>
                                {normalizeStatus(drawerNeg.status) !== "fechado" && normalizeStatus(drawerNeg.status) !== "recusado" && (
                                    <button onClick={() => {
                                        const idx = STAGES.findIndex(s => s.id === normalizeStatus(drawerNeg.status));
                                        if (idx < STAGES.length - 2) { changeStage(drawerNeg.id, STAGES[idx + 1].id); setDrawerNeg(null); }
                                    }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-muted transition-colors">
                                        <ArrowRight className="w-4 h-4" /> Avançar Etapa
                                    </button>
                                )}
                            </div>

                            {/* Stage selector */}
                            <div className="pt-2">
                                <select
                                    value={normalizeStatus(drawerNeg.status)}
                                    onChange={e => { changeStage(drawerNeg.id, e.target.value); setDrawerNeg(null); }}
                                    className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-xs font-medium focus:outline-none">
                                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>

                            <button onClick={() => { deleteNeg(drawerNeg.id); setDrawerNeg(null); }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500/20 transition-colors mt-2">
                                <Trash2 className="w-4 h-4" /> Excluir Negociação
                            </button>
                        </div>
                    </div>
                )}
            </SlideDrawer>
        </>
    );
}
