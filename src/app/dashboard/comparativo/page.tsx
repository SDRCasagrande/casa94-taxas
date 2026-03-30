"use client";

import { useState, useEffect, useCallback } from "react";
import {
    calculateCET,
    calculateExemptMachines,
    formatCurrency,
    formatPercent,
    COMPETITORS,
} from "@/lib/calculator";
import {
    Activity,
    Download,
    TrendingDown,
    TrendingUp,
    Percent,
    Tag,
    SmartphoneNfc,
    Wallet
} from "lucide-react";

const STORAGE_KEY = "bitkaiser_comparativo";
const CET_STORAGE_KEY = "bitkaiser_stone_rates";

interface FullRates {
    debit: number;
    credit1x: number;
    credit2to6: number;
    credit7to12: number;
    pix: number;
    rav: number;
}

interface MachineConfig {
    quantity: number;
    rental: number;
}

function defaultStone(): FullRates {
    return { debit: 0.84, credit1x: 1.86, credit2to6: 2.18, credit7to12: 2.41, pix: 0.00, rav: 1.30 };
}
function defaultComp(): FullRates {
    return { debit: 1.39, credit1x: 2.69, credit2to6: 3.15, credit7to12: 3.79, pix: 0.99, rav: 1.99 };
}

export default function ComparativoPage() {
    const [competitorId, setCompetitorId] = useState("rede");

    // Volume em R$ (valor absoluto)
    const [volDebit, setVolDebit] = useState(30000);
    const [volCredit, setVolCredit] = useState(55000);
    const [volPix, setVolPix] = useState(15000);

    const [stoneRates, setStoneRates] = useState<FullRates>(defaultStone);
    const [compRates, setCompRates] = useState<FullRates>(defaultComp);

    const [stoneMachines, setStoneMachines] = useState<MachineConfig>({ quantity: 1, rental: 19.90 });
    const [compMachines, setCompMachines] = useState<MachineConfig>({ quantity: 1, rental: 49.90 });
    const [compExemptManual, setCompExemptManual] = useState(0); // Concorrente: isenção manual

    // Derived
    const tpv = volDebit + volCredit + volPix;
    const shareDebit = tpv > 0 ? (volDebit / tpv) * 100 : 0;
    const shareCredit = tpv > 0 ? (volCredit / tpv) * 100 : 0;
    const sharePix = tpv > 0 ? (volPix / tpv) * 100 : 0;

    // Load
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const d = JSON.parse(saved);
                if (d.volDebit !== undefined) setVolDebit(d.volDebit);
                if (d.volCredit !== undefined) setVolCredit(d.volCredit);
                if (d.volPix !== undefined) setVolPix(d.volPix);
                if (d.stoneRates) setStoneRates(d.stoneRates);
                if (d.compRates) setCompRates(d.compRates);
                if (d.competitorId) setCompetitorId(d.competitorId);
                if (d.stoneMachines) setStoneMachines(d.stoneMachines);
                if (d.compMachines) setCompMachines(d.compMachines);
                if (d.compExemptManual !== undefined) setCompExemptManual(d.compExemptManual);
            }
        } catch { /* ignore */ }
    }, []);

    // Save
    const saveState = useCallback(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                volDebit, volCredit, volPix,
                stoneRates, compRates, competitorId,
                stoneMachines, compMachines, compExemptManual,
            }));
        } catch { /* ignore */ }
    }, [volDebit, volCredit, volPix, stoneRates, compRates, competitorId, stoneMachines, compMachines, compExemptManual]);

    useEffect(() => { saveState(); }, [saveState]);

    // Pull CET
    function pullCET() {
        try {
            const saved = localStorage.getItem(CET_STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                const main = data.containers?.find((c: { enabled: boolean }) => c.enabled);
                if (main) {
                    setStoneRates((prev) => ({
                        ...prev,
                        debit: main.rates.debit,
                        credit1x: main.rates.credit1x,
                        credit2to6: main.rates.credit2to6,
                        credit7to12: main.rates.credit7to12,
                        rav: data.ravRate || prev.rav,
                    }));
                }
            }
        } catch { /* ignore */ }
    }

    // Calc
    function calcCosts(rates: FullRates) {
        const debitCost = (volDebit * rates.debit) / 100;
        const pixCost = (volPix * rates.pix) / 100;
        // Weighted credit CET using 1x, 2-6x, 7-12x average
        const cet1x = calculateCET(rates.credit1x, rates.rav, 1);
        const cet6x = calculateCET(rates.credit2to6, rates.rav, 6);
        const cet12x = calculateCET(rates.credit7to12, rates.rav, 12);
        const avgCET = (cet1x + cet6x + cet12x) / 3;
        const creditCost = (volCredit * avgCET) / 100;
        return { debit: debitCost, credit: creditCost, pix: pixCost, total: debitCost + creditCost + pixCost };
    }

    const stoneCosts = calcCosts(stoneRates);
    const compCosts = calcCosts(compRates);

    // IPV Stone — auto-calculado
    const stoneExempt = calculateExemptMachines(tpv);
    const stonePaidMachines = Math.max(0, stoneMachines.quantity - stoneExempt);
    const stoneEffectiveRental = stonePaidMachines * stoneMachines.rental;

    // IPV Concorrente — manual
    const compPaidMachines = Math.max(0, compMachines.quantity - compExemptManual);
    const compEffectiveRental = compPaidMachines * compMachines.rental;

    const stoneTotal = stoneCosts.total + stoneEffectiveRental;
    const compTotal = compCosts.total + compEffectiveRental;
    const economy = compTotal - stoneTotal;
    const competitorInfo = COMPETITORS.find((c) => c.id === competitorId) || COMPETITORS[0];

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Comparação de Taxas</h1>
                        <p className="text-sm text-muted-foreground">Stone vs {competitorInfo.name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={pullCET}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                        <Download className="w-4 h-4" /> Puxar CET
                    </button>
                </div>
            </div>

            {/* Volume por VALOR + Concorrente */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-foreground mb-1 block">Concorrente</label>
                        <select value={competitorId} onChange={(e) => setCompetitorId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-emerald-500">
                            {COMPETITORS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">TPV Total</p>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(tpv)}</p>
                    </div>
                </div>

                {/* Volume Cards — input R$ → calcula % */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { label: "Débito", value: volDebit, setter: setVolDebit, share: shareDebit, color: "emerald" },
                        { label: "Crédito", value: volCredit, setter: setVolCredit, share: shareCredit, color: "blue" },
                        { label: "PIX", value: volPix, setter: setVolPix, share: sharePix, color: "purple" },
                    ].map((item) => (
                        <div key={item.label} className="rounded-xl bg-secondary p-3">
                            <p className="text-[10px] text-muted-foreground uppercase text-center mb-1">{item.label}</p>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                <input type="number" value={item.value}
                                    onChange={(e) => item.setter(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-8 pr-2 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-bold text-right focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <p className="text-center text-xs text-muted-foreground mt-1.5">
                                <span className="font-semibold text-foreground">{item.share.toFixed(1)}%</span> do total
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rate Containers — 3 colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Stone */}
                <RateCard
                    title="Stone" color="#00A868"
                    rates={stoneRates}
                    onChange={setStoneRates}
                    costs={stoneCosts}
                />
                {/* Competitor */}
                <RateCard
                    title={competitorInfo.name} color={competitorInfo.color}
                    rates={compRates}
                    onChange={setCompRates}
                    costs={compCosts}
                />
                {/* Diff */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-slate-500/10 to-transparent border-b border-border flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-foreground" />
                        <h3 className="font-bold text-foreground text-sm">Diferença</h3>
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                        {[
                            { label: "Débito", diff: compCosts.debit - stoneCosts.debit },
                            { label: "Crédito", diff: compCosts.credit - stoneCosts.credit },
                            { label: "PIX", diff: compCosts.pix - stoneCosts.pix },
                        ].map((item) => (
                            <div key={item.label} className="flex justify-between">
                                <span className="text-muted-foreground">{item.label}:</span>
                                <span className={`font-semibold ${item.diff > 0 ? "text-emerald-500" : item.diff < 0 ? "text-red-500" : "text-foreground"}`}>
                                    {item.diff > 0 ? "+" : ""}{formatCurrency(item.diff)}
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between font-bold border-t border-border pt-2 mt-2">
                            <span>Total Taxas:</span>
                            <span className={compCosts.total - stoneCosts.total > 0 ? "text-emerald-500" : "text-red-500"}>
                                {compCosts.total - stoneCosts.total > 0 ? "+" : ""}{formatCurrency(compCosts.total - stoneCosts.total)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Machines */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MachineCard label="Stone" color="#00A868"
                    config={stoneMachines} onChange={setStoneMachines} />
                <MachineCard label={competitorInfo.name} color={competitorInfo.color}
                    config={compMachines} onChange={setCompMachines} />
            </div>

            {/* IPV — Isenção Por Volume */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-foreground" />
                    <h3 className="font-bold text-foreground text-sm">IPV — Isenção Por Volume</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Stone IPV — automático */}
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Percent className="w-4 h-4" /> Stone (Automático)</h4>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                                {stoneExempt} isenta(s)
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Máquinas total:</span><span className="font-semibold text-foreground">{stoneMachines.quantity}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Isentas (IPV):</span><span className="font-semibold text-emerald-500">{Math.min(stoneExempt, stoneMachines.quantity)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Pagantes:</span><span className="font-semibold text-foreground">{stonePaidMachines}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Aluguel efetivo:</span><span className={`font-semibold ${stoneEffectiveRental === 0 ? 'text-emerald-500' : 'text-foreground'}`}>{formatCurrency(stoneEffectiveRental)}/mês</span></div>
                        </div>
                        {/* Tier table */}
                        <div className="space-y-0.5">
                            <p className="text-[10px] text-muted-foreground uppercase">Regra de Isenção Stone</p>
                            <div className="grid grid-cols-5 gap-1">
                                {[
                                    { tpv: "10k", qty: 1 }, { tpv: "30k", qty: 2 }, { tpv: "50k", qty: 4 },
                                    { tpv: "100k", qty: 6 }, { tpv: "150k", qty: 8 },
                                ].map((tier) => (
                                    <div key={tier.tpv} className={`text-center p-1 rounded text-[10px] ${stoneExempt >= tier.qty ? 'bg-emerald-500/15 text-emerald-500 font-bold' : 'bg-secondary text-muted-foreground'
                                        }`}>
                                        <p>{tier.tpv}</p>
                                        <p>{tier.qty}x</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Competitor IPV — manual */}
                    <div className="rounded-xl bg-secondary p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: competitorInfo.color }}><Percent className="w-4 h-4" /> {competitorInfo.name} (Manual)</h4>
                        </div>
                        <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-0.5">Máquinas Isentas (informar manualmente)</label>
                            <input type="number" min={0} value={compExemptManual}
                                onChange={(e) => setCompExemptManual(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm text-center focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Máquinas total:</span><span className="font-semibold text-foreground">{compMachines.quantity}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Isentas:</span><span className="font-semibold text-foreground">{Math.min(compExemptManual, compMachines.quantity)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Pagantes:</span><span className="font-semibold text-foreground">{compPaidMachines}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Aluguel efetivo:</span><span className="font-semibold text-foreground">{formatCurrency(compEffectiveRental)}/mês</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Economy */}
            <div className={`rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center text-white shadow-lg ${economy > 0 ? "bg-gradient-to-r from-emerald-600 to-emerald-500 glow-green" :
                economy < 0 ? "bg-gradient-to-r from-amber-600 to-amber-500" :
                    "bg-gradient-to-r from-slate-600 to-slate-500"
                }`}>
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        {economy > 0 ? <TrendingDown className="w-7 h-7 text-white" /> : <TrendingUp className="w-7 h-7 text-white" />}
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-medium text-white/80 mb-1">
                            {economy > 0 ? "Economia com a Stone" : economy < 0 ? "Custo adicional na Stone" : "Custos Equivalentes"}
                        </p>
                        <p className="text-2xl sm:text-4xl font-black tracking-tight">{formatCurrency(Math.abs(economy))}<span className="text-base sm:text-lg font-normal text-white/80">/mês</span></p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(Math.abs(economy) * 12)}<span className="text-sm font-normal text-white/80">/ano</span></p>
                    {economy > 0 && compTotal > 0 && (
                        <p className="text-xs text-white/60 mt-1">Redução de {formatPercent((economy / compTotal) * 100)} nos custos</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Rate Card Component ─── */
function RateCard({ title, color, rates, onChange, costs }: {
    title: string; color: string;
    rates: FullRates;
    onChange: (r: FullRates) => void;
    costs: { debit: number; credit: number; pix: number; total: number };
}) {
    const fields: { key: keyof FullRates; label: string }[] = [
        { key: "debit", label: "Débito" },
        { key: "credit1x", label: "Créd. 1x" },
        { key: "credit2to6", label: "2-6x" },
        { key: "credit7to12", label: "7-12x" },
        { key: "pix", label: "PIX" },
        { key: "rav", label: "RAV" },
    ];

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderColor: color + '33' }}>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2"
                style={{ background: `linear-gradient(to right, ${color}15, transparent)` }}>
                <Percent className="w-4 h-4" style={{ color }} />
                <h3 className="font-bold text-sm" style={{ color }}>{title}</h3>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-3 gap-2">
                    {fields.map((f) => (
                        <div key={f.key}>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-0.5">{f.label}</label>
                            <div className="relative">
                                <input type="number" step="0.01" value={rates[f.key]}
                                    onChange={(e) => onChange({ ...rates, [f.key]: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-medium text-right pr-5 focus:ring-2 focus:ring-emerald-500" />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">%</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Débito:</span><span className="font-medium">{formatCurrency(costs.debit)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Crédito:</span><span className="font-medium">{formatCurrency(costs.credit)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PIX:</span><span className="font-medium">{formatCurrency(costs.pix)}</span></div>
                    <div className="flex justify-between font-bold border-t border-border pt-1.5 mt-1.5"><span>Total:</span><span>{formatCurrency(costs.total)}</span></div>
                </div>
            </div>
        </div>
    );
}

function MachineCard({ label, color, config, onChange }: {
    label: string; color: string;
    config: MachineConfig;
    onChange: (c: MachineConfig) => void;
}) {
    return (
        <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <SmartphoneNfc className="w-4 h-4" style={{ color }} />
                <h3 className="font-bold text-sm" style={{ color }}>Máquinas {label}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] text-muted-foreground uppercase block mb-0.5">Quantidade</label>
                    <input type="number" value={config.quantity}
                        onChange={(e) => onChange({ ...config, quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm text-center" />
                </div>
                <div>
                    <label className="text-[10px] text-muted-foreground uppercase block mb-0.5">Aluguel/mês</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <input type="number" step="0.01" value={config.rental}
                            onChange={(e) => onChange({ ...config, rental: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-8 pr-2 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm text-right" />
                    </div>
                </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-right">
                Total: <span className="font-semibold text-foreground">{formatCurrency(config.quantity * config.rental)}</span>/mês
            </p>
        </div>
    );
}
