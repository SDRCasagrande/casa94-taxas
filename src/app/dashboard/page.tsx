"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPercent } from "@/lib/calculator";
import {
    Users, Handshake, Clock, CheckCircle, TrendingUp,
    FileBarChart, Calculator, GitCompare, Plus, ArrowUpRight,
    Bell, AlertTriangle, Loader2, Zap, ChevronRight,
    BarChart3, Target, UserPlus, Briefcase, DollarSign,
    Star, ListChecks, XCircle, CalendarPlus
} from "lucide-react";

interface RenegAlert { negId: string; clientId: string; clientName: string; stoneCode: string; dateAccept: string; renegDate: string; daysLeft: number }
interface Pipeline { prospeccao: number; proposta_enviada: number; aguardando_cliente: number; aprovado: number; recusado: number; fechado: number }
interface Portfolio { tpvTotal: number; revenueTotal: number; agentCommission: number; month: string }

interface Metrics {
    totalClients: number; activeClients: number; canceledClients: number;
    totalNegotiations: number; pendingNeg: number; acceptedNeg: number; rejectedNeg: number; conversionRate: number;
    pipeline: Pipeline; pendingTasks: number; monthlyCredentialings: number; portfolio: Portfolio;
    avgRates: { debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number };
    recentClients: { id: string; name: string; stoneCode: string; cnpj: string; status?: string; negotiations: { status: string; dateNeg: string; rates: Record<string, number> }[] }[];
    upcomingRenegotiations: RenegAlert[];
}

function fmtDate(d: string) { try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }
function fmtMoney(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtMonth(m: string) { if (!m) return "—"; const [y, mo] = m.split("-"); const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; return `${months[parseInt(mo) - 1]}/${y}`; }

const STAGE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
    prospeccao: { label: "Prospecção", color: "text-slate-500 bg-slate-500/10", dot: "bg-slate-500" },
    proposta_enviada: { label: "Proposta", color: "text-blue-500 bg-blue-500/10", dot: "bg-blue-500" },
    aguardando_cliente: { label: "Aguardando", color: "text-amber-500 bg-amber-500/10", dot: "bg-amber-500" },
    aprovado: { label: "Aprovado", color: "text-emerald-500 bg-emerald-500/10", dot: "bg-emerald-500" },
    recusado: { label: "Recusado", color: "text-red-500 bg-red-500/10", dot: "bg-red-500" },
    fechado: { label: "Fechado", color: "text-purple-500 bg-purple-500/10", dot: "bg-purple-500" },
};

export default function DashboardPage() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("");

    useEffect(() => {
        Promise.all([
            fetch("/api/metrics").then((r) => r.json()).catch(() => null),
            fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
        ]).then(([m, u]) => {
            if (m && !m.error) setMetrics(m);
            if (u?.user?.name) setUserName(u.user.name);
            setLoading(false);
        });
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
            </div>
        </div>
    );

    const pipeline = metrics?.pipeline || { prospeccao: 0, proposta_enviada: 0, aguardando_cliente: 0, aprovado: 0, recusado: 0, fechado: 0 };
    const portfolio = metrics?.portfolio || { tpvTotal: 0, revenueTotal: 0, agentCommission: 0, month: "" };

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* ═══ Welcome Header ═══ */}
            <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-blue-500/10 border border-emerald-500/10">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            {userName ? `Olá, ${userName.split(" ")[0]}!` : "Bem-vindo!"}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Painel de controle BitKaiser Taxas</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {(metrics?.pendingTasks || 0) > 0 && (
                            <Link href="/dashboard/tarefas" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-medium hover:bg-blue-500/20 transition-colors">
                                <ListChecks className="w-3.5 h-3.5" /> {metrics?.pendingTasks} tarefas
                            </Link>
                        )}
                    </div>
                </div>
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl" />
            </div>

            {/* ═══ Renegotiation Alerts ═══ */}
            {metrics && metrics.upcomingRenegotiations && metrics.upcomingRenegotiations.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-amber-500" /></div>
                            Renegociações Próximas
                        </h3>
                        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-bold">{metrics.upcomingRenegotiations.length} alerta(s)</span>
                    </div>
                    <div className="space-y-2">
                        {metrics.upcomingRenegotiations.map((alert) => {
                            const isUrgent = alert.daysLeft <= 0;
                            return (
                                <Link key={alert.negId} href="/dashboard/negociacoes"
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${isUrgent
                                        ? 'bg-red-500/10 hover:bg-red-500/15 border border-red-500/20'
                                        : 'bg-card hover:bg-muted border border-border'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isUrgent ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                                            <AlertTriangle className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{alert.clientName}</p>
                                            <p className="text-[10px] text-muted-foreground">{alert.stoneCode && `SC: ${alert.stoneCode} · `}Aceita em {fmtDate(alert.dateAccept)}</p>
                                        </div>
                                    </div>
                                    <div className={`text-xs font-bold px-3 py-1.5 rounded-lg ${isUrgent ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                                        {isUrgent ? 'HOJE!' : `${alert.daysLeft}d`}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ KPI Cards — Top Row ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/10"><Briefcase className="w-4 h-4 text-white" /></div>
                        {(metrics?.canceledClients || 0) > 0 && <span className="text-[9px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full font-bold">{metrics?.canceledClients} canc.</span>}
                    </div>
                    <p className="text-2xl font-black text-foreground">{metrics?.activeClients ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Clientes Ativos</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/10"><UserPlus className="w-4 h-4 text-white" /></div>
                    </div>
                    <p className="text-2xl font-black text-foreground">{metrics?.monthlyCredentialings ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Credenciamentos Mês</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10"><TrendingUp className="w-4 h-4 text-white" /></div>
                    </div>
                    <p className="text-2xl font-black text-foreground">{fmtMoney(portfolio.tpvTotal)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">TPV {fmtMonth(portfolio.month)}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/10"><DollarSign className="w-4 h-4 text-white" /></div>
                    </div>
                    <p className="text-2xl font-black text-amber-500">{fmtMoney(portfolio.revenueTotal)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Receita Taxas</p>
                </div>
                <div className="bg-card border border-purple-500/20 rounded-2xl p-4 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/10"><Star className="w-4 h-4 text-white" /></div>
                    </div>
                    <p className="text-2xl font-black text-purple-500">{fmtMoney(portfolio.agentCommission)}</p>
                    <p className="text-[10px] text-purple-500 uppercase font-bold tracking-wider mt-0.5">Sua Comissão</p>
                </div>
            </div>

            {/* ═══ Pipeline Stage Overview ═══ */}
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center"><Handshake className="w-3.5 h-3.5 text-indigo-500" /></div>
                        Pipeline de Negociações
                    </h3>
                    <Link href="/dashboard/negociacoes" className="text-xs text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 transition-colors">
                        Kanban <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                    {(Object.entries(STAGE_LABELS) as [string, typeof STAGE_LABELS["prospeccao"]][]).map(([key, stage]) => {
                        const count = pipeline[key as keyof Pipeline] || 0;
                        return (
                            <Link key={key} href="/dashboard/negociacoes" className={`rounded-xl p-3 text-center hover:ring-1 hover:ring-border transition-all ${stage.color}`}>
                                <div className={`w-2 h-2 rounded-full ${stage.dot} mx-auto mb-1.5`} />
                                <p className="text-xl font-black">{count}</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5">{stage.label}</p>
                            </Link>
                        );
                    })}
                </div>
                {/* Funnel bar */}
                {(metrics?.totalNegotiations || 0) > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                        <div className="flex items-center gap-0.5 h-6 rounded-xl overflow-hidden bg-muted">
                            {(["prospeccao", "proposta_enviada", "aguardando_cliente", "aprovado", "recusado", "fechado"] as const).map(key => {
                                const count = pipeline[key] || 0;
                                if (count === 0) return null;
                                const pct = (count / (metrics?.totalNegotiations || 1)) * 100;
                                const colors: Record<string, string> = {
                                    prospeccao: "bg-slate-500", proposta_enviada: "bg-blue-500", aguardando_cliente: "bg-amber-500",
                                    aprovado: "bg-emerald-500", recusado: "bg-red-500", fechado: "bg-purple-500",
                                };
                                return (
                                    <div key={key} className={`h-full ${colors[key]} flex items-center justify-center text-[9px] font-bold text-white transition-all`}
                                        style={{ width: `${Math.max(pct, 4)}%` }} title={`${STAGE_LABELS[key].label}: ${count}`}>
                                        {pct >= 8 && count}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
                            <span>Total: {metrics?.totalNegotiations}</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Conversão: {(metrics?.conversionRate ?? 0).toFixed(1)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Row: Average Rates + Quick Actions ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Average Accepted Rates */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-emerald-500" /></div>
                        Taxas Médias Praticadas
                    </h3>
                    {metrics && metrics.acceptedNeg > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                                { l: "Débito", v: metrics.avgRates.debit }, { l: "Créd 1x", v: metrics.avgRates.credit1x },
                                { l: "2-6x", v: metrics.avgRates.credit2to6 }, { l: "7-12x", v: metrics.avgRates.credit7to12 },
                                { l: "PIX", v: metrics.avgRates.pix }, { l: "RAV", v: metrics.avgRates.rav },
                            ].map((r) => (
                                <div key={r.l} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-center">
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{r.l}</p>
                                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatPercent(r.v)}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" /> Nenhuma negociação aprovada ainda
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-blue-500" /></div>
                        Ações Rápidas
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { href: "/dashboard/clientes", label: "Carteira", icon: Briefcase, desc: "Gerenciar clientes e TPV", gradient: "from-emerald-500 to-teal-600" },
                            { href: "/dashboard/negociacoes", label: "Pipeline", icon: Handshake, desc: "Kanban de negociações", gradient: "from-indigo-500 to-purple-600" },
                            { href: "/dashboard/cet", label: "Calcular CET", icon: Calculator, desc: "Custo efetivo por parcela", gradient: "from-amber-500 to-orange-600" },
                            { href: "/dashboard/comparativo", label: "Comparação", icon: GitCompare, desc: "Stone vs concorrente", gradient: "from-blue-500 to-blue-600" },
                        ].map((a) => (
                            <Link key={a.href} href={a.href}
                                className="group flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-emerald-500/20 transition-all">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}>
                                    <a.icon className="w-4 h-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground leading-tight">{a.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{a.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ Recent Clients ═══ */}
            {metrics && metrics.recentClients.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-blue-500" /></div>
                            Clientes Recentes
                        </h3>
                        <Link href="/dashboard/clientes" className="text-xs text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 transition-colors">
                            Ver todos <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-border">
                        {metrics.recentClients.map((c) => {
                            const last = c.negotiations[0];
                            const stConfig: Record<string, { color: string; label: string }> = {
                                prospeccao: { color: "text-slate-500 bg-slate-500/10", label: "Prospecção" },
                                proposta_enviada: { color: "text-blue-500 bg-blue-500/10", label: "Proposta" },
                                aguardando_cliente: { color: "text-amber-500 bg-amber-500/10", label: "Aguardando" },
                                aprovado: { color: "text-emerald-500 bg-emerald-500/10", label: "Aprovado" },
                                aceita: { color: "text-emerald-500 bg-emerald-500/10", label: "Aprovado" },
                                recusado: { color: "text-red-500 bg-red-500/10", label: "Recusado" },
                                recusada: { color: "text-red-500 bg-red-500/10", label: "Recusado" },
                                fechado: { color: "text-purple-500 bg-purple-500/10", label: "Fechado" },
                                pendente: { color: "text-amber-500 bg-amber-500/10", label: "Pendente" },
                            };
                            const st = stConfig[last?.status || ""] || { color: "text-muted-foreground bg-muted", label: "—" };
                            return (
                                <Link key={c.id} href="/dashboard/clientes"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{c.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                                                {c.status === "cancelado" && <span className="text-[8px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded font-bold">CANC</span>}
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                                                {c.stoneCode && <span>SC: {c.stoneCode}</span>}
                                                {c.cnpj && <span>{c.cnpj}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {last && (
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${st.color}`}>
                                            {st.label}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
