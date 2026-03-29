"use client";

import { useState, useEffect, useCallback } from "react";
import {
    calculateCET,
    formatPercent,
    formatCurrency,
    calculateExemptMachines,
    BRAND_PRESETS,
    type BrandRates,
} from "@/lib/calculator";
import { RI } from "@/components/rate-input";

const STORAGE_KEY = "bitkaiser_cet_calc";

/* ── Proposal Types ── */
interface ProposalConfig {
    id: string;
    label: string;
    desc: string;
    fidelidade: boolean;
    adesao: boolean;
    cancelDias: number;
}

const PROPOSAL_TYPES: ProposalConfig[] = [
    { id: "custom", label: "Personalizada", desc: "Taxas e condições customizadas", fidelidade: false, adesao: false, cancelDias: 0 },
    { id: "essencial_pro", label: "Stone Essencial Pro", desc: "Sem fidelidade • Máquinas por adesão • D0/D1/DU • 1 mês isento da taxa adicional 0,50% • Cancelamento até 7 dias", fidelidade: false, adesao: true, cancelDias: 7 },
    { id: "promo_stone_2m", label: "PROMO STONE — 2 meses", desc: "2 meses grátis recebendo D0 • Fidelidade 13 meses (1º isento + 12) • Taxas promocionais por 2 meses, depois ajusta • Após promo cobra 0,50% p/ manter D0 ou D1 • Cancelamento até 7 dias", fidelidade: true, adesao: false, cancelDias: 7 },
    { id: "stone_flex", label: "Stone Flex", desc: "Taxas variáveis conforme volume • Plano com fidelidade", fidelidade: true, adesao: false, cancelDias: 7 },
];


function getMDR(rates: BrandRates, inst: number) {
    if (inst <= 1) return rates.credit1x;
    if (inst <= 6) return rates.credit2to6;
    if (inst <= 12) return rates.credit7to12;
    return rates.credit13to18;
}

export default function CETCalculatorPage() {
    // State
    const [clientName, setClientName] = useState("");
    const [proposalType, setProposalType] = useState("custom");
    const [brandRates, setBrandRates] = useState<Record<string, BrandRates>>(() => ({ ...BRAND_PRESETS }));
    const [enabledBrands, setEnabledBrands] = useState<Record<string, boolean>>(() => {
        const DEFAULT_ON = ["VISA/MASTER", "ELO"];
        const eb: Record<string, boolean> = {};
        Object.keys(BRAND_PRESETS).forEach(b => eb[b] = DEFAULT_ON.includes(b));
        return eb;
    });
    const [activeBrand, setActiveBrand] = useState("VISA/MASTER");
    const [ravAuto, setRavAuto] = useState(1.30);
    const [ravPontual, setRavPontual] = useState(3.79);
    const [ravTipo, setRavTipo] = useState<"automatico" | "pontual">("automatico");
    const [ravTiming, setRavTiming] = useState<"md" | "ds" | "du">("md");
    const [pixRate, setPixRate] = useState(0.00);
    const [tpv, setTpv] = useState(0);
    const [machines, setMachines] = useState(1);
    const [rental, setRental] = useState(99.90);
    const [fidelidade, setFidelidade] = useState(false);
    const [maqAdesao, setMaqAdesao] = useState(0);
    const [adesaoValor, setAdesaoValor] = useState(478.80);
    const [adesaoParc, setAdesaoParc] = useState(12);

    // Inline brand add
    const [newBrandInput, setNewBrandInput] = useState("");
    const [showNewBrand, setShowNewBrand] = useState(false);

    const ALL_BRANDS = Object.keys(brandRates);
    const ACTIVE_BRANDS = ALL_BRANDS.filter(b => enabledBrands[b]);
    const sr = brandRates[activeBrand] || BRAND_PRESETS["VISA/MASTER"];
    const rav = ravTipo === "pontual" ? 0 : ravAuto;
    const promoInfo = PROPOSAL_TYPES.find(p => p.id === proposalType);

    // Auto-configure when switching proposal type
    function handleProposalChange(id: string) {
        setProposalType(id);
        const config = PROPOSAL_TYPES.find(p => p.id === id);
        if (config && id !== "custom") {
            setFidelidade(config.fidelidade);
            if (id === "promo_stone_2m") {
                setRavTipo("automatico"); setRavTiming("md");
            }
        }
    }

    // Load
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const d = JSON.parse(saved);
                if (d.clientName) setClientName(d.clientName);
                if (d.proposalType) setProposalType(d.proposalType);
                if (d.brandRates) setBrandRates(d.brandRates);
                if (d.enabledBrands) setEnabledBrands(d.enabledBrands);
                if (d.activeBrand) setActiveBrand(d.activeBrand);
                if (d.ravAuto !== undefined) setRavAuto(d.ravAuto);
                if (d.ravPontual !== undefined) setRavPontual(d.ravPontual);
                if (d.ravTipo) setRavTipo(d.ravTipo);
                if (d.ravTiming) setRavTiming(d.ravTiming);
                if (d.pixRate !== undefined) setPixRate(d.pixRate);
                if (d.tpv !== undefined) setTpv(d.tpv);
                if (d.machines !== undefined) setMachines(d.machines);
                if (d.rental !== undefined) setRental(d.rental);
                if (d.fidelidade !== undefined) setFidelidade(d.fidelidade);
                if (d.maqAdesao !== undefined) setMaqAdesao(d.maqAdesao);
            }
        } catch { /* */ }
    }, []);

    // Save
    const save = useCallback(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientName, proposalType, brandRates, enabledBrands, activeBrand, ravAuto, ravPontual, ravTipo, ravTiming, pixRate, tpv, machines, rental, fidelidade, maqAdesao })); } catch { /* */ }
    }, [clientName, proposalType, brandRates, enabledBrands, activeBrand, ravAuto, ravPontual, ravTipo, ravTiming, pixRate, tpv, machines, rental, fidelidade, maqAdesao]);
    useEffect(() => { save(); }, [save]);

    function handleReset() {
        setClientName(""); setProposalType("custom");
        setBrandRates({ ...BRAND_PRESETS }); setActiveBrand("VISA/MASTER");
        const DEFAULT_ON = ["VISA/MASTER", "ELO"];
        const eb: Record<string, boolean> = {};
        Object.keys(BRAND_PRESETS).forEach(b => eb[b] = DEFAULT_ON.includes(b));
        setEnabledBrands(eb);
        setRavAuto(1.30); setRavPontual(3.79); setRavTipo("automatico"); setRavTiming("md");
        setPixRate(0); setTpv(0); setMachines(1); setRental(99.90);
        setFidelidade(false); setMaqAdesao(0); setAdesaoValor(478.80); setAdesaoParc(12);
        localStorage.removeItem(STORAGE_KEY);
    }

    function toggleBrand(b: string) {
        setEnabledBrands(prev => ({ ...prev, [b]: !prev[b] }));
    }

    function getCETColor(cet: number): string {
        if (cet < 5) return "text-emerald-500";
        if (cet < 10) return "text-amber-500";
        return "text-red-500";
    }

    function getCETBg(cet: number): string {
        if (cet < 5) return "bg-emerald-500/10";
        if (cet < 10) return "bg-amber-500/10";
        return "bg-red-500/10";
    }

    // ── PDF Export ──
    function exportPDF() {
        const w = window.open("", "_blank");
        if (!w) return;
        const ipvPdf = calculateExemptMachines(tpv);
        const paidPdf = Math.max(0, machines - ipvPdf);
        const totalMaqPdf = machines + maqAdesao;
        const adesaoCustoPdf = maqAdesao * adesaoValor;
        const ravLabel = ravTipo === "pontual" ? "Pontual (sem antecipação)" : `Automático — ${ravTiming === "md" ? "Mesmo Dia" : ravTiming === "ds" ? "Dia Seguinte" : "Dias Úteis"}`;
        const brandCount = ACTIVE_BRANDS.length;
        // Max 2 brand tables side-by-side for readability
        const gridCols = Math.min(brandCount, 2);
        // Show up to 14 installments to fit in page, extend to 18 only if <=2 brands
        const maxInst = brandCount <= 2 ? 18 : 14;

        let html = `<html><head><title>CET ${clientName || "Stone"}</title>
<style>
@page{size:landscape;margin:8mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#333;padding:8px}
.header{text-align:center;border-bottom:3px solid #00a868;padding-bottom:6px;margin-bottom:10px}
.header h1{font-size:22px;color:#00a868;margin:0 0 4px;font-weight:800;letter-spacing:0.5px}
.badges{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}
.promo-badge,.fidelidade-badge{display:inline-block;font-size:11px;padding:3px 12px;border-radius:4px}
.promo-badge{background:#fff3cd;color:#856404;border:1px solid #ffc107}
.fidelidade-badge{background:#e3f2fd;color:#1565c0;border:1px solid #42a5f5}
.content{display:flex;gap:12px}
.summary{width:220px;flex-shrink:0}
.tables-area{flex:1;min-width:0}
.summary-card{border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin-bottom:8px}
.summary-card h3{font-size:11px;font-weight:700;text-transform:uppercase;color:#00a868;margin-bottom:5px;letter-spacing:0.5px;border-bottom:2px solid #e8f5e9;padding-bottom:3px}
.s-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0;border-bottom:1px solid #f5f5f5}
.s-row:last-child{border-bottom:none}
.s-row .lbl{color:#777;font-size:11px}
.s-row .val{font-weight:700;color:#222;font-size:12px}
.brand-grid{display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:8px}
.brand-card{border:1px solid #ddd;border-radius:6px;overflow:hidden;break-inside:avoid}
.brand-hdr{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:linear-gradient(90deg,#e8f5e9,#f0fdf4);border-bottom:1px solid #c8e6c9}
.brand-hdr h4{font-size:13px;font-weight:700;color:#2e7d32;margin:0}
.brand-hdr .deb{font-size:11px;color:#666}
.brand-hdr .deb b{color:#333}
table{width:100%;border-collapse:collapse}
th{padding:4px 8px;font-weight:600;color:#555;font-size:10px;border-bottom:2px solid #e0e0e0;background:#fafafa;text-transform:uppercase}
td{padding:3px 8px;border-bottom:1px solid #f0f0f0;font-size:12px}
tr:nth-child(even){background:#fafafa}
.green{color:#059669}.amber{color:#d97706}.red{color:#dc2626}
.footer{font-size:10px;color:#aaa;margin-top:8px;border-top:1px solid #eee;padding-top:4px;display:flex;justify-content:space-between}
</style></head><body>`;

        // Header
        html += `<div class="header"><h1>PROPOSTA STONE${clientName ? " \u2014 " + clientName.toUpperCase() : ""}</h1><div class="badges">`;
        if (proposalType !== "custom") html += `<span class="promo-badge">${promoInfo?.label}</span>`;
        if (fidelidade) html += `<span class="fidelidade-badge">FIDELIDADE 13 MESES (1\u00ba m\u00eas isento + 12)</span>`;
        html += `</div></div>`;

        html += `<div class="content">`;

        // LEFT — Summary
        html += `<div class="summary">`;

        // Taxas resumo
        html += `<div class="summary-card"><h3>Taxas por Bandeira</h3>`;
        ACTIVE_BRANDS.forEach(name => {
            const r = brandRates[name];
            html += `<div style="margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid #eee"><div style="font-size:11px;font-weight:700;color:#2e7d32;margin-bottom:1px">${name}</div>`;
            html += `<div class="s-row"><span class="lbl">D\u00e9b</span><span class="val">${formatPercent(r.debit)}</span></div>`;
            html += `<div class="s-row"><span class="lbl">1x</span><span class="val">${formatPercent(r.credit1x)}</span></div>`;
            html += `<div class="s-row"><span class="lbl">2-6x</span><span class="val">${formatPercent(r.credit2to6)}</span></div>`;
            html += `<div class="s-row"><span class="lbl">7-12x</span><span class="val">${formatPercent(r.credit7to12)}</span></div>`;
            html += `</div>`;
        });
        html += `</div>`;

        // RAV
        html += `<div class="summary-card"><h3>Antecipa\u00e7\u00e3o (RAV)</h3>`;
        html += `<div class="s-row"><span class="lbl">Tipo</span><span class="val" style="font-size:11px">${ravLabel}</span></div>`;
        html += `<div class="s-row"><span class="lbl">Auto</span><span class="val">${formatPercent(ravAuto)}</span></div>`;
        html += `<div class="s-row"><span class="lbl">Pontual</span><span class="val">${formatPercent(ravPontual)}</span></div>`;
        html += `</div>`;

        // PIX & Máquinas
        html += `<div class="summary-card"><h3>PIX \u0026 M\u00e1quinas</h3>`;
        html += `<div class="s-row"><span class="lbl">PIX</span><span class="val">${formatPercent(pixRate)}</span></div>`;
        html += `<div class="s-row"><span class="lbl">TPV</span><span class="val">R$ ${tpv.toLocaleString("pt-BR")}</span></div>`;
        html += `<div class="s-row"><span class="lbl">M\u00e1quinas</span><span class="val">${totalMaqPdf}</span></div>`;
        if (maqAdesao > 0) html += `<div class="s-row"><span class="lbl">Ades\u00e3o</span><span class="val" style="color:#1565c0">${maqAdesao} (R$ ${adesaoCustoPdf.toFixed(2)})</span></div>`;
        html += `<div class="s-row"><span class="lbl">IPV (isentas)</span><span class="val" style="color:#059669">${Math.min(ipvPdf, machines)}</span></div>`;
        if (paidPdf > 0) html += `<div class="s-row"><span class="lbl">Aluguel</span><span class="val" style="color:#d97706">R$ ${(paidPdf * rental).toFixed(2)}/m\u00eas</span></div>`;
        else html += `<div class="s-row"><span class="lbl">Aluguel</span><span class="val" style="color:#059669">ISENTO</span></div>`;
        html += `</div>`;

        html += `</div>`; // end summary

        // RIGHT — CET tables in max 2-col grid
        html += `<div class="tables-area"><div class="brand-grid">`;
        ACTIVE_BRANDS.forEach(name => {
            const rates = brandRates[name];
            html += `<div class="brand-card">`;
            html += `<div class="brand-hdr"><h4>${name}</h4><div class="deb">D\u00e9b: <b>${formatPercent(rates.debit)}</b></div></div>`;
            html += `<table><tr><th style="text-align:left;width:50px">Parcela</th><th style="text-align:right">MDR</th><th style="text-align:right">CET</th></tr>`;
            for (let i = 1; i <= maxInst; i++) {
                const mdr = getMDR(rates, i);
                const cet = calculateCET(mdr, rav, i);
                html += `<tr><td style="text-align:left;font-weight:600">${i}x</td><td style="text-align:right">${formatPercent(mdr)}</td><td style="text-align:right;font-weight:700" class="${cet < 5 ? 'green' : cet < 10 ? 'amber' : 'red'}">${formatPercent(cet)}</td></tr>`;
            }
            html += `</table></div>`;
        });
        html += `</div></div></div>`;

        html += `<div class="footer"><span>Gerado em ${new Date().toLocaleDateString("pt-BR")} \u2014 BitKaiser Taxas</span><span>${ravTipo === "pontual" ? "CET = MDR (sem antecipa\u00e7\u00e3o)" : `CET = MDR + RAV ${formatPercent(ravAuto)}`}</span></div>`;
        html += `</body></html>`;
        w.document.write(html); w.document.close(); w.print();
    }

    // ── Excel Export ──
    function exportExcel() {
        let csv = "Bandeira;Debito;Parcela;MDR;CET\n";
        ACTIVE_BRANDS.forEach(name => {
            const rates = brandRates[name];
            for (let i = 1; i <= 18; i++) {
                const mdr = getMDR(rates, i);
                csv += `${name};${rates.debit.toFixed(2).replace(".", ",")};${i}x;${mdr.toFixed(2).replace(".", ",")};${calculateCET(mdr, rav, i).toFixed(2).replace(".", ",")}\n`;
            }
        });
        csv += `\nPIX;${pixRate.toFixed(2).replace(".", ",")}\nRAV Auto;${ravAuto.toFixed(2).replace(".", ",")}\nRAV Pontual;${ravPontual.toFixed(2).replace(".", ",")}\nTPV;${tpv}\n`;
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = `CET_${clientName || "Stone"}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }

    // ── WhatsApp ──
    function shareWhatsApp() {
        let txt = `TABELA CET${clientName ? " — " + clientName : ""}\n`;
        if (proposalType !== "custom") txt += `Proposta: ${promoInfo?.label}\n`;
        txt += ravTipo === "pontual" ? "RAV Pontual (sem antecipacao)\n" : `RAV Auto ${ravTiming === "md" ? "M.Dia" : ravTiming === "ds" ? "D.Seg" : "D.Uteis"}: ${formatPercent(ravAuto)}\n`;
        txt += `PIX: ${formatPercent(pixRate)} | TPV: R$ ${tpv.toLocaleString("pt-BR")}\n`;
        ACTIVE_BRANDS.forEach(name => {
            const rates = brandRates[name];
            txt += `\n${name} (Deb: ${formatPercent(rates.debit)}):\n`;
            for (let i = 1; i <= 12; i++) {
                const mdr = getMDR(rates, i);
                txt += `${i}x: MDR ${formatPercent(mdr)} | CET ${formatPercent(calculateCET(mdr, rav, i))}\n`;
            }
        });
        window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    }

    // Rate Input — imported from shared component (prevents focus loss)

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            {/* Header */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 w-full">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10 flex items-center justify-center shrink-0">
                        <span className="text-emerald-600 dark:text-emerald-400 text-sm font-black">CET</span>
                    </div>
                    <div className="flex-1">
                        <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                            placeholder="Nome da Empresa / Cliente"
                            className="w-full text-lg font-bold bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
                        <p className="text-xs text-muted-foreground">Custo Efetivo Total por parcela e bandeira</p>
                    </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <button onClick={shareWhatsApp} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-medium transition-colors">WhatsApp</button>
                    <button onClick={exportPDF} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium transition-colors">PDF</button>
                    <button onClick={exportExcel} className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 font-medium transition-colors">Excel</button>
                    <button onClick={handleReset} className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-muted-foreground hover:bg-muted font-medium transition-colors">Resetar</button>
                </div>
            </div>

            {/* Main */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* LEFT — Config */}
                <div className="lg:col-span-4 space-y-3">

                    {/* Proposal Type + Fidelidade */}
                    <div className="bg-card border border-border rounded-xl p-3 border-l-2 border-purple-500/30">
                        <h3 className="text-[10px] font-bold text-purple-400 uppercase mb-1.5">Tipo de Proposta</h3>
                        <select value={proposalType} onChange={(e) => handleProposalChange(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-[11px] font-medium focus:ring-1 focus:ring-purple-500">
                            {PROPOSAL_TYPES.map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                        </select>
                        {promoInfo && proposalType !== "custom" && (
                            <p className="text-[11px] text-purple-400 bg-purple-500/10 rounded-md px-2 py-1 mt-1.5">{promoInfo.desc}</p>
                        )}
                        {/* Fidelidade toggle */}
                        <div className="mt-2 pt-2 border-t border-border">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <div className={`relative w-8 h-4 rounded-full transition-colors ${fidelidade ? 'bg-blue-500' : 'bg-secondary'}`}
                                    onClick={() => setFidelidade(!fidelidade)}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${fidelidade ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </div>
                                <span className="text-[10px] text-foreground font-medium">Termo de Fidelidade</span>
                            </label>
                            {fidelidade && (
                                <p className="text-[11px] text-blue-400 bg-blue-500/10 rounded-md px-2 py-1 mt-1.5">1º mês isento + 12 Meses = 13 Meses total</p>
                            )}
                        </div>
                    </div>

                    {/* TPV */}
                    <div className="bg-card border border-border rounded-xl p-3 border-l-2 border-cyan-500/30">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-cyan-400 uppercase">TPV Mensal Acordado</h3>
                            {(() => { const ex = calculateExemptMachines(tpv); return ex > 0 ? <span className="text-[11px] text-emerald-400 font-bold">{ex} maq. isentas</span> : null; })()}
                        </div>
                        <div className="mt-1">
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                <input type="number" min={0} step="1000" value={tpv || ''} onFocus={(e) => e.target.select()} onChange={(e) => setTpv(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-7 pr-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-[12px] font-bold text-right focus:ring-1 focus:ring-cyan-500" />
                            </div>
                        </div>
                    </div>

                    {/* Brand Tabs + Rates */}
                    <div className="bg-card border border-border rounded-xl p-3 border-l-2 border-emerald-500/30">
                        <h3 className="text-[10px] font-bold text-emerald-500 uppercase mb-1.5">Taxas por Bandeira</h3>

                        {/* Toggle chips */}
                        <div className="flex gap-0.5 mb-2 flex-wrap items-center">
                            {ALL_BRANDS.map((b) => (
                                <div key={b} className="relative group">
                                    <button onClick={() => { setActiveBrand(b); if (!enabledBrands[b]) toggleBrand(b); }}
                                        className={`px-1.5 py-0.5 text-[10px] rounded font-semibold transition-all ${activeBrand === b
                                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                                            : enabledBrands[b]
                                                ? "bg-secondary text-foreground hover:bg-muted"
                                                : "bg-secondary/50 text-muted-foreground/50 line-through hover:bg-muted"}`}>
                                        {b}
                                    </button>
                                    {/* Enable/disable toggle */}
                                    <button onClick={(e) => { e.stopPropagation(); toggleBrand(b); }}
                                        className={`absolute -top-1.5 -left-1 w-3 h-3 rounded-full text-[6px] leading-none hidden group-hover:flex items-center justify-center ${enabledBrands[b] ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                                        {enabledBrands[b] ? "✓" : "✕"}
                                    </button>
                                    {/* Remove custom */}
                                    {!BRAND_PRESETS[b] && (
                                        <button onClick={() => {
                                            const next = { ...brandRates }; delete next[b];
                                            setBrandRates(next);
                                            const ne = { ...enabledBrands }; delete ne[b];
                                            setEnabledBrands(ne);
                                            if (activeBrand === b) setActiveBrand(Object.keys(next)[0]);
                                        }} className="absolute -top-1.5 -right-1 w-3 h-3 bg-red-500 text-white rounded-full text-[6px] leading-none hidden group-hover:flex items-center justify-center">x</button>
                                    )}
                                </div>
                            ))}
                            {showNewBrand ? (
                                <div className="flex items-center gap-0.5">
                                    <input type="text" value={newBrandInput} autoFocus
                                        onChange={(e) => setNewBrandInput(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && newBrandInput.trim()) {
                                                const name = newBrandInput.trim();
                                                if (!brandRates[name]) {
                                                    setBrandRates({ ...brandRates, [name]: { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 } });
                                                    setEnabledBrands({ ...enabledBrands, [name]: true });
                                                    setActiveBrand(name);
                                                }
                                                setNewBrandInput(""); setShowNewBrand(false);
                                            }
                                            if (e.key === "Escape") { setNewBrandInput(""); setShowNewBrand(false); }
                                        }}
                                        placeholder="NOME"
                                        className="w-20 px-1 py-0.5 text-[10px] rounded bg-secondary border border-emerald-500/40 text-foreground focus:ring-1 focus:ring-emerald-500" />
                                    <button onClick={() => {
                                        const name = newBrandInput.trim();
                                        if (name && !brandRates[name]) {
                                            setBrandRates({ ...brandRates, [name]: { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 } });
                                            setEnabledBrands({ ...enabledBrands, [name]: true });
                                            setActiveBrand(name);
                                        }
                                        setNewBrandInput(""); setShowNewBrand(false);
                                    }} className="text-[10px] text-emerald-400">OK</button>
                                    <button onClick={() => { setNewBrandInput(""); setShowNewBrand(false); }}
                                        className="text-[10px] text-red-400">X</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowNewBrand(true)}
                                    className="px-1.5 py-0.5 text-[10px] rounded font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">+</button>
                            )}
                        </div>

                        {/* Active count */}
                        <p className="text-[10px] text-muted-foreground mb-1.5">{ACTIVE_BRANDS.length} de {ALL_BRANDS.length} ativas (hover p/ ativar/desativar)</p>

                        <div className="grid grid-cols-2 gap-1.5">
                            <RI l="Debito" v={sr.debit} set={(v) => setBrandRates({ ...brandRates, [activeBrand]: { ...sr, debit: v } })} />
                            <RI l="Cred 1x" v={sr.credit1x} set={(v) => setBrandRates({ ...brandRates, [activeBrand]: { ...sr, credit1x: v } })} />
                            <RI l="2-6x" v={sr.credit2to6} set={(v) => setBrandRates({ ...brandRates, [activeBrand]: { ...sr, credit2to6: v } })} />
                            <RI l="7-12x" v={sr.credit7to12} set={(v) => setBrandRates({ ...brandRates, [activeBrand]: { ...sr, credit7to12: v } })} />
                            <RI l="13-18x" v={sr.credit13to18} set={(v) => setBrandRates({ ...brandRates, [activeBrand]: { ...sr, credit13to18: v } })} />
                        </div>
                    </div>

                    {/* RAV */}
                    <div className="bg-card border border-border rounded-xl p-3 border-l-2 border-amber-500/30">
                        <h3 className="text-[10px] font-bold text-amber-500 uppercase mb-1.5">Antecipacao (RAV)</h3>
                        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                            <div>
                                <label className="text-[11px] text-muted-foreground uppercase block mb-px">Tipo</label>
                                <select value={ravTipo} onChange={(e) => setRavTipo(e.target.value as "automatico" | "pontual")}
                                    className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] focus:ring-1 focus:ring-amber-500">
                                    <option value="automatico">Automatico</option>
                                    <option value="pontual">Pontual (CET=MDR)</option>
                                </select>
                            </div>
                            {ravTipo === "automatico" && (
                                <div>
                                    <label className="text-[11px] text-muted-foreground uppercase block mb-px">Recebimento</label>
                                    <select value={ravTiming} onChange={(e) => setRavTiming(e.target.value as "md" | "ds" | "du")}
                                        className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] focus:ring-1 focus:ring-amber-500">
                                        <option value="md">Mesmo Dia</option>
                                        <option value="ds">Dia Seguinte</option>
                                        <option value="du">Dias Uteis</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <RI l="RAV Auto" v={ravAuto} set={setRavAuto} />
                            <RI l="RAV Pontual" v={ravPontual} set={setRavPontual} />
                        </div>
                        {ravTipo === "pontual" && (
                            <p className="text-[11px] text-amber-400 bg-amber-500/10 rounded-md px-2 py-1 mt-1.5">Sem antecipacao — CET = apenas MDR</p>
                        )}
                    </div>

                    {/* PIX & Maquinas */}
                    <div className="bg-card border border-border rounded-xl p-3 border-l-2 border-blue-500/30">
                        <h3 className="text-[10px] font-bold text-blue-400 uppercase mb-1.5">PIX & Maquinas</h3>
                        <div className="grid grid-cols-2 gap-1.5">
                            <RI l="PIX" v={pixRate} set={setPixRate} />
                            <div>
                                <label className="text-[11px] text-muted-foreground uppercase block mb-px">Aluguel/maq (R$)</label>
                                <input type="number" min={0} step="0.01" value={rental || ''} onFocus={(e) => e.target.select()} onChange={(e) => setRental(parseFloat(e.target.value) || 0)}
                                    className="w-full px-1.5 py-1 rounded-md bg-secondary border border-border text-foreground text-[11px] font-medium text-right focus:ring-1 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                            <div>
                                <label className="text-[11px] text-muted-foreground uppercase block mb-px">Maquinas</label>
                                <input type="number" min={1} value={machines} onFocus={(e) => e.target.select()} onChange={(e) => setMachines(parseInt(e.target.value) || 1)}
                                    className="w-full px-1.5 py-1 rounded-md bg-secondary border border-border text-foreground text-[11px] font-medium text-right focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="text-[11px] text-muted-foreground uppercase block mb-px flex items-center gap-1">
                                    Termos Adesão
                                    <span className="text-[7px] text-blue-400">(R$ {adesaoValor.toFixed(2)}/un)</span>
                                </label>
                                <input type="number" min={0} value={maqAdesao || ''} onFocus={(e) => e.target.select()} onChange={(e) => setMaqAdesao(parseInt(e.target.value) || 0)}
                                    className="w-full px-1.5 py-1 rounded-md bg-secondary border border-border text-foreground text-[11px] font-medium text-right focus:ring-1 focus:ring-blue-500" />
                            </div>
                        </div>
                        {(() => {
                            const ipv = calculateExemptMachines(tpv);
                            // Adesão = sem aluguel (isenção vitalícia, paga R$478,80 uma vez)
                            // Aluguel só nas maquinas da proposta que não são IPV
                            const paidProposta = Math.max(0, machines - ipv);
                            const totalRental = paidProposta * rental;
                            const adesaoCusto = maqAdesao * adesaoValor;
                            const totalMaq = machines + maqAdesao;
                            return (
                                <div className="mt-2 pt-2 border-t border-border space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-muted-foreground">Total máquinas:</span>
                                        <span className="font-bold text-foreground">{totalMaq} ({machines} proposta{maqAdesao > 0 ? ` + ${maqAdesao} adesão` : ''})</span>
                                    </div>
                                    {ipv > 0 && (
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">IPV (isentas volume):</span>
                                            <span className="font-bold text-emerald-400">{Math.min(ipv, machines)} de {machines}</span>
                                        </div>
                                    )}
                                    {maqAdesao > 0 && (
                                        <>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">Adesão (sem aluguel, vitalícia):</span>
                                                <span className="font-bold text-blue-400">{maqAdesao} máq.</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">Custo adesão (até {adesaoParc}x):</span>
                                                <span className="font-bold text-blue-400">{formatCurrency(adesaoCusto)}</span>
                                            </div>
                                        </>
                                    )}
                                    {paidProposta > 0 ? (
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">Aluguel ({paidProposta}x {formatCurrency(rental)}):</span>
                                            <span className="font-bold text-amber-400">{formatCurrency(totalRental)}/mês</span>
                                        </div>
                                    ) : machines > 0 ? (
                                        <p className="text-[11px] text-emerald-400">✓ Proposta: todas isentas pelo IPV</p>
                                    ) : null}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground px-1">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/20" /> &lt;5% Seguro</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500/20" /> 5-10% Atencao</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/20" /> &gt;10% Alto</span>
                    </div>
                </div>

                {/* RIGHT — CET Tables in 2-col grid */}
                <div className="lg:col-span-8">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {ACTIVE_BRANDS.length === 0 && (
                            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                                <p className="text-sm">Nenhuma bandeira ativa</p>
                                <p className="text-xs">Passe o mouse sobre as bandeiras e clique ✓ para ativar</p>
                            </div>
                        )}
                        {ACTIVE_BRANDS.map((name) => {
                            const rates = brandRates[name];
                            return (
                                <div key={name} className="bg-card border border-border rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-border flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-foreground">{name}</h3>
                                        <span className="text-xs text-muted-foreground">Debito: <span className="font-bold text-foreground">{formatPercent(rates.debit)}</span></span>
                                    </div>
                                    <div className="p-1.5">
                                        <table className="w-full border-collapse text-[11px]">
                                            <thead>
                                                <tr>
                                                    <th className="text-[10px] text-muted-foreground font-medium px-1 py-0.5 border-b border-border text-left w-10">Parc.</th>
                                                    <th className="text-[10px] text-muted-foreground font-medium px-1 py-0.5 border-b border-border text-right">MDR</th>
                                                    <th className="text-[10px] text-muted-foreground font-medium px-1 py-0.5 border-b border-border text-right">CET</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Array.from({ length: 18 }, (_, i) => {
                                                    const parcela = i + 1;
                                                    const mdr = getMDR(rates, parcela);
                                                    const cet = calculateCET(mdr, rav, parcela);
                                                    return (
                                                        <tr key={i} className="border-b border-border/20">
                                                            <td className="px-1 py-px text-foreground font-medium">{parcela}x</td>
                                                            <td className="px-1 py-px text-foreground text-right">{formatPercent(mdr)}</td>
                                                            <td className={`px-1 py-px text-right font-bold ${getCETColor(cet)}`}>{formatPercent(cet)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
