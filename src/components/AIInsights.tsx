"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Sparkles, TrendingDown, AlertTriangle, Clock, Target, ChevronRight,
    Loader2, RefreshCw, Lightbulb, BarChart3, UserX, CalendarClock
} from "lucide-react";

interface Insight {
    type: "rate_suggestion" | "churn_risk" | "renegotiation_timing" | "opportunity";
    title: string;
    description: string;
    urgency: "high" | "medium" | "low";
    clientName?: string;
    clientId?: string;
    data?: Record<string, any>;
}

const TYPE_CONFIG = {
    rate_suggestion: { icon: BarChart3, color: "text-blue-500", bg: "bg-blue-500/10", label: "Taxa" },
    churn_risk: { icon: UserX, color: "text-red-500", bg: "bg-red-500/10", label: "Risco" },
    renegotiation_timing: { icon: CalendarClock, color: "text-amber-500", bg: "bg-amber-500/10", label: "Timing" },
    opportunity: { icon: Target, color: "text-[#00A868]", bg: "bg-[#00A868]/10", label: "Oportunidade" },
};

const URGENCY_STYLES = {
    high: "border-l-4 border-l-red-500 bg-red-500/[0.03]",
    medium: "border-l-4 border-l-amber-500 bg-amber-500/[0.03]",
    low: "border-l-4 border-l-blue-500/30",
};

export default function AIInsights() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    const loadInsights = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ai/insights");
            const data = await res.json();
            if (data.insights) setInsights(data.insights);
        } catch { /* */ }
        setLoading(false);
    };

    useEffect(() => { loadInsights(); }, []);

    if (loading) {
        return (
            <div className="card-elevated p-5">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse-subtle" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-foreground">Assistente IA</h3>
                        <p className="text-[10px] text-muted-foreground">Analisando seus dados...</p>
                    </div>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                </div>
            </div>
        );
    }

    if (insights.length === 0) return null;

    const visible = expanded ? insights : insights.slice(0, 3);

    return (
        <div className="card-elevated overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    Assistente IA
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        {insights.length} insight{insights.length !== 1 ? "s" : ""}
                    </span>
                </h3>
                <button onClick={loadInsights} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Atualizar">
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Insights list */}
            <div className="divide-y divide-border">
                {visible.map((insight, i) => {
                    const config = TYPE_CONFIG[insight.type];
                    const Icon = config.icon;

                    return (
                        <div key={`${insight.type}-${i}`}
                            className={`px-5 py-3.5 hover:bg-muted/30 transition-colors ${URGENCY_STYLES[insight.urgency]}`}>
                            <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-sm font-semibold text-foreground leading-tight">{insight.title}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color} uppercase tracking-wider`}>
                                            {config.label}
                                        </span>
                                        {insight.urgency === "high" && (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 uppercase tracking-wider flex items-center gap-0.5">
                                                <AlertTriangle className="w-2.5 h-2.5" /> Urgente
                                            </span>
                                        )}
                                        {insight.clientId && (
                                            <Link href="/dashboard/clientes" className="text-[10px] text-[#00A868] hover:text-[#008f58] font-medium flex items-center gap-0.5 transition-colors">
                                                Ver cliente <ChevronRight className="w-2.5 h-2.5" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            {insights.length > 3 && (
                <div className="px-5 py-2.5 border-t border-border bg-muted/10">
                    <button onClick={() => setExpanded(!expanded)}
                        className="w-full text-center text-xs text-purple-500 hover:text-purple-400 font-medium transition-colors flex items-center justify-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        {expanded ? "Mostrar menos" : `Ver mais ${insights.length - 3} insight(s)`}
                    </button>
                </div>
            )}
        </div>
    );
}
