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

interface NegRatesForm { debit: string; credit1x: string; credit2x: string; credit3x: string; credit4x: string; credit5x: string; credit6x: string; credit7to12: string; pix: string; rav: string }

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
    const [tab, setTab] = useState<"dash" | "tpv" | "negs">("dash");

    // TPV form (simplified — rates auto-pulled from last negotiation)
    const [showTpvForm, setShowTpvForm] = useState(false);
    const [tpvMonth, setTpvMonth] = useState(currentMonth());
    const [tpvTotal, setTpvTotal] = useState("");
    const [tpvD, setTpvD] = useState(""); const [tpvC, setTpvC] = useState(""); const [tpvC2, setTpvC2] = useState(""); const [tpvC7, setTpvC7] = useState(""); const [tpvP, setTpvP] = useState("");
    const [tpvSaving, setTpvSaving] = useState(false);
    const [showTpvAdvanced, setShowTpvAdvanced] = useState(false);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(() => parseInt(currentMonth().split("-")[0]));
    const [selectedNegId, setSelectedNegId] = useState("");
    const BRANDS = ["Mastercard", "Visa", "Elo", "Hiper", "Amex"] as const;
    const emptyBrands = () => Object.fromEntries(BRANDS.map(b => [b, ""]));
    const [brandDebit, setBrandDebit] = useState<Record<string, string>>(emptyBrands());
    const [brandCredit, setBrandCredit] = useState<Record<string, string>>(emptyBrands());

    // Neg form
    const [showNewNeg, setShowNewNeg] = useState(false);
    const [negDate, setNegDate] = useState(new Date().toISOString().split("T")[0]);
    const [negStatus, setNegStatus] = useState("analise");
    const [negRates, setNegRates] = useState<NegRatesForm>({ debit: "", credit1x: "", credit2x: "", credit3x: "", credit4x: "", credit5x: "", credit6x: "", credit7to12: "", pix: "", rav: "" });
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
                        credit2x: parseFloat(negRates.credit2x) || 0, credit3x: parseFloat(negRates.credit3x) || 0,
                        credit4x: parseFloat(negRates.credit4x) || 0, credit5x: parseFloat(negRates.credit5x) || 0,
                        credit6x: parseFloat(negRates.credit6x) || 0,
                        // backwards compat: credit2to6 = max of individual installments (for legacy views)
                        credit2to6: Math.max(...[negRates.credit2x, negRates.credit3x, negRates.credit4x, negRates.credit5x, negRates.credit6x].map(v => parseFloat(v) || 0)),
                        credit7to12: parseFloat(negRates.credit7to12) || 0,
                        pix: parseFloat(negRates.pix) || 0, rav: parseFloat(negRates.rav) || 0,
                    },
                }),
            });
            loadClients();
            setShowNewNeg(false);
            setNegRates({ debit: "", credit1x: "", credit2x: "", credit3x: "", credit4x: "", credit5x: "", credit6x: "", credit7to12: "", pix: "", rav: "" });
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

            <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 overflow-x-auto">
                {([["dash", "📊 Dashboard"], ["tpv", "💰 TPV"], ["negs", "🔄 Negociações"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                ))}
            </div>

            {/* TAB: Dashboard */}
            {tab === "dash" && (
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

                    {/* Current Rates */}
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

                    {/* Insights */}
                    {volumes.length > 0 && (() => {
                        const avgMonthly = totalComm.tpvTotal / volumes.length;
                        const trend = volumes.length >= 2 ? (() => {
                            const latest = volumes[0]; const prev = volumes[1];
                            const latestT = latest.tpvDebit + latest.tpvCredit + latest.tpvPix;
                            const prevT = prev.tpvDebit + prev.tpvCredit + prev.tpvPix;
                            return prevT > 0 ? ((latestT - prevT) / prevT * 100) : 0;
                        })() : 0;
                        return (
                            <div className="card-elevated rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Insights</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-secondary/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">TPV Médio Mensal</p><p className="text-sm font-bold">{fmtMoney(avgMonthly)}</p></div>
                                    <div className="bg-secondary/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Tendência</p><p className={`text-sm font-bold ${trend >= 0 ? "text-[#00A868]" : "text-red-500"}`}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%</p></div>
                                    <div className="bg-secondary/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Meses Registrados</p><p className="text-sm font-bold">{volumes.length}</p></div>
                                    <div className="bg-secondary/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Comissão Acumulada</p><p className="text-sm font-bold text-purple-500">{fmtMoney(totalComm.agent)}</p></div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* TAB: TPV */}
            {tab === "tpv" && (() => {
                const totalVal = parseFloat(tpvTotal) || 0;
                const manualD = parseFloat(tpvD) || 0; const manualC = parseFloat(tpvC) || 0;
                const manualC2 = parseFloat(tpvC2) || 0; const manualC7 = parseFloat(tpvC7) || 0;
                const manualP = parseFloat(tpvP) || 0;
                const hasManual = manualD > 0 || manualC > 0 || manualC2 > 0 || manualC7 > 0 || manualP > 0;
                const effectiveD = hasManual ? manualD : totalVal * 0.30;
                const effectiveC = hasManual ? manualC : totalVal * 0.40;
                const effectiveC2 = hasManual ? manualC2 : 0;
                const effectiveC7 = hasManual ? manualC7 : 0;
                const effectiveP = hasManual ? manualP : totalVal * 0.20;
                const effectiveTotal = hasManual ? (manualD + manualC + manualC2 + manualC7 + manualP) : totalVal;
                const pctD = effectiveTotal > 0 ? (effectiveD / effectiveTotal * 100) : 0;
                const pctC = effectiveTotal > 0 ? (effectiveC / effectiveTotal * 100) : 0;
                const pctC2 = effectiveTotal > 0 ? (effectiveC2 / effectiveTotal * 100) : 0;
                const pctC7 = effectiveTotal > 0 ? (effectiveC7 / effectiveTotal * 100) : 0;
                const pctP = effectiveTotal > 0 ? (effectiveP / effectiveTotal * 100) : 0;
                const autoTotal = hasManual ? fmtMoney(manualD + manualC + manualC2 + manualC7 + manualP) : "";
                // Rate selection — use selected negotiation or default to latest
                const activeNeg = selectedNegId ? sel.negotiations.find(n => n.id === selectedNegId) : lastNeg;
                const rateD = activeNeg?.rates?.debit || 0;
                const rateC = activeNeg?.rates?.credit1x || 0;
                const rateC2 = activeNeg?.rates?.credit2to6 || activeNeg?.rates?.credit1x || 0;
                const rateC7 = activeNeg?.rates?.credit7to12 || 0;
                const rateP = activeNeg?.rates?.pix || 0;
                const rateRav = activeNeg?.rates?.rav || activeNeg?.rates?.ravRate || 0;
                const hasRates = rateD > 0 || rateC > 0 || rateP > 0;
                const previewReady = effectiveTotal > 0;
                const previewVol = { tpvDebit: effectiveD, tpvCredit: effectiveC, tpvCredit2to6: effectiveC2, tpvCredit7to12: effectiveC7, tpvPix: effectiveP, rateDebit: rateD, rateCredit: rateC, rateCredit2to6: rateC2, rateCredit7to12: rateC7, ratePix: rateP, rateRav } as MonthVolume;
                const preview = previewReady ? calcCommission(previewVol) : null;

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
                            body: JSON.stringify({ month: tpvMonth, tpvDebit: effectiveD, tpvCredit: effectiveC, tpvCredit2to6: effectiveC2, tpvCredit7to12: effectiveC7, tpvPix: effectiveP, rateDebit: rateD, rateCredit: rateC, rateCredit2to6: rateC2, rateCredit7to12: rateC7, ratePix: rateP, rateRav, brandBreakdown: buildBreakdown() })
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
                        loadClients(); setTpvTotal(""); setTpvD(""); setTpvC(""); setTpvC2(""); setTpvC7(""); setTpvP("");
                        setBrandDebit(emptyBrands()); setBrandCredit(emptyBrands());
                        setShowTpvAdvanced(false);
                    } catch { /* */ } finally { setTpvSaving(false); }
                };

                return (
                <div className="space-y-4">
                    <div className="card-elevated rounded-xl p-5 space-y-4 border border-blue-500/20 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                        <h3 className="text-sm font-bold text-blue-500 uppercase flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Registrar TPV</h3>

                        {/* Month Selector — Premium Custom Picker */}
                        <div className="relative">
                            <label className="text-xs font-medium text-muted-foreground block mb-2">Mês de Referência</label>
                            <button type="button" onClick={() => { setShowMonthPicker(!showMonthPicker); setPickerYear(parseInt(tpvMonth.split("-")[0])); }}
                                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm font-semibold text-foreground hover:border-blue-500/50 transition-colors cursor-pointer flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    {(() => { const [y, m] = tpvMonth.split("-"); const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]; return `${names[parseInt(m)-1]} ${y}`; })()}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showMonthPicker ? "rotate-90" : ""}`} />
                            </button>
                            {showMonthPicker && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
                                    {/* Year nav */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-border">
                                        <button type="button" onClick={() => setPickerYear(p => p - 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-sm font-bold">{pickerYear}</span>
                                        <button type="button" onClick={() => setPickerYear(p => p + 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
                                    </div>
                                    {/* Month grid */}
                                    <div className="grid grid-cols-3 gap-1.5 p-3">
                                        {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((name, i) => {
                                            const mVal = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                                            const isSelected = tpvMonth === mVal;
                                            const isCurrent = currentMonth() === mVal;
                                            const isFuture = new Date(`${mVal}-01`) > new Date();
                                            return (
                                                <button key={mVal} type="button" disabled={isFuture}
                                                    onClick={() => { setTpvMonth(mVal); setShowMonthPicker(false); }}
                                                    className={`py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                                                        isSelected ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" :
                                                        isCurrent ? "bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30" :
                                                        isFuture ? "text-muted-foreground/30 cursor-not-allowed" :
                                                        "text-foreground hover:bg-secondary"
                                                    }`}>
                                                    {name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                            {/* Débito */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-muted-foreground w-16 shrink-0">Débito</label>
                                <input type="number" value={tpvD} onChange={e => setTpvD(e.target.value)} placeholder="R$ 0,00"
                                    className="w-28 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-blue-500/50" />
                                <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden relative">
                                    <div className={`bg-blue-500 h-full rounded-full transition-all duration-300`} style={{ width: `${Math.min(pctD, 100)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground/70">{pctD.toFixed(0)}%</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">{formatPercent(rateD)}</span>
                            </div>

                            {/* Crédito Group (Side by side) */}
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { label: "Créd 1x", value: tpvC, setter: setTpvC, rate: rateC },
                                    { label: "Créd 2-6x", value: tpvC2, setter: setTpvC2, rate: rateC2 },
                                    { label: "Créd 7-12x", value: tpvC7, setter: setTpvC7, rate: rateC7 },
                                ] as const).map(m => (
                                    <div key={m.label} className="bg-secondary/20 p-2 rounded-lg border border-border/30">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-medium text-muted-foreground">{m.label}</label>
                                            <span className="text-[9px] text-muted-foreground">{formatPercent(m.rate)}</span>
                                        </div>
                                        <input type="number" value={m.value} onChange={e => m.setter(e.target.value)} placeholder="R$ 0,00"
                                            className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-xs focus:outline-none focus:border-purple-500/50" />
                                    </div>
                                ))}
                            </div>
                            
                            {/* Crédito Total Bar */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-muted-foreground w-16 shrink-0">Tot. Crédito</label>
                                <div className="w-28 text-xs font-semibold text-right pr-2 text-muted-foreground">{fmtMoney(effectiveC + effectiveC2 + effectiveC7)}</div>
                                <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden relative">
                                    <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(pctC + pctC2 + pctC7, 100)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground/70">{(pctC + pctC2 + pctC7).toFixed(0)}%</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0"></span>
                            </div>

                            {/* PIX */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-muted-foreground w-16 shrink-0">PIX</label>
                                <input type="number" value={tpvP} onChange={e => setTpvP(e.target.value)} placeholder="R$ 0,00"
                                    className="w-28 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-cyan-500/50" />
                                <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden relative">
                                    <div className={`bg-cyan-500 h-full rounded-full transition-all duration-300`} style={{ width: `${Math.min(pctP, 100)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground/70">{pctP.toFixed(0)}%</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">{formatPercent(rateP)}</span>
                            </div>
                            {rateRav > 0 && (effectiveC2 > 0 || effectiveC7 > 0) && (
                                <p className="text-[10px] text-amber-500/80 flex items-center gap-1">
                                    ⚡ RAV: {formatPercent(rateRav)} será aplicado sobre parcelado ({fmtMoney((effectiveC2 + effectiveC7) * rateRav / 100)} de antecipação)
                                </p>
                            )}
                        </div>

                        {/* Negotiation Rate Selector */}
                        {sel.negotiations.length > 0 ? (
                            <div className="bg-[#00A868]/5 border border-[#00A868]/10 rounded-xl p-3 space-y-2">
                                <label className="text-[10px] text-[#00A868] font-bold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Taxas para cálculo de comissão:
                                </label>
                                <select value={selectedNegId} onChange={e => setSelectedNegId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold focus:outline-none focus:border-[#00A868]/50 cursor-pointer">
                                    <option value="">✅ Mais recente — {lastNeg ? `${fmtDate(lastNeg.dateNeg)} (${lastNeg.status === "aplicada" ? "Aplicada" : lastNeg.status})` : ""}</option>
                                    {sel.negotiations.map((n, i) => (
                                        <option key={n.id} value={n.id}>
                                            {fmtDate(n.dateNeg)} — {n.status === "aplicada" ? "Aplicada" : n.status === "analise" ? "Análise" : n.status === "proposta_retencao" ? "Proposta" : n.status} | Déb {formatPercent(n.rates?.debit || 0)} / Créd {formatPercent(n.rates?.credit1x || 0)} / PIX {formatPercent(n.rates?.pix || 0)}
                                            {i === 0 ? " ★" : ""}
                                        </option>
                                    ))}
                                </select>
                                {hasRates ? (
                                    <div className="flex items-center gap-3 text-[10px]">
                                        <span className="text-foreground font-semibold">Déb: <span className="text-blue-500">{formatPercent(rateD)}</span></span>
                                        <span className="text-foreground font-semibold">Créd: <span className="text-purple-500">{formatPercent(rateC)}</span></span>
                                        <span className="text-foreground font-semibold">PIX: <span className="text-cyan-500">{formatPercent(rateP)}</span></span>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-amber-500">⚠️ Taxas zeradas nesta negociação — comissão ficará R$0</p>
                                )}
                                <p className="text-[9px] text-muted-foreground/60">Receita = TPV × Taxa → 30% Franquia → 10% Agente</p>
                            </div>
                        ) : (
                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                                <p className="text-[10px] text-red-500 flex items-center gap-1">❌ Sem renegociação cadastrada — taxas zeradas. Cadastre uma renegociação primeiro.</p>
                            </div>
                        )}

                        {/* Advanced Per-Brand */}
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

                        {/* Espelho de Comissão */}
                        {preview && (() => {
                            const hasBrandBreakdown = Object.values(brandDebit).some(v => parseFloat(v) > 0) || Object.values(brandCredit).some(v => parseFloat(v) > 0);
                            return (
                            <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
                                <h4 className="text-xs font-bold text-purple-500 uppercase">Espelho de Comissão — {fmtMonth(tpvMonth)}</h4>
                                {/* Detail table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px]">
                                        <thead>
                                            <tr className="text-muted-foreground border-b border-border/30">
                                                <th className="text-left py-1 font-medium">Modalidade</th>
                                                <th className="text-right py-1 font-medium">Volume</th>
                                                <th className="text-right py-1 font-medium">Taxa %</th>
                                                <th className="text-right py-1 font-medium">Receita</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.lines.map((line, i) => (
                                                <tr key={i} className={`border-b border-border/10 ${line.isRav ? "text-amber-500/80" : ""}`}>
                                                    <td className={`py-1.5 ${line.isRav ? "pl-3 italic" : "font-semibold"}`}>{line.label}</td>
                                                    <td className="text-right py-1.5">{line.isRav ? "" : fmtMoney(line.volume)}</td>
                                                    <td className="text-right py-1.5">{formatPercent(line.rate)}</td>
                                                    <td className="text-right py-1.5 font-semibold">{fmtMoney(line.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-border/50 font-bold">
                                                <td className="py-2">TOTAL BRUTO</td>
                                                <td className="text-right py-2">{fmtMoney(preview.tpvTotal)}</td>
                                                <td className="text-right py-2"></td>
                                                <td className="text-right py-2 text-amber-500">{fmtMoney(preview.totalRevenue)}</td>
                                            </tr>
                                            <tr className="text-blue-500 font-bold">
                                                <td className="py-1" colSpan={3}>Franquia (30%)</td>
                                                <td className="text-right py-1">{fmtMoney(preview.franchise)}</td>
                                            </tr>
                                            <tr className="text-purple-500 font-black text-sm">
                                                <td className="py-1" colSpan={3}>Sua Comissão (10%)</td>
                                                <td className="text-right py-1 text-lg">{fmtMoney(preview.agent)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                {!hasBrandBreakdown && (
                                    <p className="text-[10px] text-amber-500/80 flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                                        <span className="shrink-0">⚠️</span>
                                        <span>Sem detalhamento por bandeira — usando taxas <b>Visa/Master</b> como base do cálculo.</span>
                                    </p>
                                )}
                            </div>
                            );
                        })()}

                        {/* Save */}
                        <button onClick={handleSaveTpv} disabled={tpvSaving || !previewReady}
                            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                            {tpvSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Salvar TPV de {fmtMonth(tpvMonth)}
                        </button>
                    </div>

                    {/* TPV History */}
                    <div className="card-elevated rounded-xl p-4">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">Histórico TPV & Comissões</h3>
                        {volumes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhum TPV registrado.</p>
                        ) : (
                            <div className="overflow-x-auto -mx-4 px-4">
                                <table className="w-full text-xs">
                                    <thead><tr className="border-b border-border">
                                        <th className="text-left py-2 text-muted-foreground font-semibold">Mês</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">Déb</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">Créd</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold hidden sm:table-cell">PIX</th>
                                        <th className="text-right py-2 text-muted-foreground font-semibold">Total</th>
                                        <th className="text-right py-2 text-purple-500 font-semibold">Comissão</th>
                                        <th className="text-center py-2 text-muted-foreground font-semibold w-16">Ações</th>
                                    </tr></thead>
                                    <tbody>
                                        {volumes.map(v => { const c = calcCommission(v); return (
                                            <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 group">
                                                <td className="py-2 font-semibold">{fmtMonth(v.month)}</td>
                                                <td className="py-2 text-right hidden sm:table-cell">{fmtMoney(v.tpvDebit)}</td>
                                                <td className="py-2 text-right hidden sm:table-cell">{fmtMoney(v.tpvCredit)}</td>
                                                <td className="py-2 text-right hidden sm:table-cell">{fmtMoney(v.tpvPix)}</td>
                                                <td className="py-2 text-right font-bold">{fmtMoney(c.tpvTotal)}</td>
                                                <td className="py-2 text-right font-bold text-purple-500">{fmtMoney(c.agent)}</td>
                                                <td className="py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button type="button" title="Editar TPV"
                                                            onClick={() => {
                                                                setTpvMonth(v.month);
                                                                setTpvD(String(v.tpvDebit || ""));
                                                                setTpvC(String(v.tpvCredit || ""));
                                                                setTpvP(String(v.tpvPix || ""));
                                                                setTpvTotal("");
                                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                                            }}
                                                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button type="button" title="Excluir TPV"
                                                            onClick={async () => {
                                                                if (!window.confirm(`Excluir TPV de ${fmtMonth(v.month)}?\n\nDéb: ${fmtMoney(v.tpvDebit)}\nCréd: ${fmtMoney(v.tpvCredit)}\nPIX: ${fmtMoney(v.tpvPix)}\n\nEsta ação não pode ser desfeita.`)) return;
                                                                try {
                                                                    await fetch(`/api/clients/${sel.id}/months/${v.id}`, { method: "DELETE" });
                                                                    loadClients();
                                                                } catch { /* */ }
                                                            }}
                                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ); })}
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
                            {/* Rate Fields */}
                            <div className="space-y-3">
                                {/* Row 1: Débito + PIX + RAV */}
                                <div className={`grid gap-2 ${negCetMode ? "grid-cols-2" : "grid-cols-3"}`}>
                                    {([["Débito", negRates.debit, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, debit: v }))],
                                      ["PIX", negRates.pix, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, pix: v }))],
                                      ...(!negCetMode ? [["RAV", negRates.rav, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, rav: v }))]] : []),
                                    ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                                        <div key={label as string}><label className="text-[10px] font-medium text-muted-foreground block mb-0.5">{label as string} (%)</label>
                                            <input type="number" step="0.01" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} placeholder="0.00"
                                                className="w-full px-2 py-2 rounded-lg bg-muted/50 border border-border text-xs text-center focus:outline-none focus:border-[#00A868]/50" /></div>
                                    ))}
                                </div>
                                {/* Row 2: Crédito — cada parcela individual */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Crédito por Parcela {negCetMode ? "(CET)" : "(MDR)"}</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                        {([
                                            ["1x", negRates.credit1x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit1x: v }))],
                                            ["2x", negRates.credit2x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit2x: v }))],
                                            ["3x", negRates.credit3x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit3x: v }))],
                                            ["4x", negRates.credit4x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit4x: v }))],
                                            ["5x", negRates.credit5x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit5x: v }))],
                                            ["6x", negRates.credit6x, (v: string) => setNegRates((r: NegRatesForm) => ({ ...r, credit6x: v }))],
                                        ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                                            <div key={label as string}><label className="text-[10px] font-medium text-muted-foreground block mb-0.5 text-center">{label as string}</label>
                                                <input type="number" step="0.01" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} placeholder="0.00"
                                                    className="w-full px-1.5 py-2 rounded-lg bg-muted/50 border border-border text-xs text-center focus:outline-none focus:border-[#00A868]/50" /></div>
                                        ))}
                                    </div>
                                </div>
                                {/* Row 3: 7-12x (mantém agrupado) */}
                                <div className="grid grid-cols-1">
                                    <div><label className="text-[10px] font-medium text-muted-foreground block mb-0.5">7-12x {negCetMode ? "(CET)" : ""} (%)</label>
                                        <input type="number" step="0.01" value={negRates.credit7to12} onChange={e => setNegRates((r: NegRatesForm) => ({ ...r, credit7to12: e.target.value }))} placeholder="0.00"
                                            className="w-full px-2 py-2 rounded-lg bg-muted/50 border border-border text-xs text-center focus:outline-none focus:border-[#00A868]/50" /></div>
                                </div>
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
                            {(() => {
                                const skipTask = ["aplicada", "recusada", "aprovado", "fechado"].includes(negStatus);
                                return (
                            <div className={`rounded-xl p-3 transition-all ${skipTask ? "bg-secondary/20 border border-border/20 opacity-60" : negCreateTask ? "bg-blue-500/5 border border-blue-500/20" : "bg-secondary/30 border border-border/30"}`}>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <div className={`relative w-10 h-5 rounded-full transition-colors ${skipTask ? 'bg-secondary border border-border cursor-not-allowed' : negCreateTask ? 'bg-blue-500' : 'bg-secondary border border-border'}`}
                                        onClick={() => !skipTask && setNegCreateTask(!negCreateTask)}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${!skipTask && negCreateTask ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-foreground">📋 Criar Tarefa de Acompanhamento</span>
                                        <p className="text-[9px] text-muted-foreground/60">
                                            {skipTask ? "Status final — não gera tarefa automática" : "Gera tarefa automática para validar/acompanhar"}
                                        </p>
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
                            );
                            })()}
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
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{fmtDate(neg.dateNeg)}</span>
                                        <button type="button" title="Editar taxas"
                                            onClick={() => {
                                                setShowNewNeg(true);
                                                setNegDate(neg.dateNeg);
                                                setNegStatus(neg.status);
                                                setNegNotes(neg.notes || "");
                                                setNegRates({
                                                    debit: String(neg.rates?.debit || ""),
                                                    credit1x: String(neg.rates?.credit1x || ""),
                                                    credit2x: String(neg.rates?.credit2x || ""),
                                                    credit3x: String(neg.rates?.credit3x || ""),
                                                    credit4x: String(neg.rates?.credit4x || ""),
                                                    credit5x: String(neg.rates?.credit5x || ""),
                                                    credit6x: String(neg.rates?.credit6x || ""),
                                                    credit7to12: String(neg.rates?.credit7to12 || ""),
                                                    pix: String(neg.rates?.pix || ""),
                                                    rav: String(neg.rates?.rav || ""),
                                                });
                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                            }}
                                            className="p-1 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button type="button" title="Excluir negociação"
                                            onClick={async () => {
                                                if (!window.confirm(`Excluir negociação de ${fmtDate(neg.dateNeg)}?\n\nEsta ação não pode ser desfeita.`)) return;
                                                try {
                                                    const res = await fetch(`/api/clients/${sel.id}/negotiations/${neg.id}`, { method: "DELETE" });
                                                    const data = await res.json();
                                                    if (data.error === "linked") { alert(data.message); return; }
                                                    loadClients();
                                                } catch { /* */ }
                                            }}
                                            className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
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
