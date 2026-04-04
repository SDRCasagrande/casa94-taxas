"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPercent } from "@/lib/calculator";
import {
    Users, Plus, Search, TrendingUp, DollarSign, Star,
    Loader2, CheckCircle, XCircle, FileSpreadsheet, Download
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";
import { generateExecutiveReportPDF } from "@/lib/executive-report";
import { calculateLeadScore } from "@/lib/lead-score";
import {
    NewClientForm, ClientDetail, ImportCSVModal,
    Client, fmtMoney, currentMonth, calcCommission
} from "./components";

function StatusBadge({ s }: { s: string }) {
    if (s === "cancelado") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20"><XCircle className="w-2.5 h-2.5" />Cancelado</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20"><CheckCircle className="w-2.5 h-2.5" />Ativo</span>;
}

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
    const [sortBy, setSortBy] = useState<"score" | "name" | "tpv" | "safra">("score");
    const [showImport, setShowImport] = useState(false);
    const [teamUsers, setTeamUsers] = useState<{id: string; name: string; email: string}[]>([]);

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
    }).sort((a, b) => {
        if (sortBy === "score") return calculateLeadScore(b).score - calculateLeadScore(a).score;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "tpv") {
            const cm = currentMonth();
            const aVol = a.monthlyVolumes.find(v => v.month === cm);
            const bVol = b.monthlyVolumes.find(v => v.month === cm);
            const aTPV = aVol ? calcCommission(aVol).tpvTotal : 0;
            const bTPV = bVol ? calcCommission(bVol).tpvTotal : 0;
            return bTPV - aTPV;
        }
        if (sortBy === "safra") {
            const order: Record<string, number> = { M0: 0, M1: 1, M2: 2, M3: 3, BASE: 4 };
            return (order[a.safra] ?? 5) - (order[b.safra] ?? 5);
        }
        return 0;
    });

    const totalPortfolio = clients.filter(c => c.status === "ativo").length;
    const allCurrentMonthVolumes = clients.flatMap(c => c.monthlyVolumes.filter(v => v.month === currentMonth()));
    const monthSummary = allCurrentMonthVolumes.reduce((a, v) => { const c = calcCommission(v); return { tpv: a.tpv + c.tpvTotal, rev: a.rev + c.totalRevenue, agent: a.agent + c.agent }; }, { tpv: 0, rev: 0, agent: 0 });

    async function handleSaveClient(data: any) {
        try {
            const r = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
            if (r.ok) { setView("grid"); loadClients(); }
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

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00A868]" /></div>;

    if (view === "new") return <NewClientForm onSave={handleSaveClient} onCancel={() => setView("grid")} />;

    if (view === "detail" && sel) return (
        <ClientDetail
            client={sel}
            teamUsers={teamUsers}
            loadClients={loadClients}
            onBack={() => { setView("grid"); setSelId(null); }}
            onCancelClient={handleCancelClient}
            onReactivate={handleReactivate}
            onDelete={handleDelete}
        />
    );

    /* ═══ GRID VIEW ═══ */
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20"><Users className="w-4 h-4" /></div>
                    <div>
                        <h1 className="text-lg font-bold">Carteira de Clientes</h1>
                        <p className="text-xs text-muted-foreground">{totalPortfolio} ativos · TPV mês: {fmtMoney(monthSummary.tpv)} · Comissão: {fmtMoney(monthSummary.agent)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => {
                        const m = currentMonth();
                        const userName = teamUsers.find(x => true)?.name || "Sistema"; // Or any specific logic if you had user session injected
                        generateExecutiveReportPDF(clients, m, userName);
                    }} className="flex items-center gap-2 px-3 py-2.5 border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 rounded-xl text-sm font-medium transition-all touch-target" title="Relatório Executivo PDF">
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2.5 border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl text-sm font-medium transition-all touch-target">
                        <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
                    </button>
                    <button onClick={() => setView("new")} className="flex items-center gap-2 px-4 py-2.5 bg-[#00A868] hover:bg-[#008f58] text-white rounded-xl text-sm font-medium shadow-lg shadow-[#00A868]/20 active:scale-[0.98] transition-all touch-target">
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo Cliente</span>
                    </button>
                </div>
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
                <div className="flex gap-1 bg-secondary/50 rounded-xl p-0.5 overflow-x-auto">
                    {([["all", "Todos"], ["ativo", "Ativos"], ["cancelado", "Cancelados"]] as const).map(([key, lbl]) => (
                        <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${filter === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{lbl}</button>
                    ))}
                </div>
                <div className="flex gap-1 bg-secondary/50 rounded-xl p-0.5 flex-wrap overflow-x-auto">
                    <button onClick={() => setBrandFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${brandFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>🏢 Todos</button>
                    {[...new Set(clients.map(c => c.brand).filter(Boolean))].sort().map(b => (
                        <button key={b} onClick={() => setBrandFilter(b)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${brandFilter === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                            {b === "STONE" ? "🟢" : b === "TON" ? "🔵" : "🏷️"} {b}
                        </button>
                    ))}
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs font-semibold text-muted-foreground focus:text-foreground transition-all cursor-pointer">
                    <option value="score">⭐ Score</option>
                    <option value="name">🔤 Nome</option>
                    <option value="tpv">💰 TPV</option>
                    <option value="safra">🌱 Safra</option>
                </select>
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
                            <button key={c.id} onClick={() => { setSelId(c.id); setView("detail"); }}
                                className="card-elevated rounded-xl p-4 text-left hover:border-[#00A868]/30 hover:shadow-md transition-all group">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#00A868]/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-[#00A868]">{c.name.charAt(0)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate flex items-center justify-between">
                                            {c.name}
                                            {c.user && (
                                                <span className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border" title={`Carteira de: ${c.user.name}`}>
                                                    <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white uppercase">{c.user.name.charAt(0)}</div>
                                                    <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline-block max-w-[80px] truncate">{c.user.name.split(' ')[0]}</span>
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
                                            {c.stoneCode && <span>SC: {c.stoneCode}</span>}
                                            {c.segment && <span>{c.segment}</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <StatusBadge s={c.status} />
                                        {(() => {
                                            const ls = calculateLeadScore(c);
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${ls.color}`} title={`Score: ${ls.score}/100`}>
                                                    {ls.emoji} {ls.score}
                                                </span>
                                            );
                                        })()}
                                        <div className="flex items-center gap-1 mt-0.5">
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

            {showImport && (
                <ImportCSVModal 
                    onClose={() => setShowImport(false)}
                    onImported={() => {
                        setShowImport(false);
                        loadClients();
                    }}
                />
            )}
        </div>
    );
}
