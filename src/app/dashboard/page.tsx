"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPercent } from "@/lib/calculator";
import {
    Users, Handshake, Clock, CheckCircle, TrendingUp,
    FileBarChart, Calculator, GitCompare, Plus, ArrowUpRight,
    Bell, AlertTriangle, Loader2, Zap, ChevronRight,
    BarChart3, Target, UserPlus
} from "lucide-react";

interface RenegAlert {
    negId: string;
    clientId: string;
    clientName: string;
    stoneCode: string;
    dateAccept: string;
    renegDate: string;
    daysLeft: number;
}

interface Metrics {
    totalClients: number;
    totalNegotiations: number;
    pendingNeg: number;
    acceptedNeg: number;
    rejectedNeg: number;
    conversionRate: number;
    avgRates: { debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number };
    recentClients: { id: string; name: string; stoneCode: string; cnpj: string; negotiations: { status: string; dateNeg: string; rates: Record<string, number> }[] }[];
    upcomingRenegotiations: RenegAlert[];
}

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

    const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                    <p className="text-sm text-muted-foreground">Carregando métricas...</p>
                </div>
            </div>
        );
    }

    const kpis = [
        { label: "Clientes", value: metrics?.totalClients ?? 0, icon: Users, gradient: "from-blue-500 to-blue-600", bg: "bg-blue-500/10", text: "text-blue-500" },
        { label: "Negociações", value: metrics?.totalNegotiations ?? 0, icon: Handshake, gradient: "from-emerald-500 to-emerald-600", bg: "bg-emerald-500/10", text: "text-emerald-500" },
        { label: "Pendentes", value: metrics?.pendingNeg ?? 0, icon: Clock, gradient: "from-amber-500 to-amber-600", bg: "bg-amber-500/10", text: "text-amber-500" },
        { label: "Aceitas", value: metrics?.acceptedNeg ?? 0, icon: CheckCircle, gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-500/10", text: "text-emerald-500" },
        { label: "Conversão", value: `${(metrics?.conversionRate ?? 0).toFixed(1)}%`, icon: Target, gradient: "from-purple-500 to-purple-600", bg: "bg-purple-500/10", text: "text-purple-500" },
    ];

    const quickActions = [
        { href: "/dashboard/proposta", label: "Nova Simulação", icon: FileBarChart, desc: "Comparar taxas e gerar proposta", gradient: "from-emerald-500 to-teal-600" },
        { href: "/dashboard/negociacoes", label: "Novo Cliente", icon: UserPlus, desc: "Cadastrar cliente no CRM", gradient: "from-blue-500 to-blue-600" },
        { href: "/dashboard/cet", label: "Calcular CET", icon: Calculator, desc: "Custo efetivo por parcela", gradient: "from-amber-500 to-orange-600" },
        { href: "/dashboard/comparativo", label: "Comparação", icon: GitCompare, desc: "Stone vs concorrente", gradient: "from-purple-500 to-purple-600" },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* ═══ Welcome Header ═══ */}
            <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-blue-500/10 border border-emerald-500/10">
                <div className="relative z-10">
                    <h1 className="text-xl font-bold text-foreground">
                        {userName ? `Olá, ${userName}!` : "Bem-vindo!"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Painel de controle BitKaiser Taxas</p>
                </div>
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl" />
                <div className="absolute -bottom-12 -right-4 w-24 h-24 rounded-full bg-teal-500/5 blur-xl" />
            </div>

            {/* ═══ Renegotiation Alerts ═══ */}
            {metrics && metrics.upcomingRenegotiations && metrics.upcomingRenegotiations.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                                <Bell className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            Renegociações Próximas
                        </h3>
                        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-bold">
                            {metrics.upcomingRenegotiations.length} alerta(s)
                        </span>
                    </div>
                    <div className="space-y-2">
                        {metrics.upcomingRenegotiations.map((alert) => {
                            const isUrgent = alert.daysLeft <= 0;
                            return (
                                <Link key={alert.negId} href="/dashboard/negociacoes"
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${isUrgent
                                        ? 'bg-red-500/10 hover:bg-red-500/15 border border-red-500/20'
                                        : 'bg-card hover:bg-muted border border-border'
                                        }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isUrgent ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                                            <AlertTriangle className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{alert.clientName}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {alert.stoneCode && `SC: ${alert.stoneCode} · `}Aceita em {fmtDate(alert.dateAccept)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-xs font-bold px-3 py-1.5 rounded-lg ${isUrgent
                                        ? 'bg-red-500/20 text-red-500'
                                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                        }`}>
                                        {isUrgent ? 'HOJE!' : `${alert.daysLeft}d`}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ KPI Cards ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg shadow-emerald-500/10`}>
                                <kpi.icon className="w-5 h-5 text-white" />
                            </div>
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 opacity-60" />
                        </div>
                        <p className="text-2xl font-black text-foreground">{typeof kpi.value === 'number' ? kpi.value.toLocaleString('pt-BR') : kpi.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{kpi.label}</p>
                    </div>
                ))}
            </div>

            {/* ═══ Row: Average Rates + Quick Actions ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Average Accepted Rates */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        Taxas Médias Praticadas
                    </h3>
                    {metrics && metrics.acceptedNeg > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                                { l: "Débito", v: metrics.avgRates.debit },
                                { l: "Créd 1x", v: metrics.avgRates.credit1x },
                                { l: "2-6x", v: metrics.avgRates.credit2to6 },
                                { l: "7-12x", v: metrics.avgRates.credit7to12 },
                                { l: "PIX", v: metrics.avgRates.pix },
                                { l: "RAV", v: metrics.avgRates.rav },
                            ].map((r) => (
                                <div key={r.l} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-center">
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{r.l}</p>
                                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatPercent(r.v)}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            Nenhuma negociação aceita ainda
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        Ações Rápidas
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {quickActions.map((a) => (
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
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Users className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            Clientes Recentes
                        </h3>
                        <Link href="/dashboard/negociacoes" className="text-xs text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 transition-colors">
                            Ver todos <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-border">
                        {metrics.recentClients.map((c) => {
                            const last = c.negotiations[0];
                            const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
                                aceita: { color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle, label: "Aceita" },
                                pendente: { color: "text-amber-500 bg-amber-500/10", icon: Clock, label: "Pendente" },
                                recusada: { color: "text-red-500 bg-red-500/10", icon: AlertTriangle, label: "Recusada" },
                            };
                            const st = statusConfig[last?.status || ""] || statusConfig.pendente;
                            return (
                                <Link key={c.id} href="/dashboard/negociacoes"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{c.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                                                {c.stoneCode && <span>SC: {c.stoneCode}</span>}
                                                {c.cnpj && <span>{c.cnpj}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {last && (
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="text-[10px] text-muted-foreground hidden sm:block">{fmtDate(last.dateNeg)}</span>
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${st.color}`}>
                                                <st.icon className="w-3 h-3" />
                                                {st.label}
                                            </span>
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ Negotiation Funnel ═══ */}
            {metrics && metrics.totalNegotiations > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Target className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        Funil de Negociações
                    </h3>
                    <div className="flex items-center gap-1 h-8 rounded-xl overflow-hidden bg-muted">
                        {metrics.acceptedNeg > 0 && (
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-center text-[10px] font-bold text-white px-3 rounded-l-xl"
                                style={{ width: `${(metrics.acceptedNeg / metrics.totalNegotiations) * 100}%`, minWidth: 48 }}>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {metrics.acceptedNeg}
                            </div>
                        )}
                        {metrics.pendingNeg > 0 && (
                            <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center text-[10px] font-bold text-white px-3"
                                style={{ width: `${(metrics.pendingNeg / metrics.totalNegotiations) * 100}%`, minWidth: 48 }}>
                                <Clock className="w-3 h-3 mr-1" />
                                {metrics.pendingNeg}
                            </div>
                        )}
                        {metrics.rejectedNeg > 0 && (
                            <div className="h-full bg-gradient-to-r from-red-500 to-red-400 flex items-center justify-center text-[10px] font-bold text-white px-3 rounded-r-xl"
                                style={{ width: `${(metrics.rejectedNeg / metrics.totalNegotiations) * 100}%`, minWidth: 48 }}>
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {metrics.rejectedNeg}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Aceitas: {(metrics.conversionRate).toFixed(1)}%
                        </span>
                        <span>Total: {metrics.totalNegotiations}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
