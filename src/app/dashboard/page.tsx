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
import ActivityPanel from "@/components/ActivityPanel";
import GoalsWidget from "@/components/GoalsWidget";
import AIInsights from "@/components/AIInsights";

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
    aprovado: { label: "Aprovado", color: "text-[#00A868] bg-[#00A868]/10", dot: "bg-[#00A868]" },
    recusado: { label: "Recusado", color: "text-red-500 bg-red-500/10", dot: "bg-red-500" },
    fechado: { label: "Fechado", color: "text-purple-500 bg-purple-500/10", dot: "bg-purple-500" },
};

export default function DashboardPage() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("");
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
    const [rescheduleTarget, setRescheduleTarget] = useState<RenegAlert | null>(null);

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
                <Loader2 className="w-8 h-8 animate-spin text-[#00A868] mx-auto" />
                <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
            </div>
        </div>
    );

    const pipeline = metrics?.pipeline || { prospeccao: 0, proposta_enviada: 0, aguardando_cliente: 0, aprovado: 0, recusado: 0, fechado: 0 };
    const portfolio = metrics?.portfolio || { tpvTotal: 0, revenueTotal: 0, agentCommission: 0, month: "" };

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* ═══ Welcome Header ═══ */}
            <div className="relative overflow-hidden rounded-2xl p-5 bg-[#00A868] text-white">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">
                            {userName ? `Olá, ${userName.split(" ")[0]}!` : "Bem-vindo!"}
                        </h1>
                        <p className="text-white/70 text-sm mt-0.5">Painel de controle BitTask</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {(metrics?.pendingTasks || 0) > 0 && (
                            <Link href="/dashboard/tarefas" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white rounded-xl text-xs font-medium hover:bg-white/30 transition-colors">
                                <ListChecks className="w-3.5 h-3.5" /> {metrics?.pendingTasks} tarefas
                            </Link>
                        )}
                    </div>
                </div>
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 blur-xl" />
            </div>

            {/* ═══ Renegotiation Alerts ═══ */}
            {metrics && metrics.upcomingRenegotiations && metrics.upcomingRenegotiations.filter(a => !dismissedAlerts.has(a.negId)).length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-amber-500" /></div>
                            Renegociações Próximas
                        </h3>
                        <span className="text-[10px] bg-amber-500/20 text-amber-600 px-2.5 py-1 rounded-full font-bold">
                            {metrics.upcomingRenegotiations.filter(a => !dismissedAlerts.has(a.negId)).length} alerta(s)
                        </span>
                    </div>
                    <div className="space-y-2">
                        {metrics.upcomingRenegotiations.filter(a => !dismissedAlerts.has(a.negId)).map((alert) => {
                            const isUrgent = alert.daysLeft <= 0;
                            return (
                                <div key={alert.negId}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${isUrgent
                                        ? 'bg-red-500/10 border border-red-500/20'
                                        : 'bg-card border border-border'}`}>
                                    <Link href="/dashboard/clientes" className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                                            <AlertTriangle className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{alert.clientName}</p>
                                            <p className="text-[10px] text-muted-foreground">{alert.stoneCode && `SC: ${alert.stoneCode} · `}Aceita em {fmtDate(alert.dateAccept)}</p>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isUrgent ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-600'}`}>
                                            {isUrgent ? 'HOJE!' : `${alert.daysLeft}d`}
                                        </div>
                                        <button onClick={() => setRescheduleTarget(alert)}
                                            className="p-1.5 rounded-lg text-[#00A868] bg-[#00A868]/10 hover:bg-[#00A868]/20 transition-colors" title="Reagendar">
                                            <CalendarPlus className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.negId]))}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Dispensar">
                                            <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ Reschedule Modal ═══ */}
            {rescheduleTarget && (
                <>
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setRescheduleTarget(null)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-border">
                                <h3 className="text-sm font-bold text-foreground">Reagendar Renegociação</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">{rescheduleTarget.clientName}</p>
                            </div>
                            <div className="p-5 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Próxima renegociação em:</p>
                                {[7, 15, 30, 60].map(days => {
                                    const d = new Date(); d.setDate(d.getDate() + days);
                                    const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                                    return (
                                        <button key={days} onClick={() => {
                                            // Create a task for the renegotiation
                                            const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + days);
                                            const fd = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
                                            fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ name: "Renegociações" }) }).then(() => {
                                                // Try to find or create a renegotiations list, then add task
                                                fetch("/api/tasks").then(r => r.json()).then(data => {
                                                    const list = data.lists?.find((l: any) => l.name.toLowerCase().includes("renego")) || data.lists?.[0];
                                                    if (list) {
                                                        fetch(`/api/tasks/${list.id}/items`, {
                                                            method: "POST", headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ title: `Renegociar — ${rescheduleTarget.clientName}`, date: fd, time: "09:00", priority: "high",
                                                                description: `Stone Code: ${rescheduleTarget.stoneCode}\nData aceite: ${rescheduleTarget.dateAccept}` })
                                                        });
                                                    }
                                                });
                                            });
                                            setDismissedAlerts(prev => new Set([...prev, rescheduleTarget.negId]));
                                            setRescheduleTarget(null);
                                        }}
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border hover:border-[#00A868]/30 hover:bg-[#00A868]/5 transition-all text-left">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#00A868]/10 flex items-center justify-center">
                                                    <CalendarPlus className="w-4 h-4 text-[#00A868]" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{days} dias</p>
                                                    <p className="text-[10px] text-muted-foreground">{dateStr}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="px-5 py-3 border-t border-border flex justify-end">
                                <button onClick={() => setRescheduleTarget(null)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ KPI Cards — Top Row ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="card-elevated p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-[#00A868]/10 flex items-center justify-center"><Briefcase className="w-4 h-4 text-[#00A868]" /></div>
                        {(metrics?.canceledClients || 0) > 0 && <span className="text-[9px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full font-bold">{metrics?.canceledClients} canc.</span>}
                    </div>
                    <p className="text-2xl font-black text-foreground">{metrics?.activeClients ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Clientes Ativos</p>
                </div>
                <div className="card-elevated p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center"><UserPlus className="w-4 h-4 text-indigo-500" /></div>
                    </div>
                    <p className="text-2xl font-black text-foreground">{metrics?.monthlyCredentialings ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Credenciamentos Mês</p>
                </div>
                <div className="card-elevated p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-[#00A868]/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-[#00A868]" /></div>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-foreground">{fmtMoney(portfolio.tpvTotal)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">TPV {fmtMonth(portfolio.month)}</p>
                </div>
                <div className="card-elevated p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-amber-500" /></div>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-amber-600">{fmtMoney(portfolio.revenueTotal)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Receita Taxas</p>
                </div>
                <div className="card-elevated p-4 hover:shadow-md transition-all border-[#00A868]/20 bg-[#00A868]/[0.03]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center shadow-sm shadow-[#00A868]/20"><Star className="w-4 h-4 text-white" /></div>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-[#00A868]">{fmtMoney(portfolio.agentCommission)}</p>
                    <p className="text-[10px] text-[#00A868] uppercase font-bold tracking-wider mt-0.5">Sua Comissão</p>
                </div>
            </div>

            {/* ═══ Goals Widget ═══ */}
            <GoalsWidget />

            {/* ═══ AI Insights ═══ */}
            <AIInsights />

            {/* ═══ Pipeline Stage Overview ═══ */}
            <div className="card-elevated p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 flex items-center justify-center"><Handshake className="w-3.5 h-3.5 text-[#00A868]" /></div>
                        Pipeline de Negociações
                    </h3>
                    <Link href="/dashboard/negociacoes" className="text-xs text-[#00A868] hover:text-[#008f58] font-medium flex items-center gap-1 transition-colors">
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
                                    aprovado: "bg-[#00A868]", recusado: "bg-red-500", fechado: "bg-purple-500",
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
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#00A868]" /> Conversão: {(metrics?.conversionRate ?? 0).toFixed(1)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Visual Charts Row ═══ */}
            {metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Conversion Donut */}
                    <div className="card-elevated p-5">
                        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 flex items-center justify-center"><Target className="w-3.5 h-3.5 text-[#00A868]" /></div>
                            Taxa de Conversão
                        </h3>
                        <div className="flex items-center gap-6">
                            <div className="relative w-24 h-24 shrink-0">
                                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#00A868" strokeWidth="3"
                                        strokeDasharray={`${(metrics.conversionRate || 0) * 0.88} 88`}
                                        strokeLinecap="round" className="transition-all duration-1000" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-black text-[#00A868]">{(metrics.conversionRate || 0).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#00A868]" /> Aprovadas</span>
                                    <span className="font-bold text-foreground">{metrics.acceptedNeg}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Recusadas</span>
                                    <span className="font-bold text-foreground">{metrics.rejectedNeg}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Pendentes</span>
                                    <span className="font-bold text-foreground">{metrics.pendingNeg}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-bold text-foreground">{metrics.totalNegotiations}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Portfolio TPV Breakdown */}
                    <div className="card-elevated p-5">
                        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center"><DollarSign className="w-3.5 h-3.5 text-indigo-500" /></div>
                            Portfolio {portfolio.month ? `— ${fmtMonth(portfolio.month)}` : ""}
                        </h3>
                        {portfolio.tpvTotal > 0 ? (
                            <div className="space-y-3">
                                <div className="text-center mb-3">
                                    <p className="text-2xl font-black text-foreground">{fmtMoney(portfolio.tpvTotal)}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">TPV Total</p>
                                </div>
                                <div className="flex h-8 rounded-xl overflow-hidden bg-muted">
                                    <div className="bg-[#00A868] flex items-center justify-center text-[9px] font-bold text-white" style={{ width: `${Math.max((portfolio.revenueTotal / (portfolio.tpvTotal || 1)) * 100, 5)}%` }}>
                                        Receita
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-indigo-500/5 rounded-lg p-2">
                                        <p className="text-xs font-black text-indigo-500">{fmtMoney(portfolio.revenueTotal)}</p>
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Receita</p>
                                    </div>
                                    <div className="bg-purple-500/5 rounded-lg p-2">
                                        <p className="text-xs font-black text-purple-500">{fmtMoney(portfolio.agentCommission)}</p>
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Comissão</p>
                                    </div>
                                    <div className="bg-[#00A868]/5 rounded-lg p-2">
                                        <p className="text-xs font-black text-[#00A868]">{((portfolio.agentCommission / (portfolio.tpvTotal || 1)) * 100).toFixed(3)}%</p>
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Margem</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-sm text-muted-foreground">
                                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" /> Nenhum TPV registrado
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ Painel de Controle (Activity Feed) ═══ */}
            <ActivityPanel />

            {/* ═══ Row: Average Rates + Quick Actions ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Average Accepted Rates */}
                <div className="card-elevated p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-[#00A868]" /></div>
                        Taxas Médias Praticadas
                    </h3>
                    {metrics && metrics.acceptedNeg > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                                { l: "Débito", v: metrics.avgRates.debit }, { l: "Créd 1x", v: metrics.avgRates.credit1x },
                                { l: "2-6x", v: metrics.avgRates.credit2to6 }, { l: "7-12x", v: metrics.avgRates.credit7to12 },
                                { l: "PIX", v: metrics.avgRates.pix }, { l: "RAV", v: metrics.avgRates.rav },
                            ].map((r) => (
                                <div key={r.l} className="bg-[#00A868]/5 border border-[#00A868]/10 rounded-xl p-2.5 text-center">
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">{r.l}</p>
                                    <p className="text-sm font-black text-[#00A868] mt-0.5">{formatPercent(r.v)}</p>
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
                <div className="card-elevated p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-[#00A868]" /></div>
                        Ações Rápidas
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { href: "/dashboard/clientes", label: "Carteira", icon: Briefcase, desc: "Gerenciar clientes e TPV" },
                            { href: "/dashboard/negociacoes", label: "Pipeline", icon: Handshake, desc: "Kanban de negociações" },
                            { href: "/dashboard/cet", label: "Calcular CET", icon: Calculator, desc: "Custo efetivo por parcela" },
                            { href: "/dashboard/comparativo", label: "Comparação", icon: GitCompare, desc: "Suas taxas vs concorrente" },
                        ].map((a) => (
                            <Link key={a.href} href={a.href}
                                className="group flex items-start gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary border border-transparent hover:border-[#00A868]/20 transition-all touch-target">
                                <div className="w-9 h-9 rounded-lg bg-[#00A868]/10 flex items-center justify-center shrink-0 group-hover:bg-[#00A868]/15 transition-colors">
                                    <a.icon className="w-4 h-4 text-[#00A868]" />
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
                <div className="card-elevated overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-[#00A868]" /></div>
                            Clientes Recentes
                        </h3>
                        <Link href="/dashboard/clientes" className="text-xs text-[#00A868] hover:text-[#008f58] font-medium flex items-center gap-1 transition-colors">
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
                                aprovado: { color: "text-[#00A868] bg-[#00A868]/10", label: "Aprovado" },
                                aceita: { color: "text-[#00A868] bg-[#00A868]/10", label: "Aprovado" },
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
                                        <div className="w-9 h-9 rounded-xl bg-[#00A868]/10 border border-[#00A868]/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-[#00A868]">{c.name.charAt(0).toUpperCase()}</span>
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
