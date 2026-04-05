"use client";

import { useState } from "react";
import { formatPercent, calculateCET } from "@/lib/calculator";
import {
    ChevronLeft, TrendingUp, MessageSquare, XCircle, CheckCircle, Trash2,
    Phone, Mail, Calendar, Hash, Building2, Plus, X, FileText, ChevronRight,
    Clock, Loader2, BarChart3, Pencil, Save
} from "lucide-react";
import {
    Client, MonthVolume, fmtDate, fmtMoney, fmtMonth, currentMonth,
    daysBetween, calcCommission, calcClientTotalCommission, shareWhatsApp
} from "./types";
import { useConfirm } from "@/components/ConfirmModal";

function StatusBadge({ s }: { s: string }) {
    if (s === "cancelado") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20"><XCircle className="w-2.5 h-2.5" />Cancelado</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20"><CheckCircle className="w-2.5 h-2.5" />Ativo</span>;
}

interface NegRatesForm { debit: string; credit1x: string; credit2to6: string; credit7to12: string; pix: string; rav: string }

export function ClientDetail({ client, teamUsers, loadClients, onBack, onCancelClient, onReactivate, onDelete }: {
    client: Client;
    teamUsers: { id: string; name: string; email: string }[];
    loadClients: () => void;
    onBack: () => void;
    onCancelClient: (id: string) => Promise<void>;
    onReactivate: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const confirmAction = useConfirm();
    const [tab, setTab] = useState<"resumo" | "negs">("resumo");

    // TPV form (simplified — rates auto-pulled from last negotiation)
    const [showTpvForm, setShowTpvForm] = useState(false);
    const [tpvMonth, setTpvMonth] = useState(currentMonth());
    const [tpvTotal, setTpvTotal] = useState("");
    const [tpvD, setTpvD] = useState(""); const [tpvC, setTpvC] = useState(""); const [tpvP, setTpvP] = useState("");
    const [tpvSaving, setTpvSaving] = useState(false);
    const [showTpvAdvanced, setShowTpvAdvanced] = useState(false);
    const BRANDS = ["Mastercard", "Visa", "Elo", "Hiper", "Amex"] as const;
    const emptyBrands = () => Object.fromEntries(BRANDS.map(b => [b, ""]));
    const [brandDebit, setBrandDebit] = useState<Record<string, string>>(emptyBrands());
    const [brandCredit, setBrandCredit] = useState<Record<string, string>>(emptyBrands());

    // Neg form
    const [showNewNeg, setShowNewNeg] = useState(false);
    const [negDate, setNegDate] = useState(new Date().toISOString().split("T")[0]);
    const [negStatus, setNegStatus] = useState("analise");
    const [negRates, setNegRates] = useState<NegRatesForm>({ debit: "", credit1x: "", credit2to6: "", credit7to12: "", pix: "", rav: "" });
    const [negNotes, setNegNotes] = useState("");
    const [negAlertDate, setNegAlertDate] = useState("");
    const [negCreateTask, setNegCreateTask] = useState(true);
    const [negTaskAssignee, setNegTaskAssignee] = useState("");
    const [negSaving, setNegSaving] = useState(false);
    const [negCetMode, setNegCetMode] = useState(false);

    // Dispatch form
    const [showDispatch, setShowDispatch] = useState(false);
    const [dispatchTitle, setDispatchTitle] = useState("");
    const [dispatchDate, setDispatchDate] = useState("");
    const [dispatchAssignee, setDispatchAssignee] = useState("");
    const [dispatchSaving, setDispatchSaving] = useState(false);

    const sel = client;
    const lastNeg = sel.negotiations[0];
    const volumes = sel.monthlyVolumes || [];
    const currentVol = volumes.find(v => v.month === currentMonth());
    const totalComm = calcClientTotalCommission(volumes);
    const currentComm = currentVol ? calcCommission(currentVol) : null;

    // Client edit mode
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({ name: sel.name, phone: sel.phone, email: sel.email, cnpj: sel.cnpj, stoneCode: sel.stoneCode, segment: sel.segment, category: sel.category || "" });
    const [editSaving, setEditSaving] = useState(false);

    const handleSaveEdit = async () => {
        setEditSaving(true);
        try {
            await fetch(`/api/clients/${sel.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editData),
            });
            loadClients();
            setEditing(false);
        } catch { /* */ } finally { setEditSaving(false); }
    };

    const handleAddNeg = async () => {
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
            setNegStatus("analise"); setNegCreateTask(true); setNegTaskAssignee("");
        } catch { /* */ } finally { setNegSaving(false); }
    };

    const handleDispatch = async () => {
        if (!dispatchTitle.trim()) return alert("Insira um título para a visita/tarefa.");
        if (!dispatchAssignee) return alert("Selecione um Agente para receber a demanda.");
        setDispatchSaving(true);
        try {
            const res = await fetch(`/api/clients/${sel.id}/tasks`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: dispatchTitle.trim(),
                    date: dispatchDate,
                    assigneeId: dispatchAssignee,
                    priority: "high"
                })
            });
            if (res.ok) {
                setShowDispatch(false);
                setDispatchTitle(""); setDispatchDate(""); setDispatchAssignee("");
                alert("Atendimento despachado com sucesso!");
            } else { alert("Erro ao despachar"); }
        } catch { alert("Erro de rede"); } finally { setDispatchSaving(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-5 relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted touch-target"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="w-12 h-12 rounded-2xl bg-[#00A868]/10 border border-[#00A868]/10 flex items-center justify-center text-lg font-bold text-[#00A868]">{sel.name.charAt(0)}</div>
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2 flex-wrap">{sel.name} <StatusBadge s={sel.status} />
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
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => setShowDispatch(!showDispatch)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-500 text-xs font-bold hover:bg-indigo-500/20 shadow-sm shadow-indigo-500/10 touch-target" title="Despachar Atendimento">
                        <Clock className="w-3.5 h-3.5" /> Despachar
                    </button>
                    <button onClick={() => { setTab("negs"); setShowNewNeg(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00A868] text-white text-xs font-bold hover:bg-[#008f58] shadow-sm shadow-[#00A868]/20 touch-target" title="Nova Renegociação">
                        <TrendingUp className="w-3.5 h-3.5" /> Renegociar
                    </button>
                    <button onClick={() => { setEditing(!editing); setEditData({ name: sel.name, phone: sel.phone, email: sel.email, cnpj: sel.cnpj, stoneCode: sel.stoneCode, segment: sel.segment, category: sel.category || "" }); }} className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 touch-target" title="Editar Dados">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => shareWhatsApp(sel)} className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 touch-target" title="WhatsApp">
                        <MessageSquare className="w-4 h-4" />
                    </button>
                    {sel.status === "ativo" ? (
                        <button onClick={() => onCancelClient(sel.id)} className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 touch-target" title="Cancelar">
                            <XCircle className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={() => onReactivate(sel.id)} className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 touch-target" title="Reativar">
                            <CheckCircle className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => onDelete(sel.id)} className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 touch-target" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Dispatch Form Panel */}
            {showDispatch && (
                <div className="card-elevated rounded-xl p-5 space-y-4 border border-indigo-500/30 bg-indigo-500/5 animate-slide-up relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-indigo-500 uppercase flex items-center gap-2">🚁 Despachar Atendimento p/ Base</h3>
                        <button onClick={() => setShowDispatch(false)} className="p-1 rounded-lg hover:bg-indigo-500/10"><X className="w-4 h-4 text-indigo-500" /></button>
                    </div>
                    <p className="text-xs text-muted-foreground">Delegue uma visita, cobrança ou instalação rápida para outro agente da Franquia. A tarefa entrará na caixa &quot;Base da Franquia&quot; do agente selecionado.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="lg:col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Título / Demanda</label>
                            <input value={dispatchTitle} onChange={e => setDispatchTitle(e.target.value)} placeholder="Ex: Substituir máquina S920 urgentemente" className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-indigo-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data Agendada (Opcional)</label>
                            <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none [color-scheme:dark]" /></div>
                    </div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Agente Responsável (Quem atende?)</label>
                        <select value={dispatchAssignee} onChange={e => setDispatchAssignee(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-indigo-500/50">
                            <option value="">Selecione um membro da equipe</option>
                            {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button onClick={handleDispatch} disabled={dispatchSaving} className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm shadow-md">
                            {dispatchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "🚀 Despachar Tarefa"}
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Client Panel */}
            {editing && (
                <div className="card-elevated rounded-xl p-5 space-y-3 border border-blue-500/20 animate-slide-up">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-blue-500 uppercase flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar Dados do Cliente</h3>
                        <button onClick={() => setEditing(false)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Nome / Razão Social</label>
                            <input type="text" value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">CNPJ</label>
                            <input type="text" value={editData.cnpj} onChange={e => setEditData(d => ({ ...d, cnpj: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Telefone</label>
                            <input type="tel" value={editData.phone} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">E-mail</label>
                            <input type="email" value={editData.email} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Stone Code</label>
                            <input type="text" value={editData.stoneCode} onChange={e => setEditData(d => ({ ...d, stoneCode: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Segmento</label>
                            <input type="text" value={editData.segment} onChange={e => setEditData(d => ({ ...d, segment: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" /></div>
                    </div>
                    <button onClick={handleSaveEdit} disabled={editSaving || !editData.name.trim()}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Alterações
                    </button>
                </div>
            )}

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
            <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 overflow-x-auto">
                {([["resumo", "Resumo & TPV"], ["negs", "Negociações"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                ))}
            </div>

            {/* TAB: Resumo & TPV */}
            {tab === "resumo" && (() => {
                const totalVal = parseFloat(tpvTotal) || 0;
                const manualD = parseFloat(tpvD) || 0; const manualC = parseFloat(tpvC) || 0; const manualP = parseFloat(tpvP) || 0;
                const hasManual = manualD > 0 || manualC > 0 || manualP > 0;
                const effectiveD = hasManual ? manualD : totalVal * 0.30;
                const effectiveC = hasManual ? manualC : totalVal * 0.50;
                const effectiveP = hasManual ? manualP : totalVal * 0.20;
                const effectiveTotal = hasManual ? (manualD + manualC + manualP) : totalVal;
                const pctD = effectiveTotal > 0 ? (effectiveD / effectiveTotal * 100) : 0;
                const pctC = effectiveTotal > 0 ? (effectiveC / effectiveTotal * 100) : 0;
                const pctP = effectiveTotal > 0 ? (effectiveP / effectiveTotal * 100) : 0;

                // Auto-sync total when typing manual fields
                const autoTotal = hasManual ? fmtMoney(manualD + manualC + manualP) : "";

                // Rates from last negotiation
                const rateD = lastNeg?.rates?.debit || 0;
                const rateC = lastNeg?.rates?.credit1x || 0;
                const rateP = lastNeg?.rates?.pix || 0;

                // Preview commission calc
                const previewReady = effectiveTotal > 0;
                const previewVol = { tpvDebit: effectiveD, tpvCredit: effectiveC, tpvPix: effectiveP, rateDebit: rateD, rateCredit: rateC, ratePix: rateP } as MonthVolume;
                const preview = previewReady ? calcCommission(previewVol) : null;

                // Brand breakdown helper
                const buildBreakdown = () => {
                    const bd: any = {};
                    const hasAny = (obj: Record<string, string>) => Object.values(obj).some(v => parseFloat(v) > 0);
                    if (hasAny(brandDebit)) bd.debit = Object.fromEntries(Object.entries(brandDebit).filter(([, v]) => parseFloat(v) > 0).map(([k, v]) => [k, parseFloat(v)]));
                    if (hasAny(brandCredit)) bd.credit = Object.fromEntries(Object.entries(brandCredit).filter(([, v]) => parseFloat(v) > 0).map(([k, v]) => [k, parseFloat(v)]));
                    return Object.keys(bd).length > 0 ? bd : undefined;
                };

                const handleSaveTpv = async () => {
                    if (!previewReady) return;
                    setTpvSaving(true);
                    try {
                        const res = await fetch(`/api/clients/${sel.id}/months`, { method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ month: tpvMonth, tpvDebit: effectiveD, tpvCredit: effectiveC, tpvPix: effectiveP, brandBreakdown: buildBreakdown() })
                        });
                        const data = await res.json();
                        if (data.tpvWarning) {
                            const { confirmed } = await confirmAction({
                                title: "⚠️ TPV Abaixo da Meta Promocional!",
                                message: `O TPV deste mês (${fmtMoney(effectiveTotal)}) está abaixo da meta acordada de ${fmtMoney(sel.targetTpv || 0)}.\n\nAs taxas dele já foram penalizadas na Stone?`,
                                confirmText: "Aplicar Punição e Agendar Visita", variant: "danger"
                            });
                            if (confirmed && data.fallbackRates) {
                                await fetch(`/api/clients/${sel.id}/negotiations`, { method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ dateNeg: new Date().toISOString().split("T")[0], status: "fechado", notes: "Taxas rebaixadas automaticamente por quebra de TPV Mensal.", createTask: true, rates: data.fallbackRates })
                                });
                            }
                        }
                        loadClients(); setTpvTotal(""); setTpvD(""); setTpvC(""); setTpvP("");
                        setBrandDebit(emptyBrands()); setBrandCredit(emptyBrands());
                        setShowTpvForm(false); setShowTpvAdvanced(false);
                    } catch { /* */ } finally { setTpvSaving(false); }
                };

                return (
                <div className="space-y-4">
                    {/* Contact Info */}
                    <div className="card-elevated rounded-xl p-4">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Dados de Contato</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {sel.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{sel.phone}</div>}
                            {sel.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{sel.email}</div>}
                            {sel.cancelDate && <div className="flex items-center gap-2 text-red-500"><Calendar className="w-3.5 h-3.5" />Cancelado: {fmtDate(sel.cancelDate)}</div>}
                        </div>
                        {!sel.phone && !sel.email && (
                            <button onClick={() => { setEditing(true); setEditData({ name: sel.name, phone: sel.phone, email: sel.email, cnpj: sel.cnpj, stoneCode: sel.stoneCode, segment: sel.segment, category: sel.category || "" }); }}
                                className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"><Pencil className="w-3 h-3" /> Adicionar contato</button>
                        )}
                    </div>

                    {/* Current Rates from last negotiation */}
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

                    {/* Performance Card */}
                    {currentComm && (
                        <div className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-purple-500 uppercase flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" /> Performance — {fmtMonth(currentMonth())}</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="text-center"><p className="text-[10px] text-muted-foreground">TPV Total</p><p className="text-lg font-black">{fmtMoney(currentComm.tpvTotal)}</p></div>
                                <div className="text-center"><p className="text-[10px] text-muted-foreground">Receita Taxas</p><p className="text-lg font-black text-amber-500">{fmtMoney(currentComm.totalRevenue)}</p></div>
                                <div className="text-center"><p className="text-[10px] text-muted-foreground">Franquia (30%)</p><p className="text-lg font-black text-blue-500">{fmtMoney(currentComm.franchise)}</p></div>
                                <div className="text-center"><p className="text-[10px] text-muted-foreground">Sua Comissão (10%)</p><p className="text-lg font-black text-purple-500">{fmtMoney(currentComm.agent)}</p></div>
                            </div>
                            {currentVol && (() => {
                                const t = currentVol.tpvDebit + currentVol.tpvCredit + currentVol.tpvPix;
                                if (t <= 0) return null;
                                const pd = currentVol.tpvDebit / t * 100; const pc = currentVol.tpvCredit / t * 100; const pp = currentVol.tpvPix / t * 100;
                                return (
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <span className="text-muted-foreground w-10">Share</span>
                                        <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden flex">
                                            <div className="bg-blue-500 h-full" style={{ width: `${pd}%` }} />
                                            <div className="bg-purple-500 h-full" style={{ width: `${pc}%` }} />
                                            <div className="bg-cyan-500 h-full" style={{ width: `${pp}%` }} />
                                        </div>
                                        <div className="flex gap-3 text-muted-foreground">
                                            <span><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-0.5" /> Déb {pd.toFixed(0)}%</span>
                                            <span><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block mr-0.5" /> Créd {pc.toFixed(0)}%</span>
                                            <span><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block mr-0.5" /> PIX {pp.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* TPV Registration — Collapsible */}
                    {!showTpvForm ? (
                        <button onClick={() => setShowTpvForm(true)}
                            className="w-full py-3.5 border-2 border-dashed border-blue-500/30 rounded-xl text-sm font-semibold text-blue-500 hover:bg-blue-500/5 transition-colors flex items-center justify-center gap-2 touch-target">
                            <Plus className="w-4 h-4" /> Registrar TPV do Mês
                        </button>
                    ) : (
                        <div className="card-elevated rounded-xl p-5 space-y-4 border border-blue-500/20 relative overflow-hidden animate-slide-up">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-blue-500 uppercase flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Registrar TPV</h3>
                                <button onClick={() => { setShowTpvForm(false); setShowTpvAdvanced(false); }} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                            </div>

                            {/* Month Selector */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-2">Mês de Referência</label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {[0, 1, 2, 3].map(mOff => {
                                        const d = new Date(); d.setMonth(d.getMonth() - mOff);
                                        const mVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                        const lbl = mOff === 0 ? "Mês Atual" : mOff === 1 ? "Mês Passado" : fmtMonth(mVal);
                                        return (<button key={mVal} type="button" onClick={() => setTpvMonth(mVal)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm touch-target ${tpvMonth === mVal ? "bg-blue-600 text-white" : "bg-card border border-border text-muted-foreground hover:bg-muted"}`}>{lbl}</button>);
                                    })}
                                    <div className="relative">
                                        <input type="month" value={tpvMonth} onChange={e => setTpvMonth(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                                        <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold bg-card border border-border text-muted-foreground hover:bg-muted flex items-center gap-1 touch-target"><Calendar className="w-3.5 h-3.5" /> Outro...</button>
                                    </div>
                                </div>
                            </div>

                            {/* TPV Total */}
                            <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-500/20 rounded-xl p-4">
                                <label className="text-xs font-bold text-blue-500 uppercase block mb-2">TPV Total (R$)</label>
                                <input type="number" value={hasManual ? "" : tpvTotal} onChange={e => setTpvTotal(e.target.value)} disabled={hasManual} placeholder="Ex: 100000.00"
                                    className="w-full px-4 py-3 rounded-xl bg-card border border-border text-lg font-bold text-foreground focus:outline-none focus:border-blue-500/50 disabled:opacity-40" />
                                {hasManual && <p className="text-xs text-blue-500 font-medium mt-1.5">Total calculado: {autoTotal}</p>}
                            </div>

                            {/* Manual Deb/Cred/PIX split with % bars */}
                            <div className="space-y-3">
                                <label className="text-xs font-medium text-muted-foreground">Detalhamento por Modalidade <span className="text-muted-foreground/50">(opcional)</span></label>
                                {([
                                    { label: "Débito", value: tpvD, setter: setTpvD, pct: pctD, color: "bg-blue-500", rate: rateD },
                                    { label: "Crédito", value: tpvC, setter: setTpvC, pct: pctC, color: "bg-purple-500", rate: rateC },
                                    { label: "PIX", value: tpvP, setter: setTpvP, pct: pctP, color: "bg-cyan-500", rate: rateP },
                                ] as const).map(m => (
                                    <div key={m.label} className="flex items-center gap-3">
                                        <label className="text-xs font-medium text-muted-foreground w-14 shrink-0">{m.label}</label>
                                        <input type="number" value={m.value} onChange={e => m.setter(e.target.value)} placeholder="R$ 0,00"
                                            className="w-28 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" />
                                        <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden relative">
                                            <div className={`${m.color} h-full rounded-full transition-all duration-300`} style={{ width: `${Math.min(m.pct, 100)}%` }} />
                                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground/70">{m.pct.toFixed(0)}%</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">{formatPercent(m.rate)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Auto-pulled Rates Indicator */}
                            {lastNeg ? (
                                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-[#00A868]" /> Taxas vigentes aplicadas automaticamente da última renegociação
                                </p>
                            ) : (
                                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                                    ⚠️ Sem renegociação cadastrada — as taxas ficarão zeradas. Cadastre uma renegociação primeiro.
                                </p>
                            )}

                            {/* Advanced — Per-Brand Breakdown */}
                            <button type="button" onClick={() => setShowTpvAdvanced(!showTpvAdvanced)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${showTpvAdvanced ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-500" : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                                <span className="flex items-center gap-1.5">⚙️ Avançado — Detalhamento por Bandeira</span>
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showTpvAdvanced ? "rotate-90" : ""}`} />
                            </button>
                            {showTpvAdvanced && (
                                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 space-y-4">
                                    {([
                                        { label: "Débito", state: brandDebit, setter: setBrandDebit, total: effectiveD },
                                        { label: "Crédito", state: brandCredit, setter: setBrandCredit, total: effectiveC },
                                    ]).map(mod => {
                                        const brandSum = Object.values(mod.state).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                        const remaining = mod.total - brandSum;
                                        return (
                                            <div key={mod.label}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-indigo-400">{mod.label} — {fmtMoney(mod.total)}</span>
                                                    {brandSum > 0 && <span className={`text-[10px] font-medium ${Math.abs(remaining) < 1 ? "text-[#00A868]" : "text-amber-500"}`}>{Math.abs(remaining) < 1 ? "✓ Bateu" : `Falta: ${fmtMoney(remaining)}`}</span>}
                                                </div>
                                                <div className="grid grid-cols-5 gap-1.5">
                                                    {BRANDS.map(brand => (
                                                        <div key={brand}>
                                                            <label className="text-[9px] text-muted-foreground block mb-0.5 text-center">{brand}</label>
                                                            <input type="number" value={mod.state[brand]} onChange={e => mod.setter({ ...mod.state, [brand]: e.target.value })}
                                                                placeholder="0" className="w-full px-1 py-1.5 rounded-lg bg-card border border-border text-[10px] text-center focus:outline-none focus:border-indigo-500/50" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Preview */}
                            {preview && (
                                <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-4 space-y-2">
                                    <h4 className="text-xs font-bold text-purple-500 uppercase">Resumo do Cálculo</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                        <div><p className="text-[10px] text-muted-foreground">TPV Total</p><p className="text-sm font-bold">{fmtMoney(preview.tpvTotal)}</p></div>
                                        <div><p className="text-[10px] text-muted-foreground">Receita Taxas</p><p className="text-sm font-bold text-amber-500">{fmtMoney(preview.totalRevenue)}</p></div>
                                        <div><p className="text-[10px] text-muted-foreground">Franquia (30%)</p><p className="text-sm font-bold text-blue-500">{fmtMoney(preview.franchise)}</p></div>
                                        <div><p className="text-[10px] text-muted-foreground">Sua Comissão (10%)</p><p className="text-lg font-black text-purple-500">{fmtMoney(preview.agent)}</p></div>
                                    </div>
                                </div>
                            )}

                            {/* Save */}
                            <button onClick={handleSaveTpv} disabled={tpvSaving || !previewReady}
                                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                                {tpvSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Salvar TPV de {fmtMonth(tpvMonth)}
                            </button>
                        </div>
                    )}

                    {/* TPV History Table */}
                    <div className="card-elevated rounded-xl p-4">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Histórico TPV & Comissões</h3>
                        {volumes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhum TPV registrado.</p>
                        ) : (
                            <div className="overflow-x-auto -mx-4 px-4">
                                <table className="w-full text-xs">
                                    <thead><tr className="border-b border-border">
                                        <th className="text-left py-2 text-muted-foreground font-semibold">Mês</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">TPV Déb</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">TPV Créd</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">TPV PIX</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold">TPV Total</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">Receita</th>
                                        <th className="text-right py-2 text-purple-500 font-semibold">Comissão</th>
                                    </tr></thead>
                                    <tbody>
                                        {volumes.map(v => { const c = calcCommission(v); return (
                                            <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30">
                                                <td className="py-2 font-semibold">{fmtMonth(v.month)}</td>
                                                <td className="py-2 text-right hidden sm:table-cell">{fmtMoney(v.tpvDebit)}</td>
                                                <td className="py-2 text-right hidden sm:table-cell">{fmtMoney(v.tpvCredit)}</td>
                                                <td className="py-2 text-right hidden sm:table-cell">{fmtMoney(v.tpvPix)}</td>
                                                <td className="py-2 text-right font-bold">{fmtMoney(c.tpvTotal)}</td>
                                                <td className="py-2 text-right text-amber-500 hidden sm:table-cell">{fmtMoney(c.totalRevenue)}</td>
                                                <td className="py-2 text-right font-bold text-purple-500">{fmtMoney(c.agent)}</td>
                                            </tr>
                                        ); })}
                                        <tr className="border-t-2 border-border font-bold">
                                            <td className="py-2">Total</td>
                                            <td className="py-2 text-right hidden sm:table-cell" colSpan={3}></td>
                                            <td className="py-2 text-right">{fmtMoney(totalComm.tpvTotal)}</td>
                                            <td className="py-2 text-right text-amber-500 hidden sm:table-cell">{fmtMoney(totalComm.totalRevenue)}</td>
                                            <td className="py-2 text-right text-purple-500">{fmtMoney(totalComm.agent)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                );
            })()}

            {/* TAB: Negociações */}
            {tab === "negs" && (
                <div className="space-y-3">
                    {showNewNeg ? (
                        <div className="card-elevated rounded-xl p-5 space-y-3 border border-[#00A868]/20">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-[#00A868] uppercase flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Renegociação</h3>
                                <button onClick={() => setShowNewNeg(false)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data</label>
                                    <input type="date" value={negDate} onChange={e => setNegDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none [color-scheme:dark]" /></div>
                                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                                    <select value={negStatus} onChange={e => setNegStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none">
                                        <option value="analise">Em Análise / Solicitado</option><option value="proposta_retencao">Proposta de Retenção</option>
                                        <option value="aplicada">Aprovada / Aplicada</option><option value="recusada">Recusada</option>
                                    </select></div>
                            </div>
                            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-2">
                                <button type="button" onClick={() => { setNegCetMode(false); setNegRates(r => ({ ...r, rav: "" })); }}
                                    className={`flex-1 py-2 text-xs rounded-lg font-bold transition-all ${!negCetMode ? "bg-[#00A868] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Taxas MDR</button>
                                <button type="button" onClick={() => setNegCetMode(true)}
                                    className={`flex-1 py-2 text-xs rounded-lg font-bold transition-all ${negCetMode ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Taxas com CET</button>
                            </div>
                            <p className="text-[9px] text-muted-foreground/70 -mt-1">
                                {negCetMode ? "📌 Informe as taxas finais (MDR + antecipação). O RAV já está embutido." : "📌 Informe o MDR puro. O RAV será registrado separadamente."}
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
                                            className="w-full px-2 py-2 rounded-lg bg-muted/50 border border-border text-xs text-center focus:outline-none focus:border-[#00A868]/50" /></div>
                                ))}
                            </div>
                            <div><label className="text-xs font-medium text-muted-foreground block mb-1">Observações</label>
                                <textarea value={negNotes} onChange={e => setNegNotes(e.target.value)} rows={2} placeholder="Notas sobre a renegociação..."
                                    className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none resize-none" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">🔔 Alerta de Renegociação</label>
                                    <input type="date" value={negAlertDate} onChange={e => setNegAlertDate(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none [color-scheme:dark]" />
                                    <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1 scrollbar-none">
                                        {[30, 60, 90, 180].map(d => (
                                            <button key={d} type="button" onClick={() => { const date = new Date(); date.setDate(date.getDate() + d); setNegAlertDate(date.toISOString().split("T")[0]); }}
                                                className="px-2 py-1 rounded-md bg-secondary border border-border text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted whitespace-nowrap shrink-0 touch-target">+{d} dias</button>
                                        ))}
                                        {negAlertDate && (
                                            <button type="button" onClick={() => setNegAlertDate("")} className="px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-[9px] font-medium hover:bg-red-500/20 whitespace-nowrap shrink-0">✕</button>
                                        )}
                                    </div>
                                </div>
                                {negAlertDate && (
                                    <div className="flex items-end pb-1">
                                        <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Renegociar — ${sel.name}`)}&dates=${negAlertDate.replace(/-/g, '')}T090000Z/${negAlertDate.replace(/-/g, '')}T100000Z&details=${encodeURIComponent(`Cliente: ${sel.name}\nCNPJ: ${sel.cnpj}\n\n— BitTask`)}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-500/10 text-blue-500 text-xs font-bold hover:bg-blue-500/20 transition-colors touch-target">
                                            <Calendar className="w-3.5 h-3.5" /> Google Calendar
                                        </a>
                                    </div>
                                )}
                            </div>
                            <div className={`rounded-xl p-3 transition-all ${negCreateTask ? "bg-blue-500/5 border border-blue-500/20" : "bg-secondary/30 border border-border/30"}`}>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <div className={`relative w-10 h-5 rounded-full transition-colors ${negCreateTask ? 'bg-blue-500' : 'bg-secondary border border-border'}`}
                                        onClick={() => setNegCreateTask(!negCreateTask)}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${negCreateTask ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
                                            className="w-full px-2.5 py-2 rounded-lg bg-secondary border border-border text-xs focus:outline-none">
                                            <option value="">Eu mesmo</option>
                                            {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleAddNeg} disabled={negSaving}
                                className="w-full py-3 bg-[#00A868] text-white rounded-xl text-sm font-bold hover:bg-[#008f58] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                                {negSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Renegociação
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setShowNewNeg(true)}
                            className="w-full py-3.5 border-2 border-dashed border-[#00A868]/30 rounded-xl text-sm font-semibold text-[#00A868] hover:bg-[#00A868]/5 transition-colors flex items-center justify-center gap-2 touch-target">
                            <Plus className="w-4 h-4" /> Nova Renegociação
                        </button>
                    )}

                    {sel.negotiations.length === 0 && !showNewNeg ? (
                        <div className="card-elevated rounded-xl p-8 text-center text-muted-foreground">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Nenhuma negociação registrada.</p>
                        </div>
                    ) : sel.negotiations.map((neg, i) => {
                        const stLabel: Record<string, string> = { prospeccao: "Prospecção", proposta_enviada: "Proposta Enviada", aguardando_cliente: "Aguardando Cliente", aprovado: "Aprovado", recusado: "Recusado", fechado: "Fechado", pendente: "Pendente", aceita: "Aprovado", recusada: "Recusada", analise: "Em Análise", proposta_retencao: "Proposta de Retenção", aplicada: "Aplicada" };
                        const stColor: Record<string, string> = { prospeccao: "bg-slate-500/10 text-slate-500", proposta_enviada: "bg-[#00A868]/10 text-[#00A868]", aguardando_cliente: "bg-amber-500/10 text-amber-500", aprovado: "bg-[#00A868]/10 text-[#00A868]", recusado: "bg-red-500/10 text-red-500", fechado: "bg-purple-500/10 text-purple-500", pendente: "bg-amber-500/10 text-amber-500", aceita: "bg-[#00A868]/10 text-[#00A868]", recusada: "bg-red-500/10 text-red-500", analise: "bg-blue-500/10 text-blue-500", proposta_retencao: "bg-indigo-500/10 text-indigo-500", aplicada: "bg-[#00A868]/10 text-[#00A868]" };
                        return (
                            <div key={neg.id} className={`bg-card border rounded-xl p-4 ${i === 0 ? "border-[#00A868]/20" : "border-border"}`}>
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                    <div className="flex items-center gap-2 flex-wrap">
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
