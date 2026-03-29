"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatPercent, BRAND_PRESETS, type BrandRates } from "@/lib/calculator";
import { RI } from "@/components/rate-input";
import { formatarDocumento, validarDocumento } from "@/lib/documento";
import {
    Handshake, Plus, X, ChevronLeft, LayoutGrid, List, Search,
    Calendar, CalendarPlus, CalendarDays, MessageSquare, Clock, User, Trash2, CheckCircle,
    AlertCircle, Loader2, ExternalLink, GripVertical, ArrowRight
} from "lucide-react";

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

/* ═══ GOOGLE CALENDAR ═══ */
function gcalLink(neg: { clientName: string; clientPhone?: string; stoneCode?: string; cnpj?: string; dateNeg: string; rates: RateSnapshot; notes?: string; status: string }) {
    const title = `Negociação Stone — ${neg.clientName}`;
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
    desc += `\n— BitKaiser Taxas`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(desc)}`;
}

/* ═══ PIPELINE STAGES ═══ */
const STAGES = [
    { id: "prospeccao", label: "Prospecção", color: "slate", bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/20", dot: "bg-slate-500" },
    { id: "proposta_enviada", label: "Proposta Enviada", color: "blue", bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20", dot: "bg-blue-500" },
    { id: "aguardando_cliente", label: "Aguardando Cliente", color: "amber", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20", dot: "bg-amber-500" },
    { id: "aprovado", label: "Aprovado", color: "emerald", bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20", dot: "bg-emerald-500" },
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
    const br = rates.brandRates || defaultBrandRates();
    const cb = br[activeBrand] || { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    function up(f: string, v: number) { const n = { ...br, [activeBrand]: { ...cb, [f]: v } }; const vm = n["VISA/MASTER"] || cb; set({ ...rates, brandRates: n, debit: vm.debit, credit1x: vm.credit1x, credit2to6: vm.credit2to6, credit7to12: vm.credit7to12 }); }
    return (
        <div className="space-y-3">
            <div className="flex gap-1.5 flex-wrap">
                {Object.keys(br).map(b => (
                    <button key={b} type="button" onClick={() => setActiveBrand(b)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-semibold ${activeBrand === b ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>{b}</button>
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <RI l="Débito" v={cb.debit} set={v => up("debit", v)} />
                <RI l="Crédito 1x" v={cb.credit1x} set={v => up("credit1x", v)} />
                <RI l="2-6x" v={cb.credit2to6} set={v => up("credit2to6", v)} />
                <RI l="7-12x" v={cb.credit7to12} set={v => up("credit7to12", v)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <RI l="PIX" v={rates.pix} set={v => set({ ...rates, pix: v })} />
                <RI l="RAV" v={rates.ravRate ?? rates.rav} set={v => set({ ...rates, ravRate: v, rav: v })} />
            </div>
        </div>
    );
}

/* ═══ MAIN COMPONENT ═══ */
export default function NegociacoesPage() {
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

    // All negotiations flat
    const allNegs = clients.flatMap(c => c.negotiations.map(n => ({ ...n, clientName: c.name, clientId: c.id, cnpj: c.cnpj, stoneCode: c.stoneCode, clientPhone: c.phone })));

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
        if (!confirm("Excluir esta negociação?")) return;
        try { await fetch(`/api/negotiations/${negId}`, { method: "DELETE" }); loadAll(); } catch { /* */ }
    };

    // New client + negotiation
    function resetNewForm() { setFN(""); setFSC(""); setFCNPJ(""); setFPH(""); setFEM(""); setFRates(defaultRates()); setFDateN(today()); setFNotes(""); setFAssignee(""); setFDocMsg(""); setFDocOk(null); }

    async function handleCnpjChange(raw: string) {
        const formatted = formatarDocumento(raw); setFCNPJ(formatted);
        const nums = raw.replace(/\D/g, "");
        if (nums.length === 14) {
            const v = validarDocumento(nums); setFDocMsg(v.mensagem); setFDocOk(v.valido);
            if (v.valido && v.tipo === "cnpj") {
                setCnpjLoading(true);
                try {
                    const r = await fetch(`/api/cnpj?cnpj=${nums}`);
                    if (r.ok) { const data = await r.json(); if (data.razaoSocial && !fn.trim()) setFN(data.razaoSocial); if (data.telefone && !fph.trim()) setFPH(data.telefone); if (data.email && !fem.trim()) setFEM(data.email); setFDocMsg(`CNPJ válido — ${data.razaoSocial || "Encontrado"}`); }
                } catch { /* */ }
                setCnpjLoading(false);
            }
        } else if (nums.length === 11) { const v = validarDocumento(nums); setFDocMsg(v.mensagem); setFDocOk(v.valido); }
        else { setFDocMsg(""); setFDocOk(null); }
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
        txt += `\n— BitKaiser Taxas`;
        window.open(`https://wa.me/${neg.clientPhone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(txt)}`, "_blank");
    }

    // ─── Drag and Drop ───
    function onDragStart(negId: string) { setDragId(negId); }
    function onDragOver(e: React.DragEvent, stageId: string) { e.preventDefault(); setDragOverStage(stageId); }
    function onDragLeave() { setDragOverStage(null); }
    async function onDrop(stageId: string) {
        if (dragId && stageId) {
            await changeStage(dragId, stageId);
        }
        setDragId(null); setDragOverStage(null);
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    /* ═══ NEW CLIENT FORM ═══ */
    if (view === "new") {
        return (
            <div className="max-w-2xl mx-auto space-y-5">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView("board")} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
                    <h1 className="text-lg font-bold text-foreground">Novo Cliente + Negociação</h1>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Dados do Cliente</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Nome / Razão Social *</label>
                            <input value={fn} onChange={e => setFN(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-emerald-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Stone Code</label>
                            <input value={fsc} onChange={e => setFSC(e.target.value)} placeholder="123456" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-emerald-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">CNPJ/CPF {cnpjLoading && <span className="text-emerald-500 animate-pulse">buscando...</span>}</label>
                            <input value={fcnpj} onChange={e => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" className={`w-full px-3 py-2.5 rounded-xl bg-secondary border text-foreground text-sm focus:outline-none ${fDocOk === true ? "border-emerald-500" : fDocOk === false ? "border-red-500" : "border-border"}`} />
                            {fDocMsg && <p className={`text-xs mt-1 ${fDocOk ? "text-emerald-500" : "text-red-500"}`}>{fDocMsg}</p>}</div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Telefone</label>
                            <input value={fph} onChange={e => setFPH(e.target.value)} placeholder="(00) 00000-0000" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-emerald-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">E-mail</label>
                            <input value={fem} onChange={e => setFEM(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-emerald-500/50" /></div>
                    </div>
                </div>
                <div className="bg-card border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Taxas Negociadas</h3>
                    <RatesForm rates={fRates} set={setFRates} />
                    <div className="grid grid-cols-2 gap-3">
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
                <button onClick={handleSaveClient} disabled={!fn.trim()} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50">Salvar e Adicionar ao Pipeline</button>
            </div>
        );
    }

    /* ═══ BOARD VIEW (KANBAN) ═══ */
    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20"><Handshake className="w-4 h-4" /></div>
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
                            className="pl-8 pr-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground w-48 focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <button onClick={() => setView(view === "board" ? "list" : "board")} className={`p-2 rounded-xl ${view === "board" ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"}`} title="Alternar vista">
                        {view === "board" ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { resetNewForm(); setView("new"); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-600/20">
                        <Plus className="w-4 h-4" /> Novo Cliente
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium mb-4 ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />} {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-auto p-0.5 rounded hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {view === "board" ? (
                /* ═══ KANBAN BOARD ═══ */
                <div className="flex-1 overflow-x-auto -mx-4 lg:-mx-6 px-4 lg:px-6">
                    <div className="flex gap-3 min-h-[calc(100vh-220px)] pb-4" style={{ minWidth: `${STAGES.length * 280}px` }}>
                        {STAGES.map(stage => {
                            const stageNegs = filtered.filter(n => normalizeStatus(n.status) === stage.id);
                            const isDragOver = dragOverStage === stage.id;
                            return (
                                <div key={stage.id}
                                    className={`w-[268px] shrink-0 flex flex-col rounded-2xl transition-all ${isDragOver ? "ring-2 ring-blue-500/50 bg-blue-500/5" : "bg-card/50"}`}
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
                                            const isExpanded = expandedStages[stage.id];
                                            const visible = isExpanded ? stageNegs : stageNegs.slice(0, CARDS_LIMIT);
                                            const remaining = stageNegs.length - CARDS_LIMIT;
                                            return (<>
                                        {visible.map(neg => (
                                            <div key={neg.id} draggable
                                                onDragStart={() => onDragStart(neg.id)}
                                                className={`bg-card border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-500/30 transition-all group overflow-hidden ${dragId === neg.id ? "opacity-50 scale-95" : ""}`}>
                                                <div className="flex items-start justify-between gap-1 mb-1">
                                                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{neg.clientName}</p>
                                                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                                                </div>
                                                {neg.stoneCode && <p className="text-[11px] text-muted-foreground mb-1.5 truncate">SC: {neg.stoneCode}</p>}

                                                {/* Mini rates */}
                                                <div className="grid grid-cols-3 gap-1 mb-2">
                                                    {[{ l: "Déb", v: neg.rates.debit }, { l: "1x", v: neg.rates.credit1x }, { l: "PIX", v: neg.rates.pix }].map(r => (
                                                        <div key={r.l} className="bg-secondary/60 rounded-md px-1.5 py-1 text-center overflow-hidden">
                                                            <p className="text-[10px] text-muted-foreground">{r.l}</p>
                                                            <p className="text-xs font-bold text-foreground">{formatPercent(r.v)}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Meta badges */}
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 bg-muted/50 px-1.5 py-0.5 rounded">
                                                        <Calendar className="w-2.5 h-2.5" /> {fmtDate(neg.dateNeg)}
                                                    </span>
                                                    {neg.assignee && (
                                                        <span className="text-[10px] text-purple-500 flex items-center gap-0.5 bg-purple-500/10 px-1.5 py-0.5 rounded font-medium truncate max-w-[90px]">
                                                            <User className="w-2.5 h-2.5 shrink-0" /> {neg.assignee.name.split(" ")[0]}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Hover actions */}
                                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50 h-0 overflow-hidden opacity-0 group-hover:h-auto group-hover:opacity-100 transition-all">
                                                    <button onClick={() => shareWhatsApp(neg)} className="p-1 rounded-md text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-0.5" title="WhatsApp">
                                                        <MessageSquare className="w-3 h-3" /> Zap
                                                    </button>
                                                    <a href={gcalLink(neg)} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md text-[10px] font-medium text-blue-500 hover:bg-blue-500/10 flex items-center gap-0.5" title="Agendar">
                                                        <CalendarPlus className="w-3 h-3" /> Cal
                                                    </a>
                                                    <select value={neg.assignee?.id || ""} onChange={e => assignNeg(neg.id, e.target.value || null)}
                                                        className="ml-auto text-[10px] bg-transparent border border-border rounded-md px-1 py-0.5 text-muted-foreground focus:outline-none max-w-[72px] truncate">
                                                        <option value="">Atribuir</option>
                                                        {users.map(u => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                                                    </select>
                                                    <button onClick={() => deleteNeg(neg.id)} className="p-1 rounded-md text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                </div>

                                                {/* Stage timestamp */}
                                                {neg.stageHistory && neg.stageHistory.length > 0 && (
                                                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-0.5 truncate">
                                                        <Clock className="w-2.5 h-2.5 shrink-0" />
                                                        {fmtDateTime(neg.stageHistory[neg.stageHistory.length - 1].timestamp)}
                                                        {neg.stageHistory[neg.stageHistory.length - 1].userName && ` por ${neg.stageHistory[neg.stageHistory.length - 1].userName}`}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
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
                            <div className="bg-card border border-border rounded-2xl p-12 text-center">
                                <Handshake className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                                <p className="font-semibold text-foreground">Nenhuma negociação</p>
                                <p className="text-sm text-muted-foreground">Cadastre clientes para iniciar o pipeline.</p>
                            </div>
                        ) : filtered.map(neg => (
                            <div key={neg.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-blue-500/30 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{neg.clientName.charAt(0)}</span>
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
                                            }} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" title="Avançar estágio">
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={() => shareWhatsApp(neg)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => deleteNeg(neg.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
