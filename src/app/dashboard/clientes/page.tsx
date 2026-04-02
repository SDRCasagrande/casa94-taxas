"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPercent, calculateCET } from "@/lib/calculator";
import { formatarDocumento, validarDocumento } from "@/lib/documento";
import { DocumentInput } from "@/components/DocumentInput";
import { PhoneInput } from "@/components/PhoneInput";
import {
    Users, Plus, X, ChevronLeft, Search, Calendar, TrendingUp, DollarSign,
    Building2, Phone, Mail, Hash, FileText, Trash2, MessageSquare, ChevronRight,
    Loader2, CheckCircle, AlertCircle, XCircle, Edit3, BarChart3, Clock, Star
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";

/* ═══ TYPES ═══ */
interface MonthVolume { id: string; month: string; tpvDebit: number; tpvCredit: number; tpvPix: number; rateDebit: number; rateCredit: number; ratePix: number; notes: string }
interface Negotiation { id: string; dateNeg: string; dateAccept: string; status: string; rates: any; notes: string; stageHistory?: any[]; assignee?: { id: string; name: string } | null }
interface Client {
    id: string; name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    brand: string; safra: string;
    status: string; credentialDate: string; cancelDate: string; segment: string;
    createdAt: string; negotiations: Negotiation[]; monthlyVolumes: MonthVolume[];
}

/* ═══ HELPERS ═══ */
function fmtDate(d: string) { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }
function fmtMoney(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtMonth(m: string) { if (!m) return "—"; const [y, mo] = m.split("-"); const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; return `${months[parseInt(mo) - 1]} ${y}`; }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function daysBetween(d1: string, d2?: string) { const a = new Date(d1); const b = d2 ? new Date(d2) : new Date(); return Math.floor((b.getTime() - a.getTime()) / 86400000); }

/* Commission calc */
function calcCommission(vol: MonthVolume) {
    const revDebit = vol.tpvDebit * (vol.rateDebit / 100);
    const revCredit = vol.tpvCredit * (vol.rateCredit / 100);
    const revPix = vol.tpvPix * (vol.ratePix / 100);
    const totalRevenue = revDebit + revCredit + revPix;
    const franchise = totalRevenue * 0.30;
    const agent = franchise * 0.10;
    return { totalRevenue, franchise, agent, tpvTotal: vol.tpvDebit + vol.tpvCredit + vol.tpvPix };
}

function calcClientTotalCommission(volumes: MonthVolume[]) {
    return volumes.reduce((acc, v) => { const c = calcCommission(v); return { totalRevenue: acc.totalRevenue + c.totalRevenue, franchise: acc.franchise + c.franchise, agent: acc.agent + c.agent, tpvTotal: acc.tpvTotal + c.tpvTotal }; }, { totalRevenue: 0, franchise: 0, agent: 0, tpvTotal: 0 });
}

/* ═══ STATUS BADGE ═══ */
function StatusBadge({ s }: { s: string }) {
    if (s === "cancelado") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20"><XCircle className="w-2.5 h-2.5" />Cancelado</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20"><CheckCircle className="w-2.5 h-2.5" />Ativo</span>;
}

/* ═══ MAIN ═══ */
type View = "grid" | "detail" | "new";

export default function ClientesPage() {
    const confirmAction = useConfirm();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>("grid");
    const [selId, setSelId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "ativo" | "cancelado">("all");
    const [brandFilter, setBrandFilter] = useState<string>("all");
    const [tab, setTab] = useState<"resumo" | "tpv" | "negs">("resumo");

    // New client form
    const [fn, setFN] = useState(""); const [fsc, setFSC] = useState(""); const [fcnpj, setFCNPJ] = useState("");
    const [fbrand, setFBrand] = useState("STONE"); const [fBrandCustom, setFBrandCustom] = useState(""); const [fsafra, setFSafra] = useState("M0");
    const [fph, setFPH] = useState(""); const [fem, setFEM] = useState(""); const [fseg, setFSeg] = useState("");
    const [fcategory, setFCategory] = useState("");
    const [fcd, setFCD] = useState(""); const [fDocMsg, setFDocMsg] = useState(""); const [fDocOk, setFDocOk] = useState<boolean | null>(null);
    const [cnpjLoading, setCnpjLoading] = useState(false);

    const [tpvMonth, setTpvMonth] = useState(currentMonth());
    const [tpvD, setTpvD] = useState(""); const [tpvC, setTpvC] = useState(""); const [tpvP, setTpvP] = useState("");
    const [rD, setRD] = useState(""); const [rC, setRC] = useState(""); const [rP, setRP] = useState(""); const [rR, setRR] = useState("");
    const [tpvSaving, setTpvSaving] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [tpvTotal, setTpvTotal] = useState("");

    // New negotiation form
    interface NegRatesForm { debit: string; credit1x: string; credit2to6: string; credit7to12: string; pix: string; rav: string }
    const [showNewNeg, setShowNewNeg] = useState(false);
    const [negDate, setNegDate] = useState(new Date().toISOString().split("T")[0]);
    const [negStatus, setNegStatus] = useState("prospeccao");
    const [negRates, setNegRates] = useState<NegRatesForm>({ debit: "", credit1x: "", credit2to6: "", credit7to12: "", pix: "", rav: "" });
    const [negNotes, setNegNotes] = useState("");
    const [negAlertDate, setNegAlertDate] = useState("");
    const [negCreateTask, setNegCreateTask] = useState(true);
    const [negTaskAssignee, setNegTaskAssignee] = useState("");
    const [negSaving, setNegSaving] = useState(false);
    const [negCetMode, setNegCetMode] = useState(false); // false = MDR separado, true = taxas já com CET
    const [teamUsers, setTeamUsers] = useState<{id: string; name: string; email: string}[]>([]);

    const handleAddNeg = async () => {
        if (!sel) return;
        setNegSaving(true);
        try {
            await fetch(`/api/clients/${sel.id}/negotiations`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dateNeg: negDate, status: negStatus, notes: negNotes,
                    alertDate: negAlertDate || undefined,
                    createTask: negCreateTask,
                    taskAssigneeId: negTaskAssignee || undefined,
                    rates: {
                        debit: parseFloat(negRates.debit) || 0, credit1x: parseFloat(negRates.credit1x) || 0,
                        credit2to6: parseFloat(negRates.credit2to6) || 0, credit7to12: parseFloat(negRates.credit7to12) || 0,
                        pix: parseFloat(negRates.pix) || 0, rav: parseFloat(negRates.rav) || 0,
                    },
                }),
            });
            loadClients();
            setShowNewNeg(false);
            setNegRates({ debit: "", credit1x: "", credit2to6: "", credit7to12: "", pix: "", rav: "" });
            setNegNotes(""); setNegAlertDate("");
            setNegStatus("prospeccao"); setNegCreateTask(true); setNegTaskAssignee("");
        } catch { /* */ } finally { setNegSaving(false); }
    };

    const loadClients = useCallback(async () => { try { const r = await fetch("/api/clients"); const d = await r.json(); if (Array.isArray(d)) setClients(d); } catch { } finally { setLoading(false); } }, []);
    const loadUsers = useCallback(async () => { try { const r = await fetch("/api/admin/users"); const d = await r.json(); if (Array.isArray(d)) setTeamUsers(d.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))); } catch { } }, []);
    useEffect(() => { loadClients(); loadUsers(); }, [loadClients, loadUsers]);

    const sel = clients.find(c => c.id === selId);
    const filtered = clients.filter(c => {
        if (filter === "ativo" && c.status !== "ativo") return false;
        if (filter === "cancelado" && c.status !== "cancelado") return false;
        if (brandFilter !== "all" && c.brand !== brandFilter) return false;
        if (search) { const q = search.toLowerCase(); return c.name.toLowerCase().includes(q) || c.cnpj.includes(q) || c.stoneCode.includes(q); }
        return true;
    });

    const totalPortfolio = clients.filter(c => c.status === "ativo").length;
    const allCurrentMonthVolumes = clients.flatMap(c => c.monthlyVolumes.filter(v => v.month === currentMonth()));
    const monthSummary = allCurrentMonthVolumes.reduce((a, v) => { const c = calcCommission(v); return { tpv: a.tpv + c.tpvTotal, rev: a.rev + c.totalRevenue, agent: a.agent + c.agent }; }, { tpv: 0, rev: 0, agent: 0 });

    function resetNew() { setFN(""); setFSC(""); setFCNPJ(""); setFPH(""); setFEM(""); setFSeg(""); setFCD(""); setFDocMsg(""); setFDocOk(null); setFBrand("STONE"); setFBrandCustom(""); setFSafra("M0"); setFCategory(""); }

    function calcSafra(credDate: string): string {
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

    async function handleCnpjFetch(data: { name?: string; fantasia?: string; telefone?: string; email?: string; endereco?: string; situacao?: string }) {
        if (data.name && !fn.trim()) setFN(data.fantasia || data.name);
        if (data.telefone && !fph.trim()) setFPH(data.telefone);
        if (data.email && !fem.trim()) setFEM(data.email.toLowerCase());
        if (data.situacao && !fseg.trim()) setFSeg(data.situacao);
    }

    async function handleSaveClient() {
        if (!fn.trim()) return;
        try {
            const actualBrand = fbrand === "__custom__" ? fBrandCustom.trim() || "STONE" : fbrand;
            const r = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fn, stoneCode: fsc, cnpj: fcnpj, phone: fph, email: fem, segment: fseg, credentialDate: fcd, brand: actualBrand, safra: fsafra, category: fcategory }) });
            if (r.ok) { resetNew(); setView("grid"); loadClients(); }
        } catch { }
    }

    async function handleCancelClient(id: string) {
        const { confirmed } = await confirmAction({ title: "Cancelar Cliente", message: "Tem certeza que deseja marcar este cliente como cancelado?", variant: "warning", confirmText: "Cancelar Cliente" });
        if (!confirmed) return;
        await fetch(`/api/clients/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelado", cancelDate: new Date().toISOString().split("T")[0] }) });
        loadClients();
    }

    async function handleReactivate(id: string) {
        await fetch(`/api/clients/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ativo", cancelDate: "" }) });
        loadClients();
    }

    async function handleDelete(id: string) {
        const { confirmed } = await confirmAction({ title: "Excluir Cliente", message: "Excluir cliente permanentemente? Todos os dados, negociações e histórico serão perdidos.", variant: "danger", confirmText: "Excluir Permanentemente", requireJustification: true });
        if (!confirmed) return;
        await fetch(`/api/clients/${id}`, { method: "DELETE" }); setView("grid"); setSelId(null); loadClients();
    }

    async function handleSaveTpv() {
        if (!sel) return;
        setTpvSaving(true);
        // Get current rates from latest negotiation if not filled
        const lastNeg = sel.negotiations[0];
        const rd = parseFloat(rD) || lastNeg?.rates?.debit || 0;
        const rc = parseFloat(rC) || lastNeg?.rates?.credit1x || 0;
        const rp = parseFloat(rP) || lastNeg?.rates?.pix || 0;
        try {
            await fetch(`/api/clients/${sel.id}/months`, { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: tpvMonth, tpvDebit: parseFloat(tpvD) || 0, tpvCredit: parseFloat(tpvC) || 0, tpvPix: parseFloat(tpvP) || 0, rateDebit: rd, rateCredit: rc, ratePix: rp })
            });
            loadClients(); setTpvD(""); setTpvC(""); setTpvP(""); setRD(""); setRC(""); setRP("");
        } catch { } finally { setTpvSaving(false); }
    }

    function shareWhatsApp(c: Client) {
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

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00A868]" /></div>;

    /* ═══ NEW CLIENT ═══ */
    if (view === "new") {
        return (
            <div className="max-w-2xl mx-auto space-y-5">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView("grid")} className="p-2 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
                    <h1 className="text-lg font-bold">Novo Cliente</h1>
                </div>
                <div className="card-elevated p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Nome / Razão Social *</label>
                            <input value={fn} onChange={e => setFN(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Empresa *</label>
                            {fbrand === "__custom__" ? (
                                <div className="flex gap-2">
                                    <input value={fBrandCustom} onChange={e => setFBrandCustom(e.target.value.toUpperCase())} placeholder="Nome da empresa" autoFocus
                                        className="flex-1 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" />
                                    <button type="button" onClick={() => { setFBrand("STONE"); setFBrandCustom(""); }} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted">✕</button>
                                </div>
                            ) : (
                                <select value={fbrand} onChange={e => setFBrand(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50">
                                    <option value="STONE">Stone</option>
                                    <option value="TON">Ton</option>
                                    <option value="CERVANTES">Cervantes</option>
                                    <option value="__custom__">+ Outra empresa...</option>
                                </select>
                            )}</div>
                            
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Safra Comercial {fcd && <span className="text-[9px] text-[#00A868] ml-1">(auto: {calcSafra(fcd)})</span>}</label>
                            <select value={fsafra} onChange={e => setFSafra(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50">
                                <option value="M0">M0 (Mês Inicial)</option>
                                <option value="M1">M1 (Mês Seguinte)</option>
                                <option value="M2">M2</option>
                                <option value="M3">M3</option>
                                <option value="BASE">Base Ativa</option>
                            </select></div>

                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Stone/Ton Code</label>
                            <input value={fsc} onChange={e => setFSC(e.target.value)} placeholder="123456" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">CNPJ/CPF</label>
                            <DocumentInput value={fcnpj} onChange={setFCNPJ} onCNPJData={handleCnpjFetch} allowBypass /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Telefone</label>
                            <PhoneInput value={fph} onChange={setFPH} /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">E-mail</label>
                            <input value={fem} onChange={e => setFEM(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Segmento</label>
                            <input value={fseg} onChange={e => setFSeg(e.target.value)} placeholder="Restaurante, Loja, etc." className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Categoria / Grupo</label>
                            <input value={fcategory} onChange={e => setFCategory(e.target.value)} placeholder="Ex: VIP, Parceiro, Indicação..." className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data Credenciamento</label>
                            <input type="date" value={fcd} onChange={e => { setFCD(e.target.value); setFSafra(calcSafra(e.target.value)); }} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    </div>
                </div>
                <button onClick={handleSaveClient} disabled={!fn.trim()} className="w-full py-3 rounded-xl bg-[#00A868] text-white font-bold hover:bg-[#00A868] disabled:opacity-50 transition-colors">Cadastrar Cliente</button>
            </div>
        );
    }

    /* ═══ CLIENT DETAIL ═══ */
    if (view === "detail" && sel) {
        const lastNeg = sel.negotiations[0];
        const volumes = sel.monthlyVolumes || [];
        const currentVol = volumes.find(v => v.month === currentMonth());
        const totalComm = calcClientTotalCommission(volumes);
        const currentComm = currentVol ? calcCommission(currentVol) : null;

        return (
            <div className="max-w-4xl mx-auto space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setView("grid"); setSelId(null); }} className="p-2 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5" /></button>
                        <div className="w-12 h-12 rounded-2xl bg-[#00A868]/10 border border-[#00A868]/10 flex items-center justify-center text-lg font-bold text-[#00A868]">{sel.name.charAt(0)}</div>
                        <div>
                            <h1 className="text-lg font-bold flex items-center gap-2">{sel.name} <StatusBadge s={sel.status} />
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${sel.brand === 'TON' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-green-600/10 text-green-600 border-green-600/20'}`}>{sel.brand === 'TON' ? 'TON' : 'STONE'}</span>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00A868]/10 text-[#00A868] border border-blue-500/20">Safra {sel.safra}</span>
                            </h1>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                {sel.stoneCode && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{sel.stoneCode}</span>}
                                {sel.cnpj && <span>{sel.cnpj}</span>}
                                {sel.segment && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{sel.segment}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={() => { setTab("negs"); setShowNewNeg(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00A868] text-white text-xs font-bold hover:bg-[#008f58] shadow-sm shadow-[#00A868]/20" title="Nova Renegociação">
                            <TrendingUp className="w-3.5 h-3.5" /> Renegociar
                        </button>
                        <button onClick={() => shareWhatsApp(sel)} className="p-2 rounded-xl bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20" title="WhatsApp"><MessageSquare className="w-4 h-4" /></button>
                        {sel.status === "ativo" ? (
                            <button onClick={() => handleCancelClient(sel.id)} className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" title="Cancelar"><XCircle className="w-4 h-4" /></button>
                        ) : (
                            <button onClick={() => handleReactivate(sel.id)} className="p-2 rounded-xl bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20" title="Reativar"><CheckCircle className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleDelete(sel.id)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Info cards row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="card-elevated rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Credenciamento</p>
                        <p className="text-sm font-bold mt-0.5">{fmtDate(sel.credentialDate)}</p>
                        {sel.credentialDate && <p className="text-[10px] text-muted-foreground">{daysBetween(sel.credentialDate)} dias</p>}
                    </div>
                    <div className="card-elevated rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">TPV Mês Atual</p>
                        <p className="text-sm font-bold text-[#00A868] mt-0.5">{currentComm ? fmtMoney(currentComm.tpvTotal) : "—"}</p>
                    </div>
                    <div className="card-elevated rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Comissão Mês</p>
                        <p className="text-sm font-bold text-purple-500 mt-0.5">{currentComm ? fmtMoney(currentComm.agent) : "—"}</p>
                    </div>
                    <div className="card-elevated rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">Negociações</p>
                        <p className="text-sm font-bold mt-0.5">{sel.negotiations.length}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
                    {([["resumo", "Resumo & TPV"], ["tpv", "Registrar TPV"], ["negs", "Negociações"]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                    ))}
                </div>

                {/* TAB: Resumo & TPV History */}
                {tab === "resumo" && (
                    <div className="space-y-4">
                        {/* Contact info */}
                        <div className="card-elevated rounded-xl p-4">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Dados de Contato</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {sel.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{sel.phone}</div>}
                                {sel.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{sel.email}</div>}
                                {sel.cancelDate && <div className="flex items-center gap-2 text-red-500"><Calendar className="w-3.5 h-3.5" />Cancelado: {fmtDate(sel.cancelDate)}</div>}
                            </div>
                        </div>

                        {/* Current rates from last negotiation */}
                        {lastNeg && (
                            <div className="bg-card border border-[#00A868]/20 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-[#00A868] uppercase mb-3">Taxas Vigentes</h3>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {[{ l: "Débito", v: lastNeg.rates?.debit }, { l: "1x", v: lastNeg.rates?.credit1x }, { l: "2-6x", v: lastNeg.rates?.credit2to6 }, { l: "7-12x", v: lastNeg.rates?.credit7to12 }, { l: "PIX", v: lastNeg.rates?.pix }, { l: "RAV", v: lastNeg.rates?.rav }].map(r => (
                                        <div key={r.l} className="bg-secondary/50 rounded-lg p-2 text-center">
                                            <p className="text-[10px] text-muted-foreground">{r.l}</p>
                                            <p className="text-sm font-bold">{formatPercent(r.v || 0)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TPV History  */}
                        <div className="card-elevated rounded-xl p-4">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Histórico TPV & Comissões</h3>
                            {volumes.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">Nenhum TPV registrado. Use a aba "Registrar TPV" para adicionar.</p>
                            ) : (
                                <div className="overflow-x-auto -mx-4 px-4">
                                    <table className="w-full text-xs">
                                        <thead><tr className="border-b border-border">
                                            <th className="text-left py-2 text-muted-foreground font-semibold">Mês</th>
                                            <th className="text-right py-2 text-muted-foreground font-semibold">TPV Débito</th>
                                            <th className="text-right py-2 text-muted-foreground font-semibold">TPV Crédito</th>
                                            <th className="text-right py-2 text-muted-foreground font-semibold">TPV PIX</th>
                                            <th className="text-right py-2 text-muted-foreground font-semibold">TPV Total</th>
                                            <th className="text-right py-2 text-muted-foreground font-semibold">Receita Taxas</th>
                                            <th className="text-right py-2 text-purple-500 font-semibold">Comissão</th>
                                        </tr></thead>
                                        <tbody>
                                            {volumes.map(v => { const c = calcCommission(v); return (
                                                <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30">
                                                    <td className="py-2 font-semibold">{fmtMonth(v.month)}</td>
                                                    <td className="py-2 text-right">{fmtMoney(v.tpvDebit)}</td>
                                                    <td className="py-2 text-right">{fmtMoney(v.tpvCredit)}</td>
                                                    <td className="py-2 text-right">{fmtMoney(v.tpvPix)}</td>
                                                    <td className="py-2 text-right font-bold">{fmtMoney(c.tpvTotal)}</td>
                                                    <td className="py-2 text-right text-amber-500">{fmtMoney(c.totalRevenue)}</td>
                                                    <td className="py-2 text-right font-bold text-purple-500">{fmtMoney(c.agent)}</td>
                                                </tr>
                                            ); })}
                                            <tr className="border-t-2 border-border font-bold">
                                                <td className="py-2">Total</td>
                                                <td className="py-2 text-right" colSpan={3}></td>
                                                <td className="py-2 text-right">{fmtMoney(totalComm.tpvTotal)}</td>
                                                <td className="py-2 text-right text-amber-500">{fmtMoney(totalComm.totalRevenue)}</td>
                                                <td className="py-2 text-right text-purple-500">{fmtMoney(totalComm.agent)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: Registrar TPV */}
                {tab === "tpv" && (() => {
                    // Auto-distribute when not using breakdown
                    const totalVal = parseFloat(tpvTotal) || 0;
                    const autoD = totalVal * 0.30;
                    const autoC = totalVal * 0.50;
                    const autoP = totalVal * 0.20;

                    const effectiveD = showBreakdown ? (parseFloat(tpvD) || 0) : autoD;
                    const effectiveC = showBreakdown ? (parseFloat(tpvC) || 0) : autoC;
                    const effectiveP = showBreakdown ? (parseFloat(tpvP) || 0) : autoP;
                    const effectiveTotal = showBreakdown ? (effectiveD + effectiveC + effectiveP) : totalVal;

                    const previewReady = effectiveTotal > 0;
                    const previewVol = { tpvDebit: effectiveD, tpvCredit: effectiveC, tpvPix: effectiveP, rateDebit: parseFloat(rD) || lastNeg?.rates?.debit || 0, rateCredit: parseFloat(rC) || lastNeg?.rates?.credit1x || 0, ratePix: parseFloat(rP) || lastNeg?.rates?.pix || 0 } as MonthVolume;
                    const preview = previewReady ? calcCommission(previewVol) : null;

                    const handleSaveTpvNew = async () => {
                        if (!sel) return;
                        setTpvSaving(true);
                        const rd = parseFloat(rD) || lastNeg?.rates?.debit || 0;
                        const rc = parseFloat(rC) || lastNeg?.rates?.credit1x || 0;
                        const rp = parseFloat(rP) || lastNeg?.rates?.pix || 0;
                        const rr = parseFloat(rR) || lastNeg?.rates?.rav || 0;
                        try {
                            await fetch(`/api/clients/${sel.id}/months`, { method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ month: tpvMonth, tpvDebit: effectiveD, tpvCredit: effectiveC, tpvPix: effectiveP, rateDebit: rd, rateCredit: rc, ratePix: rp, rateRav: rr })
                            });
                            loadClients(); setTpvD(""); setTpvC(""); setTpvP(""); setTpvTotal(""); setRD(""); setRC(""); setRP(""); setRR("");
                        } catch { } finally { setTpvSaving(false); }
                    };

                    return (
                    <div className="bg-card border border-blue-500/20 rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-blue-500 uppercase">Registrar TPV do Mês</h3>

                        {/* Month selector UI */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-2">Mês de Referência</label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {[0, 1, 2, 3].map(mOff => {
                                    const d = new Date(); d.setMonth(d.getMonth() - mOff);
                                    const mVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                    const lbl = mOff === 0 ? "Mês Atual" : mOff === 1 ? "Mês Passado" : fmtMonth(mVal);
                                    return (
                                        <button key={mVal} type="button" onClick={() => setTpvMonth(mVal)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${tpvMonth === mVal ? "bg-blue-600 text-white" : "bg-card border border-border text-muted-foreground hover:bg-muted"}`}>
                                            {lbl}
                                        </button>
                                    );
                                })}
                                <div className="relative">
                                    <input type="month" value={tpvMonth} onChange={e => setTpvMonth(e.target.value)} 
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                    <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-muted-foreground hover:bg-muted flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" /> Outro...
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* TPV Total — Primary Input */}
                        <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-500/20 rounded-xl p-4">
                            <label className="text-xs font-bold text-blue-500 uppercase block mb-2">TPV Total (R$)</label>
                            <input type="number" value={showBreakdown ? "" : tpvTotal} onChange={e => setTpvTotal(e.target.value)}
                                disabled={showBreakdown}
                                placeholder="Ex: 100000.00"
                                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-lg font-bold text-foreground focus:outline-none focus:border-[#00A868]/50 disabled:opacity-40" />
                            {!showBreakdown && totalVal > 0 && (
                                <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                                    <span>Déb (30%): {fmtMoney(autoD)}</span>
                                    <span>Créd (50%): {fmtMoney(autoC)}</span>
                                    <span>PIX (20%): {fmtMoney(autoP)}</span>
                                </div>
                            )}
                        </div>

                        {/* Modality Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-9 h-5 rounded-full relative transition-colors ${showBreakdown ? "bg-blue-500" : "bg-muted"}`}
                                onClick={() => { setShowBreakdown(!showBreakdown); if (!showBreakdown) { setTpvTotal(""); } }}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${showBreakdown ? "left-[18px]" : "left-0.5"}`} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">Detalhar por Modalidade</span>
                        </label>

                        {/* Modality Breakdown (optional) */}
                        {showBreakdown && (
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="text-xs font-medium text-muted-foreground block mb-1">TPV Débito (R$)</label>
                                    <input type="number" value={tpvD} onChange={e => setTpvD(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                                <div><label className="text-xs font-medium text-muted-foreground block mb-1">TPV Crédito (R$)</label>
                                    <input type="number" value={tpvC} onChange={e => setTpvC(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                                <div><label className="text-xs font-medium text-muted-foreground block mb-1">TPV PIX (R$)</label>
                                    <input type="number" value={tpvP} onChange={e => setTpvP(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                            </div>
                        )}

                        {/* Rates */}
                        <div className="flex items-end justify-between">
                            <p className="text-xs text-muted-foreground">Taxas da negociação ou personalize:</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div><label className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase">Taxa Déb (%)</label>
                                <input type="number" step="0.01" value={rD} onChange={e => setRD(e.target.value)} placeholder={lastNeg?.rates?.debit?.toString() || "0"} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs focus:outline-none focus:border-[#00A868]/50" /></div>
                            <div><label className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase">Taxa Créd (%)</label>
                                <input type="number" step="0.01" value={rC} onChange={e => setRC(e.target.value)} placeholder={lastNeg?.rates?.credit1x?.toString() || "0"} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs focus:outline-none focus:border-[#00A868]/50" /></div>
                            <div><label className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase">Taxa PIX (%)</label>
                                <input type="number" step="0.01" value={rP} onChange={e => setRP(e.target.value)} placeholder={lastNeg?.rates?.pix?.toString() || "0"} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs focus:outline-none focus:border-[#00A868]/50" /></div>
                            <div><label className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase">Taxa RAV (%)</label>
                                <input type="number" step="0.01" value={rR} onChange={e => setRR(e.target.value)} placeholder={lastNeg?.rates?.rav?.toString() || "0"} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs focus:outline-none focus:border-[#00A868]/50" /></div>
                        </div>

                        {/* Preview */}
                        {preview && (
                            <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-4 space-y-2">
                                <h4 className="text-xs font-bold text-purple-500 uppercase">Preview do Cálculo</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                    <div><p className="text-[10px] text-muted-foreground">TPV Total</p><p className="text-sm font-bold">{fmtMoney(preview.tpvTotal)}</p></div>
                                    <div><p className="text-[10px] text-muted-foreground">Receita Taxas</p><p className="text-sm font-bold text-amber-500">{fmtMoney(preview.totalRevenue)}</p></div>
                                    <div><p className="text-[10px] text-muted-foreground">Franquia (30%)</p><p className="text-sm font-bold text-blue-500">{fmtMoney(preview.franchise)}</p></div>
                                    <div><p className="text-[10px] text-muted-foreground">Sua Comissão (10%)</p><p className="text-lg font-black text-purple-500">{fmtMoney(preview.agent)}</p></div>
                                </div>
                            </div>
                        )}

                        <button onClick={handleSaveTpvNew} disabled={tpvSaving || !previewReady} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {tpvSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Salvar TPV de {fmtMonth(tpvMonth)}
                        </button>
                    </div>
                    );
                })()}

                {/* TAB: Negociações */}
                {tab === "negs" && (
                    <div className="space-y-3">
                        {/* Nova Renegociação Form */}
                        {showNewNeg ? (
                            <div className="card-elevated rounded-xl p-5 space-y-3 border border-[#00A868]/20">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-[#00A868] uppercase flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Nova Renegociação
                                    </h3>
                                    <button onClick={() => setShowNewNeg(false)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data</label>
                                        <input type="date" value={negDate} onChange={e => setNegDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none [color-scheme:dark]" /></div>
                                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                                        <select value={negStatus} onChange={e => setNegStatus(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none">
                                            <option value="prospeccao">Prospecção</option><option value="proposta_enviada">Proposta Enviada</option>
                                            <option value="aguardando_cliente">Aguardando Cliente</option><option value="aprovado">Aprovado</option>
                                            <option value="recusado">Recusado</option><option value="fechado">Fechado</option>
                                        </select></div>
                                </div>

                                {/* Toggle MDR vs CET */}
                                <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-2">
                                    <button type="button" onClick={() => { setNegCetMode(false); setNegRates(r => ({ ...r, rav: "" })); }}
                                        className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${!negCetMode ? "bg-[#00A868] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                        Taxas MDR
                                    </button>
                                    <button type="button" onClick={() => setNegCetMode(true)}
                                        className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${negCetMode ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                        Taxas com CET
                                    </button>
                                </div>
                                <p className="text-[9px] text-muted-foreground/70 -mt-1">
                                    {negCetMode
                                        ? "📌 Informe as taxas finais (MDR + antecipação). O RAV já está embutido."
                                        : "📌 Informe o MDR puro. O RAV será registrado separadamente."}
                                </p>

                                <div className={`grid gap-2 ${negCetMode ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-6"}`}>
                                    {([["Débito", negRates.debit, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, debit: v }))],
                                      [`Créd 1x${negCetMode ? " (CET)" : ""}`, negRates.credit1x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit1x: v }))],
                                      [`2-6x${negCetMode ? " (CET)" : ""}`, negRates.credit2to6, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit2to6: v }))],
                                      [`7-12x${negCetMode ? " (CET)" : ""}`, negRates.credit7to12, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit7to12: v }))],
                                      ["PIX", negRates.pix, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, pix: v }))],
                                      ...(!negCetMode ? [["RAV", negRates.rav, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, rav: v }))]] : []),
                                    ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                                        <div key={label as string}><label className="text-[10px] font-medium text-muted-foreground block mb-0.5">{label as string} (%)</label>
                                            <input type="number" step="0.01" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} placeholder="0.00"
                                                className="w-full px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-center focus:outline-none focus:border-[#00A868]/50" /></div>
                                    ))}
                                </div>
                                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Observações</label>
                                    <textarea value={negNotes} onChange={e => setNegNotes(e.target.value)} rows={2} placeholder="Notas sobre a renegociação..."
                                        className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none resize-none" /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">🔔 Alerta de Renegociação</label>
                                        <input type="date" value={negAlertDate} onChange={e => setNegAlertDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none [color-scheme:dark]" />
                                        <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1 scrollbar-none">
                                            {[30, 60, 90, 180].map(d => (
                                                <button key={d} type="button" onClick={() => {
                                                    const date = new Date();
                                                    date.setDate(date.getDate() + d);
                                                    setNegAlertDate(date.toISOString().split("T")[0]);
                                                }} className="px-2 py-0.5 rounded-md bg-secondary border border-border text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted whitespace-nowrap shrink-0">
                                                    +{d} dias
                                                </button>
                                            ))}
                                            {negAlertDate && (
                                                <button type="button" onClick={() => setNegAlertDate("")} className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[9px] font-medium hover:bg-red-500/20 whitespace-nowrap shrink-0">
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {negAlertDate && (
                                        <div className="flex items-end pb-1">
                                            <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Renegociar — ${sel?.name}`)}&dates=${negAlertDate.replace(/-/g, '')}T090000Z/${negAlertDate.replace(/-/g, '')}T100000Z&details=${encodeURIComponent(`Cliente: ${sel?.name}\nCNPJ: ${sel?.cnpj}\n\n— BitTask`)}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-500 text-xs font-bold hover:bg-blue-500/20 transition-colors">
                                                <Calendar className="w-3.5 h-3.5" /> Google Calendar
                                            </a>
                                        </div>
                                    )}
                                </div>
                                {/* Task auto-creation */}
                                <div className={`rounded-xl p-3 transition-all ${negCreateTask ? "bg-blue-500/5 border border-blue-500/20" : "bg-secondary/30 border border-border/30"}`}>
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <div className={`relative w-9 h-5 rounded-full transition-colors ${negCreateTask ? 'bg-blue-500' : 'bg-secondary border border-border'}`}
                                            onClick={() => setNegCreateTask(!negCreateTask)}>
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${negCreateTask ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-foreground">📋 Criar Tarefa de Acompanhamento</span>
                                            <p className="text-[9px] text-muted-foreground/60">Gera tarefa automática para validar/acompanhar</p>
                                        </div>
                                    </label>
                                    {negCreateTask && (
                                        <div className="mt-2 pt-2 border-t border-border/30">
                                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Atribuir tarefa para</label>
                                            <select value={negTaskAssignee} onChange={e => setNegTaskAssignee(e.target.value)}
                                                className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none">
                                                <option value="">Eu mesmo</option>
                                                {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleAddNeg} disabled={negSaving}
                                    className="w-full py-2.5 bg-[#00A868] text-white rounded-xl text-sm font-bold hover:bg-[#008f58] disabled:opacity-50 flex items-center justify-center gap-2">
                                    {negSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Renegociação
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setShowNewNeg(true)}
                                className="w-full py-3 border-2 border-dashed border-[#00A868]/30 rounded-xl text-sm font-semibold text-[#00A868] hover:bg-[#00A868]/5 transition-colors flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Nova Renegociação
                            </button>
                        )}

                        {sel.negotiations.length === 0 && !showNewNeg ? (
                            <div className="card-elevated rounded-xl p-8 text-center text-muted-foreground">
                                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Nenhuma negociação registrada.</p>
                            </div>
                        ) : sel.negotiations.map((neg, i) => {
                            const stLabel: Record<string, string> = { prospeccao: "Prospecção", proposta_enviada: "Proposta Enviada", aguardando_cliente: "Aguardando Cliente", aprovado: "Aprovado", recusado: "Recusado", fechado: "Fechado", pendente: "Pendente", aceita: "Aprovado", recusada: "Recusado" };
                            const stColor: Record<string, string> = { prospeccao: "bg-slate-500/10 text-slate-500", proposta_enviada: "bg-[#00A868]/10 text-[#00A868]", aguardando_cliente: "bg-amber-500/10 text-amber-500", aprovado: "bg-[#00A868]/10 text-[#00A868]", recusado: "bg-red-500/10 text-red-500", fechado: "bg-purple-500/10 text-purple-500", pendente: "bg-amber-500/10 text-amber-500", aceita: "bg-[#00A868]/10 text-[#00A868]", recusada: "bg-red-500/10 text-red-500" };
                            return (
                                <div key={neg.id} className={`bg-card border rounded-xl p-4 ${i === 0 ? "border-[#00A868]/20" : "border-border"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stColor[neg.status] || "bg-muted text-muted-foreground"}`}>{stLabel[neg.status] || neg.status}</span>
                                            {i === 0 && <span className="text-[10px] font-bold text-[#00A868] bg-[#00A868]/10 px-2 py-0.5 rounded-full">Mais recente</span>}
                                            {neg.assignee && <span className="text-[10px] text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">{neg.assignee.name}</span>}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{fmtDate(neg.dateNeg)}</span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                        {[{ l: "Déb", v: neg.rates?.debit }, { l: "1x", v: neg.rates?.credit1x }, { l: "2-6x", v: neg.rates?.credit2to6 }, { l: "7-12x", v: neg.rates?.credit7to12 }, { l: "PIX", v: neg.rates?.pix }, { l: "RAV", v: neg.rates?.rav }].map(r => (
                                            <div key={r.l} className="bg-secondary/50 rounded-lg p-1.5 text-center">
                                                <p className="text-[10px] text-muted-foreground">{r.l}</p>
                                                <p className="text-xs font-bold">{formatPercent(r.v || 0)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {/* CET calculado */}
                                    {(neg.rates?.rav > 0 || neg.rates?.ravRate > 0) && (
                                        <div className="grid grid-cols-4 gap-1.5 mt-1">
                                            {[{ l: "CET 1x", inst: 1, mdr: neg.rates?.credit1x }, { l: "CET 6x", inst: 6, mdr: neg.rates?.credit2to6 }, { l: "CET 12x", inst: 12, mdr: neg.rates?.credit7to12 }, { l: "CET Méd", inst: 0, mdr: 0 }].map(r => {
                                                const ravVal = neg.rates?.ravRate ?? neg.rates?.rav ?? 0;
                                                const cet = r.inst > 0 ? calculateCET(r.mdr || 0, ravVal, r.inst) : ((calculateCET(neg.rates?.credit1x || 0, ravVal, 1) + calculateCET(neg.rates?.credit2to6 || 0, ravVal, 6) + calculateCET(neg.rates?.credit7to12 || 0, ravVal, 12)) / 3);
                                                const color = cet < 5 ? "text-[#00A868]" : cet < 10 ? "text-amber-500" : "text-red-500";
                                                return (
                                                    <div key={r.l} className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-1.5 text-center">
                                                        <p className="text-[9px] text-blue-400 font-medium">{r.l}</p>
                                                        <p className={`text-xs font-bold ${color}`}>{formatPercent(cet)}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {neg.notes && <p className="text-xs text-muted-foreground mt-2 italic">{neg.notes}</p>}
                                    {neg.stageHistory && neg.stageHistory.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                                            {neg.stageHistory.slice(-3).map((h: any, j: number) => (
                                                <div key={j} className="flex items-center gap-1 text-[9px] text-muted-foreground/70">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    <span>{stLabel[h.from] || h.from || "Início"}</span>
                                                    <ChevronRight className="w-2.5 h-2.5" />
                                                    <span className="font-medium">{stLabel[h.to] || h.to}</span>
                                                    <span className="ml-auto">{new Date(h.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    /* ═══ GRID VIEW ═══ */
    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20"><Users className="w-4 h-4" /></div>
                    <div>
                        <h1 className="text-lg font-bold">Carteira de Clientes</h1>
                        <p className="text-xs text-muted-foreground">{totalPortfolio} ativos · TPV mês: {fmtMoney(monthSummary.tpv)} · Comissão: {fmtMoney(monthSummary.agent)}</p>
                    </div>
                </div>
                <button onClick={() => { resetNew(); setView("new"); }} className="flex items-center gap-2 px-4 py-2 bg-[#00A868] hover:bg-[#00A868] text-white rounded-xl text-sm font-medium shadow-lg shadow-[#00A868]/20">
                    <Plus className="w-4 h-4" /> Novo Cliente
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-[#00A868]" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Carteira Ativa</span></div>
                    <p className="text-2xl font-black text-foreground">{totalPortfolio}</p>
                </div>
                <div className="card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-blue-500" /><span className="text-[10px] font-bold text-muted-foreground uppercase">TPV Mês</span></div>
                    <p className="text-lg sm:text-2xl font-black text-foreground">{fmtMoney(monthSummary.tpv)}</p>
                </div>
                <div className="card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Receita Taxas</span></div>
                    <p className="text-lg sm:text-2xl font-black text-amber-500">{fmtMoney(monthSummary.rev)}</p>
                </div>
                <div className="bg-card border border-purple-500/20 rounded-xl p-4 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
                    <div className="flex items-center gap-2 mb-1"><Star className="w-4 h-4 text-purple-500" /><span className="text-[10px] font-bold text-purple-500 uppercase">Sua Comissão</span></div>
                    <p className="text-lg sm:text-2xl font-black text-purple-500">{fmtMoney(monthSummary.agent)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1"><Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou Stone Code..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                <div className="flex gap-1 bg-secondary/50 rounded-xl p-0.5">
                    {([["all", "Todos"], ["ativo", "Ativos"], ["cancelado", "Cancelados"]] as const).map(([key, lbl]) => (
                        <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{lbl}</button>
                    ))}
                </div>
                <div className="flex gap-1 bg-secondary/50 rounded-xl p-0.5 flex-wrap">
                    <button onClick={() => setBrandFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${brandFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>🏢 Todos</button>
                    {[...new Set(clients.map(c => c.brand).filter(Boolean))].sort().map(b => (
                        <button key={b} onClick={() => setBrandFilter(b)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${brandFilter === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                            {b === "STONE" ? "🟢" : b === "TON" ? "🔵" : "🏷️"} {b}
                        </button>
                    ))}
                </div>
            </div>

            {/* Client cards */}
            {filtered.length === 0 ? (
                <div className="card-elevated p-12 text-center">
                    <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="font-semibold">Nenhum cliente encontrado</p>
                    <p className="text-sm text-muted-foreground mt-1">Cadastre clientes para montar sua carteira.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map(c => {
                        const cv = c.monthlyVolumes.find(v => v.month === currentMonth());
                        const comm = cv ? calcCommission(cv) : null;
                        const lastNeg = c.negotiations[0];
                        return (
                            <button key={c.id} onClick={() => { setSelId(c.id); setView("detail"); setTab("resumo"); }}
                                className="card-elevated rounded-xl p-4 text-left hover:border-[#00A868]/30 hover:shadow-md transition-all group">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#00A868]/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-[#00A868]">{c.name.charAt(0)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate">{c.name}</p>
                                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                                            {c.stoneCode && <span>SC: {c.stoneCode}</span>}
                                            {c.segment && <span>{c.segment}</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <StatusBadge s={c.status} />
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold border ${c.brand === 'TON' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-green-600/10 text-green-600 border-green-600/20'}`}>{c.brand === 'TON' ? 'TON' : 'STONE'}</span>
                                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#00A868]/10 text-[#00A868] border border-blue-500/20">{c.safra}</span>
                                        </div>
                                    </div>
                                </div>
                                {comm ? (
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="bg-secondary/50 rounded-lg p-2 text-center"><p className="text-[9px] text-muted-foreground">TPV</p><p className="text-xs font-bold">{fmtMoney(comm.tpvTotal)}</p></div>
                                        <div className="bg-secondary/50 rounded-lg p-2 text-center"><p className="text-[9px] text-muted-foreground">Taxas</p><p className="text-xs font-bold text-amber-500">{fmtMoney(comm.totalRevenue)}</p></div>
                                        <div className="bg-purple-500/5 rounded-lg p-2 text-center border border-purple-500/10"><p className="text-[9px] text-purple-500">Comissão</p><p className="text-xs font-bold text-purple-500">{fmtMoney(comm.agent)}</p></div>
                                    </div>
                                ) : (
                                    <div className="text-center py-2"><p className="text-[10px] text-muted-foreground/50">Registre o TPV deste mês</p></div>
                                )}
                                {lastNeg && (
                                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Déb: {formatPercent(lastNeg.rates?.debit || 0)} | 1x: {formatPercent(lastNeg.rates?.credit1x || 0)}</span>
                                        <span>{c.negotiations.length} neg.</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
