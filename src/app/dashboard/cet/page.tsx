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
import { BrandIcon } from "@/components/BrandIcons";
import { BrandSelectorModal } from "@/components/BrandSelectorModal";

const STORAGE_KEY = "bitkaiser_cet_calc";
const TEMPLATES_KEY = "bitkaiser_proposal_templates";

/* ── Proposal Templates (dynamic) ── */
interface ProposalTemplate {
    id: string;
    label: string;
    desc: string;
    fidelidade: boolean;
    adesao: boolean;
    cancelDias: number;
    // Defaults when template is selected
    defaultRates?: Record<string, BrandRates>;
    defaultEnabledBrands?: string[];
    defaultRavAuto?: number;
    defaultRavPontual?: number;
    defaultRavTipo?: "automatico" | "pontual";
    defaultRavTiming?: "md" | "ds" | "du";
    defaultPixRate?: number;
    defaultMachines?: number;
    defaultRental?: number;
    defaultMaqAdesao?: number;
    defaultAdesaoValor?: number;
}

const BASE_TEMPLATE: ProposalTemplate = { id: "custom", label: "Personalizada", desc: "Taxas e condições customizadas", fidelidade: false, adesao: false, cancelDias: 0 };

function loadTemplates(): ProposalTemplate[] {
    try {
        const saved = localStorage.getItem(TEMPLATES_KEY);
        if (saved) return [BASE_TEMPLATE, ...JSON.parse(saved)];
    } catch { /* */ }
    return [BASE_TEMPLATE];
}

function saveTemplates(templates: ProposalTemplate[]) {
    try {
        // Save without the base template
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.filter(t => t.id !== "custom")));
    } catch { /* */ }
}


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
    const [templates, setTemplates] = useState<ProposalTemplate[]>([BASE_TEMPLATE]);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ProposalTemplate | null>(null);
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
    const [showBrandModal, setShowBrandModal] = useState(false);

    // Load templates
    useEffect(() => { setTemplates(loadTemplates()); }, []);

    // Client autocomplete
    interface ClientSuggestion { id: string; name: string; cnpj: string; negotiations: { rates: any }[] }
    const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        fetch("/api/clients").then(r => r.json()).then(d => {
            if (Array.isArray(d)) setClientSuggestions(d);
        }).catch(() => {});
    }, []);

    function selectClient(c: ClientSuggestion) {
        setClientName(c.name);
        setShowSuggestions(false);
        // Auto-fill rates from latest negotiation
        const lastNeg = c.negotiations?.[0];
        if (lastNeg?.rates) {
            const r = lastNeg.rates;
            if (r.brandRates) {
                const newBR = { ...brandRates };
                const newEB = { ...enabledBrands };
                for (const [brand, vals] of Object.entries(r.brandRates as Record<string, any>)) {
                    newBR[brand] = { debit: vals.debit || 0, credit1x: vals.credit1x || 0, credit2to6: vals.credit2to6 || 0, credit7to12: vals.credit7to12 || 0, credit13to18: vals.credit13to18 || vals.credit7to12 || 0 };
                    newEB[brand] = true;
                }
                setBrandRates(newBR);
                setEnabledBrands(newEB);
            }
            if (r.pix !== undefined) setPixRate(r.pix);
            if (r.ravRate !== undefined || r.rav !== undefined) setRavAuto(r.ravRate ?? r.rav ?? 1.30);
            if (r.ravPontual !== undefined) setRavPontual(r.ravPontual);
            if (r.ravTipo) setRavTipo(r.ravTipo);
            if (r.ravTiming) setRavTiming(r.ravTiming);
        }
    }
    const ALL_BRANDS = Object.keys(brandRates);
    const ACTIVE_BRANDS = ALL_BRANDS.filter(b => enabledBrands[b]);
    const sr = brandRates[activeBrand] || BRAND_PRESETS["VISA/MASTER"];
    const rav = ravTipo === "pontual" ? 0 : ravAuto;
    const promoInfo = templates.find((p: ProposalTemplate) => p.id === proposalType);

    // Auto-configure when switching proposal type
    function handleProposalChange(id: string) {
        setProposalType(id);
        const config = templates.find((p: ProposalTemplate) => p.id === id);
        if (config && id !== "custom") {
            setFidelidade(config.fidelidade);
            // Apply template defaults
            if (config.defaultRates) {
                setBrandRates({ ...BRAND_PRESETS, ...config.defaultRates });
                if (config.defaultEnabledBrands) {
                    const eb: Record<string, boolean> = {};
                    Object.keys(BRAND_PRESETS).forEach(b => eb[b] = false);
                    config.defaultEnabledBrands.forEach(b => eb[b] = true);
                    setEnabledBrands(eb);
                }
            }
            if (config.defaultRavAuto !== undefined) setRavAuto(config.defaultRavAuto);
            if (config.defaultRavPontual !== undefined) setRavPontual(config.defaultRavPontual);
            if (config.defaultRavTipo) setRavTipo(config.defaultRavTipo);
            if (config.defaultRavTiming) setRavTiming(config.defaultRavTiming);
            if (config.defaultPixRate !== undefined) setPixRate(config.defaultPixRate);
            if (config.defaultMachines !== undefined) setMachines(config.defaultMachines);
            if (config.defaultRental !== undefined) setRental(config.defaultRental);
            if (config.defaultMaqAdesao !== undefined) setMaqAdesao(config.defaultMaqAdesao);
            if (config.defaultAdesaoValor !== undefined) setAdesaoValor(config.defaultAdesaoValor);
        }
    }

    // Template CRUD
    function handleSaveTemplate(t: ProposalTemplate) {
        const updated = t.id && templates.find(x => x.id === t.id)
            ? templates.map(x => x.id === t.id ? t : x)
            : [...templates, { ...t, id: `tpl_${Date.now()}` }];
        setTemplates(updated);
        saveTemplates(updated);
        setEditingTemplate(null);
    }
    function handleDeleteTemplate(id: string) {
        const updated = templates.filter(x => x.id !== id);
        setTemplates(updated);
        saveTemplates(updated);
        if (proposalType === id) setProposalType("custom");
    }
    function handleSaveCurrentAsTemplate() {
        setEditingTemplate({
            id: "", label: "", desc: "",
            fidelidade, adesao: maqAdesao > 0, cancelDias: 7,
            defaultRates: { ...brandRates },
            defaultEnabledBrands: ACTIVE_BRANDS,
            defaultRavAuto: ravAuto, defaultRavPontual: ravPontual,
            defaultRavTipo: ravTipo, defaultRavTiming: ravTiming,
            defaultPixRate: pixRate,
            defaultMachines: machines, defaultRental: rental,
            defaultMaqAdesao: maqAdesao, defaultAdesaoValor: adesaoValor,
        });
        setShowTemplateManager(true);
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
                if (d.adesaoValor !== undefined) setAdesaoValor(d.adesaoValor);
                if (d.adesaoParc !== undefined) setAdesaoParc(d.adesaoParc);
            }
        } catch { /* */ }
    }, []);

    // Save
    const save = useCallback(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientName, proposalType, brandRates, enabledBrands, activeBrand, ravAuto, ravPontual, ravTipo, ravTiming, pixRate, tpv, machines, rental, fidelidade, maqAdesao, adesaoValor, adesaoParc })); } catch { /* */ }
    }, [clientName, proposalType, brandRates, enabledBrands, activeBrand, ravAuto, ravPontual, ravTipo, ravTiming, pixRate, tpv, machines, rental, fidelidade, maqAdesao, adesaoValor, adesaoParc]);
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
        if (cet < 5) return "text-[#00A868]";
        if (cet < 10) return "text-amber-500";
        return "text-red-500";
    }

    function getCETBg(cet: number): string {
        if (cet < 5) return "bg-[#00A868]/10";
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
        const ravLabel = ravTipo === "pontual" ? "Pontual" : `Auto ${ravTiming === "md" ? "M.Dia" : ravTiming === "ds" ? "D.Seg" : "D.Úteis"}`;
        const brandCount = ACTIVE_BRANDS.length;
        const gridCols = Math.min(brandCount, 2);

        let html = `<html><head><title>CET ${clientName || "Stone"}</title>
<style>
@page{size:landscape;margin:6mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#333;padding:4px 8px}
.header{text-align:center;border-bottom:2px solid #00a868;padding-bottom:4px;margin-bottom:6px}
.header h1{font-size:18px;color:#00a868;margin:0 0 2px;font-weight:800;letter-spacing:0.5px}
.badges{display:flex;justify-content:center;gap:4px;flex-wrap:wrap}
.promo-badge,.fidelidade-badge{display:inline-block;font-size:9px;padding:2px 8px;border-radius:3px}
.promo-badge{background:#fff3cd;color:#856404;border:1px solid #ffc107}
.fidelidade-badge{background:#e3f2fd;color:#1565c0;border:1px solid #42a5f5}
.summary-bar{display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.sum-card{flex:1;min-width:140px;border:1px solid #ddd;border-radius:4px;padding:4px 8px}
.sum-card h4{font-size:8px;font-weight:700;text-transform:uppercase;color:#00a868;margin-bottom:2px;letter-spacing:0.4px}
.sum-row{display:flex;justify-content:space-between;font-size:10px;padding:1px 0}
.sum-row .l{color:#888;font-size:9px}
.sum-row .v{font-weight:700;color:#222;font-size:10px}
.brand-grid{display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:6px}
.brand-card{border:1px solid #ddd;border-radius:5px;overflow:hidden;break-inside:avoid}
.brand-hdr{display:flex;justify-content:space-between;align-items:center;padding:3px 8px;background:linear-gradient(90deg,#e8f5e9,#f0fdf4);border-bottom:1px solid #c8e6c9}
.brand-hdr h4{font-size:11px;font-weight:700;color:#2e7d32;margin:0}
.brand-hdr .deb{font-size:9px;color:#666}
.brand-hdr .deb b{color:#333}
.split{display:grid;grid-template-columns:1fr 1fr}
.split>div{border-right:1px solid #eee}
.split>div:last-child{border-right:none}
table{width:100%;border-collapse:collapse}
th{padding:2px 4px;font-weight:600;color:#555;font-size:8px;border-bottom:1px solid #e0e0e0;background:#fafafa;text-transform:uppercase}
td{padding:1.5px 4px;border-bottom:1px solid #f5f5f5;font-size:10px}
tr:nth-child(even){background:#fafafa}
.green{color:#059669}.amber{color:#d97706}.red{color:#dc2626}
.footer{font-size:8px;color:#aaa;margin-top:4px;border-top:1px solid #eee;padding-top:2px;display:flex;justify-content:space-between}
</style></head><body>`;

        // Header
        html += `<div class="header"><h1>PROPOSTA STONE${clientName ? " \u2014 " + clientName.toUpperCase() : ""}</h1><div class="badges">`;
        if (proposalType !== "custom") html += `<span class="promo-badge">${promoInfo?.label}</span>`;
        if (fidelidade) html += `<span class="fidelidade-badge">FIDELIDADE 13 MESES</span>`;
        html += `</div></div>`;

        // Summary bar — horizontal compact cards
        html += `<div class="summary-bar">`;

        // Taxas resumo inline
        html += `<div class="sum-card">`;
        html += `<h4>Taxas por Bandeira</h4>`;
        ACTIVE_BRANDS.forEach(name => {
            const r = brandRates[name];
            html += `<div class="sum-row"><span class="l">${name}</span><span class="v">D\u00e9b ${formatPercent(r.debit)} \u00b7 1x ${formatPercent(r.credit1x)} \u00b7 2-6x ${formatPercent(r.credit2to6)} \u00b7 7-12x ${formatPercent(r.credit7to12)}</span></div>`;
        });
        html += `</div>`;

        // RAV + PIX + Máquinas inline
        html += `<div class="sum-card"><h4>RAV &amp; PIX &amp; M\u00e1quinas</h4>`;
        html += `<div class="sum-row"><span class="l">RAV</span><span class="v">${ravLabel} ${formatPercent(ravAuto)}</span></div>`;
        html += `<div class="sum-row"><span class="l">PIX</span><span class="v">${formatPercent(pixRate)}</span></div>`;
        html += `<div class="sum-row"><span class="l">TPV</span><span class="v">R$ ${tpv.toLocaleString("pt-BR")}</span></div>`;
        html += `<div class="sum-row"><span class="l">M\u00e1q.</span><span class="v">${totalMaqPdf} (IPV: ${Math.min(ipvPdf, machines)})</span></div>`;
        if (maqAdesao > 0) html += `<div class="sum-row"><span class="l">Ades\u00e3o</span><span class="v" style="color:#1565c0">${maqAdesao} (R$ ${adesaoCustoPdf.toFixed(2)})</span></div>`;
        if (paidPdf > 0) html += `<div class="sum-row"><span class="l">Aluguel</span><span class="v" style="color:#d97706">R$ ${(paidPdf * rental).toFixed(2)}/m\u00eas</span></div>`;
        else html += `<div class="sum-row"><span class="l">Aluguel</span><span class="v" style="color:#059669">ISENTO</span></div>`;
        html += `</div>`;
        html += `</div>`; // end summary-bar

        // CET tables — each brand has 2-column split (1-9x | 10-18x)
        html += `<div class="brand-grid">`;
        ACTIVE_BRANDS.forEach(name => {
            const rates = brandRates[name];
            html += `<div class="brand-card">`;
            html += `<div class="brand-hdr"><h4>${name}</h4><div class="deb">D\u00e9b: <b>${formatPercent(rates.debit)}</b></div></div>`;
            html += `<div class="split">`;
            // Left col: 1-9x
            html += `<div><table><tr><th style="text-align:left;width:28px">Parc</th><th style="text-align:right">MDR</th><th style="text-align:right">CET</th></tr>`;
            for (let i = 1; i <= 9; i++) {
                const mdr = getMDR(rates, i);
                const cet = calculateCET(mdr, rav, i);
                html += `<tr><td style="text-align:left;font-weight:600">${i}x</td><td style="text-align:right">${formatPercent(mdr)}</td><td style="text-align:right;font-weight:700" class="${cet < 5 ? 'green' : cet < 10 ? 'amber' : 'red'}">${formatPercent(cet)}</td></tr>`;
            }
            html += `</table></div>`;
            // Right col: 10-18x
            html += `<div><table><tr><th style="text-align:left;width:28px">Parc</th><th style="text-align:right">MDR</th><th style="text-align:right">CET</th></tr>`;
            for (let i = 10; i <= 18; i++) {
                const mdr = getMDR(rates, i);
                const cet = calculateCET(mdr, rav, i);
                html += `<tr><td style="text-align:left;font-weight:600">${i}x</td><td style="text-align:right">${formatPercent(mdr)}</td><td style="text-align:right;font-weight:700" class="${cet < 5 ? 'green' : cet < 10 ? 'amber' : 'red'}">${formatPercent(cet)}</td></tr>`;
            }
            html += `</table></div>`;
            html += `</div></div>`; // end split + brand-card
        });
        html += `</div>`;

        html += `<div class="footer"><span>Gerado em ${new Date().toLocaleDateString("pt-BR")} \u2014 BitTask</span><span>${ravTipo === "pontual" ? "CET = MDR (sem antecipa\u00e7\u00e3o)" : `CET = MDR + RAV ${formatPercent(ravAuto)}`}</span></div>`;
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

    // Collapsible state for mobile
    const [openSection, setOpenSection] = useState<string>("taxas");
    const toggleSection = (s: string) => setOpenSection(openSection === s ? "" : s);

    return (
        <div className="max-w-7xl mx-auto space-y-3 pb-20 lg:pb-4">
            {/* Header */}
            <div className="card-elevated p-3 sm:p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00A868]/10 border border-[#00A868]/10 flex items-center justify-center shrink-0">
                        <span className="text-[#00A868] text-sm font-black">CET</span>
                    </div>
                    <div className="flex-1 min-w-0 relative">
                        <div className="flex items-center gap-2">
                            <input type="text" value={clientName}
                                onChange={(e) => { setClientName(e.target.value); setShowSuggestions(e.target.value.length >= 1); }}
                                onFocus={() => { if (clientName.length >= 1) setShowSuggestions(true); }}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                                placeholder="Nome da Empresa / Cliente"
                                className="flex-1 text-base sm:text-lg font-bold bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0" />
                            <button type="button"
                                onMouseDown={(e) => { e.preventDefault(); setShowSuggestions(!showSuggestions); }}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[10px] sm:text-xs font-bold transition-colors border border-blue-500/20"
                                title="Selecionar cliente da carteira">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                <span className="hidden sm:inline">Carteira</span>
                            </button>
                        </div>
                        {showSuggestions && (() => {
                            const query = clientName.toLowerCase();
                            const filtered = query.length >= 1
                                ? clientSuggestions.filter(c => c.name.toLowerCase().includes(query)).slice(0, 8)
                                : clientSuggestions.slice(0, 8);
                            return filtered.length > 0 ? (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-[280px] overflow-y-auto">
                                    <div className="px-3 py-1.5 bg-muted/30 border-b border-border/50">
                                        <p className="text-[9px] text-muted-foreground font-semibold uppercase">Selecionar cliente da carteira ({clientSuggestions.length})</p>
                                    </div>
                                    {filtered.map(c => (
                                        <button key={c.id} type="button"
                                            onMouseDown={(e) => { e.preventDefault(); selectClient(c); }}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left border-b border-border/10 last:border-none">
                                            <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 text-[#00A868] flex items-center justify-center text-xs font-bold shrink-0">{c.name.charAt(0)}</div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                                                {c.cnpj && <p className="text-[10px] text-muted-foreground">{c.cnpj}</p>}
                                            </div>
                                            {c.negotiations?.length > 0 && (
                                                <span className="text-[9px] bg-[#00A868]/10 text-[#00A868] px-2 py-0.5 rounded-full font-bold shrink-0">Preencher taxas</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : clientName.length >= 1 ? (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl p-4 text-center">
                                    <p className="text-xs text-muted-foreground">Nenhum cliente encontrado para &quot;{clientName}&quot;</p>
                                </div>
                            ) : null;
                        })()}
                        <p className="text-[10px] text-muted-foreground">Custo Efetivo Total por parcela e bandeira</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    <button onClick={shareWhatsApp} className="flex items-center justify-center gap-1 px-2 py-2 text-[10px] sm:text-xs rounded-lg bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 font-bold transition-colors">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                        <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                    <button onClick={exportPDF} className="flex items-center justify-center gap-1 px-2 py-2 text-[10px] sm:text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-colors">PDF</button>
                    <button onClick={exportExcel} className="flex items-center justify-center gap-1 px-2 py-2 text-[10px] sm:text-xs rounded-lg bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 font-bold transition-colors">Excel</button>
                    <button onClick={handleReset} className="flex items-center justify-center gap-1 px-2 py-2 text-[10px] sm:text-xs rounded-lg bg-secondary text-muted-foreground hover:bg-muted font-bold transition-colors">Reset</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* LEFT — Config (Accordion mobile) */}
                <div className="lg:col-span-4 space-y-2">

                    {/* Proposal Type */}
                    <div className="card-elevated rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection("proposta")} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors lg:pointer-events-none">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                <span className="text-[11px] font-bold text-foreground uppercase">Perfil de Proposta</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-purple-400 font-medium truncate max-w-[120px]">{promoInfo?.label}</span>
                                <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform lg:hidden ${openSection === "proposta" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        <div className={`px-3 pb-3 space-y-2 border-t border-border/30 ${openSection === "proposta" ? "block" : "hidden lg:block"}`}>
                            <select value={proposalType} onChange={(e) => handleProposalChange(e.target.value)}
                                className="w-full mt-2 px-2.5 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs font-medium focus:ring-1 focus:ring-purple-500">
                                {templates.map((p: ProposalTemplate) => (<option key={p.id} value={p.id}>{p.label}</option>))}
                            </select>
                            {promoInfo && proposalType !== "custom" && (
                                <p className="text-[11px] text-purple-400 bg-purple-500/10 rounded-lg px-2.5 py-1.5">{promoInfo.desc}</p>
                            )}
                            <div className="flex gap-1.5 pt-1">
                                <button type="button" onClick={handleSaveCurrentAsTemplate}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold rounded-lg bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors border border-dashed border-purple-500/20">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    Salvar como Perfil
                                </button>
                                <button type="button" onClick={() => setShowTemplateManager(true)}
                                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Gerenciar
                                </button>
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                                <div className={`relative w-9 h-5 rounded-full transition-colors ${fidelidade ? 'bg-blue-500' : 'bg-secondary border border-border'}`}
                                    onClick={() => setFidelidade(!fidelidade)}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${fidelidade ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </div>
                                <span className="text-xs text-foreground font-medium">Termo de Fidelidade</span>
                            </label>
                            {fidelidade && <p className="text-[11px] text-blue-400 bg-blue-500/10 rounded-lg px-2.5 py-1.5">1º mês isento + 12 Meses = 13 Meses total</p>}
                        </div>
                    </div>

                    {/* Template Manager Modal */}
                    {showTemplateManager && (
                        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowTemplateManager(false); setEditingTemplate(null); }}>
                            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-foreground">{editingTemplate ? (editingTemplate.id ? "Editar Perfil" : "Novo Perfil de Proposta") : "Perfis de Proposta"}</h3>
                                    <button onClick={() => { setShowTemplateManager(false); setEditingTemplate(null); }} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:bg-muted">✕</button>
                                </div>

                                {editingTemplate ? (
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Nome do Perfil *</label>
                                            <input value={editingTemplate.label} onChange={e => setEditingTemplate({ ...editingTemplate, label: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Stone Essencial Pro" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Descrição</label>
                                            <textarea value={editingTemplate.desc} onChange={e => setEditingTemplate({ ...editingTemplate, desc: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs resize-none" rows={2} placeholder="Condições e regras do perfil..." />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" checked={editingTemplate.fidelidade} onChange={e => setEditingTemplate({ ...editingTemplate, fidelidade: e.target.checked })} className="rounded" />
                                                Fidelidade
                                            </label>
                                            <label className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" checked={editingTemplate.adesao} onChange={e => setEditingTemplate({ ...editingTemplate, adesao: e.target.checked })} className="rounded" />
                                                Adesão
                                            </label>
                                        </div>
                                        <div className="border-t border-border/30 pt-3">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Taxas Padrão (VISA/MASTER)</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[{l:"Déb",k:"debit"},{l:"1x",k:"credit1x"},{l:"2-6x",k:"credit2to6"},{l:"7-12x",k:"credit7to12"},{l:"13-18x",k:"credit13to18"}].map(({l,k}) => (
                                                    <div key={k}>
                                                        <label className="text-[9px] text-muted-foreground block mb-0.5">{l}</label>
                                                        <input type="number" step="0.01" value={editingTemplate.defaultRates?.["VISA/MASTER"]?.[k as keyof BrandRates] ?? 0}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                const curr = editingTemplate.defaultRates?.["VISA/MASTER"] || { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 };
                                                                setEditingTemplate({ ...editingTemplate, defaultRates: { ...editingTemplate.defaultRates, "VISA/MASTER": { ...curr, [k]: val } } });
                                                            }}
                                                            className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="border-t border-border/30 pt-3">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Configurações Padrão</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[9px] text-muted-foreground block mb-0.5">RAV Auto %</label>
                                                    <input type="number" step="0.01" value={editingTemplate.defaultRavAuto ?? 1.30}
                                                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultRavAuto: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-muted-foreground block mb-0.5">PIX %</label>
                                                    <input type="number" step="0.01" value={editingTemplate.defaultPixRate ?? 0}
                                                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultPixRate: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-muted-foreground block mb-0.5">Máquinas</label>
                                                    <input type="number" step="1" value={editingTemplate.defaultMachines ?? 1}
                                                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultMachines: parseInt(e.target.value) || 1 })}
                                                        className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-muted-foreground block mb-0.5">Aluguel R$</label>
                                                    <input type="number" step="0.01" value={editingTemplate.defaultRental ?? 99.90}
                                                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultRental: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-muted-foreground block mb-0.5">Adesão Qtd</label>
                                                    <input type="number" step="1" value={editingTemplate.defaultMaqAdesao ?? 0}
                                                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultMaqAdesao: parseInt(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-muted-foreground block mb-0.5">Adesão R$/un</label>
                                                    <input type="number" step="0.01" value={editingTemplate.defaultAdesaoValor ?? 478.80}
                                                        onChange={e => setEditingTemplate({ ...editingTemplate, defaultAdesaoValor: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs text-right" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={() => setEditingTemplate(null)} className="flex-1 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-xs font-bold hover:bg-muted">Cancelar</button>
                                            <button onClick={() => { if (editingTemplate.label.trim()) handleSaveTemplate(editingTemplate); }}
                                                disabled={!editingTemplate.label.trim()}
                                                className="flex-1 px-3 py-2 rounded-lg bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 disabled:opacity-50 transition-colors">Salvar Perfil</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 space-y-2">
                                        {templates.filter(t => t.id !== "custom").length === 0 ? (
                                            <div className="text-center py-6">
                                                <p className="text-sm text-muted-foreground">Nenhum perfil criado</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">Clique em &quot;Novo Perfil&quot; para criar um padrão de proposta</p>
                                            </div>
                                        ) : (
                                            templates.filter(t => t.id !== "custom").map(t => (
                                                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center text-xs font-bold shrink-0">{t.label.charAt(0)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{t.label}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{t.desc || "Sem descrição"}</p>
                                                    </div>
                                                    <button onClick={() => setEditingTemplate(t)} className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 transition-colors shrink-0" title="Editar">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteTemplate(t.id)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0" title="Excluir">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                        <button onClick={() => setEditingTemplate({ id: "", label: "", desc: "", fidelidade: false, adesao: false, cancelDias: 7 })}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors border border-dashed border-purple-500/20">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                            Novo Perfil
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TPV */}
                    <div className="card-elevated rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection("tpv")} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors lg:pointer-events-none">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                <span className="text-[11px] font-bold text-foreground uppercase">TPV Mensal</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-cyan-400 font-bold">R$ {tpv.toLocaleString("pt-BR")}</span>
                                {(() => { const ex = calculateExemptMachines(tpv); return ex > 0 ? <span className="text-[9px] text-[#00A868] font-bold bg-[#00A868]/10 px-1.5 py-0.5 rounded-full">{ex} isentas</span> : null; })()}
                                <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform lg:hidden ${openSection === "tpv" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        <div className={`px-3 pb-3 border-t border-border/30 ${openSection === "tpv" ? "block" : "hidden lg:block"}`}>
                            <div className="relative mt-2">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                <input type="number" min={0} step="1000" value={tpv || ''} onFocus={(e) => e.target.select()} onChange={(e) => setTpv(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-bold text-right focus:ring-1 focus:ring-cyan-500" />
                            </div>
                        </div>
                    </div>

                    {/* Brand Rates */}
                    <div className="card-elevated rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection("taxas")} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors lg:pointer-events-none">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#00A868]" />
                                <span className="text-[11px] font-bold text-foreground uppercase">Taxas por Bandeira</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[#00A868] font-medium">{ACTIVE_BRANDS.length} ativas</span>
                                <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform lg:hidden ${openSection === "taxas" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        <div className={`px-3 pb-3 border-t border-border/30 space-y-2 ${openSection === "taxas" ? "block" : "hidden lg:block"}`}>
                            {/* Mobile quick-toggle button */}
                            <button type="button" onClick={() => setShowBrandModal(true)}
                                className="w-full lg:hidden flex items-center justify-center gap-2 mt-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#00A868]/10 text-[#00A868] border border-dashed border-[#00A868]/30 hover:bg-[#00A868]/20 transition-colors">
                                Gerenciar Bandeiras ({ACTIVE_BRANDS.length}/{ALL_BRANDS.length})
                            </button>
                            {showBrandModal && (
                                <BrandSelectorModal
                                    brands={ALL_BRANDS}
                                    enabledBrands={enabledBrands}
                                    activeBrand={activeBrand}
                                    onToggle={(b, enabled) => {
                                        if (enabled) { setEnabledBrands({ ...enabledBrands, [b]: true }); }
                                        else { toggleBrand(b); }
                                    }}
                                    onSelect={setActiveBrand}
                                    onClose={() => setShowBrandModal(false)}
                                />
                            )}
                            {/* Brand Accordion */}
                            <div className="space-y-1.5 mt-2">
                                {ALL_BRANDS.map((b) => {
                                    const isEnabled = enabledBrands[b];
                                    const isSelected = activeBrand === b && isEnabled;
                                    const bRates = brandRates[b] || { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 };
                                    return (
                                        <div key={b} className={`rounded-xl transition-all overflow-hidden ${
                                            isSelected
                                                ? "bg-[#00A868]/5 border-2 border-[#00A868] shadow-sm shadow-[#00A868]/10"
                                                : isEnabled
                                                    ? "bg-[#00A868]/5 border border-[#00A868]/20"
                                                    : "bg-secondary/30 border border-border/50"
                                        }`}>
                                            <div className="flex items-center gap-0 px-1.5 py-1.5">
                                                {/* Toggle ✓/✗ */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleBrand(b);
                                                        if (!isEnabled) setActiveBrand(b);
                                                        else if (activeBrand === b) {
                                                            const next = ALL_BRANDS.find(k => k !== b && enabledBrands[k]);
                                                            if (next) setActiveBrand(next);
                                                        }
                                                    }}
                                                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold transition-all ${
                                                        isEnabled
                                                            ? "bg-[#00A868] text-white shadow-sm shadow-[#00A868]/30"
                                                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                                    }`}
                                                    title={isEnabled ? "Desativar bandeira" : "Ativar bandeira"}>
                                                    {isEnabled ? "✓" : "✗"}
                                                </button>

                                                {/* Brand info — click to expand */}
                                                <button
                                                    onClick={() => { if (isEnabled) setActiveBrand(isSelected ? "" : b); }}
                                                    className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${isEnabled ? "hover:bg-[#00A868]/5 cursor-pointer" : "cursor-default"}`}>
                                                    <BrandIcon brand={b} size={12} />
                                                    <span className={`text-xs font-bold truncate ${isEnabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>{b}</span>
                                                    {isEnabled && (
                                                        <span className="ml-auto text-[9px] text-muted-foreground">
                                                            {bRates.debit > 0 ? `Déb ${formatPercent(bRates.debit)}` : ""}
                                                            {bRates.credit1x > 0 ? ` · 1x ${formatPercent(bRates.credit1x)}` : ""}
                                                        </span>
                                                    )}
                                                </button>

                                                {/* Delete custom brand */}
                                                {!BRAND_PRESETS[b] && !isEnabled && (
                                                    <button onClick={() => {
                                                        const next = { ...brandRates }; delete next[b];
                                                        setBrandRates(next);
                                                        const ne = { ...enabledBrands }; delete ne[b];
                                                        setEnabledBrands(ne);
                                                        if (activeBrand === b) setActiveBrand(Object.keys(next)[0]);
                                                    }} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center text-xs hover:bg-red-500/20 transition-colors shrink-0">🗑</button>
                                                )}

                                                {/* Expand chevron */}
                                                {isEnabled && (
                                                    <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                )}
                                            </div>
                                            {/* Expanded rate fields */}
                                            {isSelected && (
                                                <div className="px-3 pb-3 pt-1 border-t border-[#00A868]/10 grid grid-cols-2 gap-1.5">
                                                    <RI l="DÉBITO" v={bRates.debit} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, debit: v } })} />
                                                    <RI l="CRÉD 1x" v={bRates.credit1x} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit1x: v } })} />
                                                    <RI l="2-6x" v={bRates.credit2to6} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit2to6: v } })} />
                                                    <RI l="7-12x" v={bRates.credit7to12} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit7to12: v } })} />
                                                    <RI l="13-18x" v={bRates.credit13to18} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit13to18: v } })} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Add Brand */}
                                {showNewBrand ? (
                                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-[#00A868]/5 border border-[#00A868]/20">
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
                                            placeholder="Nome da bandeira"
                                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-secondary border border-[#00A868]/30 text-foreground focus:ring-1 focus:ring-[#00A868]" />
                                        <button onClick={() => {
                                            const name = newBrandInput.trim();
                                            if (name && !brandRates[name]) {
                                                setBrandRates({ ...brandRates, [name]: { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 } });
                                                setEnabledBrands({ ...enabledBrands, [name]: true });
                                                setActiveBrand(name);
                                            }
                                            setNewBrandInput(""); setShowNewBrand(false);
                                        }} className="px-3 py-1.5 text-xs rounded-lg bg-[#00A868] text-white font-bold hover:bg-[#008f58] transition-colors">Salvar</button>
                                        <button onClick={() => { setNewBrandInput(""); setShowNewBrand(false); }}
                                            className="px-2 py-1.5 text-xs rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors">✕</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowNewBrand(true)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 transition-colors border border-dashed border-[#00A868]/20">
                                        <span className="text-sm">+</span> Adicionar Bandeira
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RAV */}
                    <div className="card-elevated rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection("rav")} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors lg:pointer-events-none">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-[11px] font-bold text-foreground uppercase">Antecipação (RAV)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-amber-400 font-medium">{ravTipo === "pontual" ? "Pontual" : `Auto ${formatPercent(ravAuto)}`}</span>
                                <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform lg:hidden ${openSection === "rav" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        <div className={`px-3 pb-3 border-t border-border/30 space-y-2 ${openSection === "rav" ? "block" : "hidden lg:block"}`}>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-bold">Tipo</label>
                                    <select value={ravTipo} onChange={(e) => setRavTipo(e.target.value as "automatico" | "pontual")}
                                        className="w-full px-2 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-1 focus:ring-amber-500">
                                        <option value="automatico">Automático</option>
                                        <option value="pontual">Pontual (CET=MDR)</option>
                                    </select>
                                </div>
                                {ravTipo === "automatico" && (
                                    <div>
                                        <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-bold">Recebimento</label>
                                        <select value={ravTiming} onChange={(e) => setRavTiming(e.target.value as "md" | "ds" | "du")}
                                            className="w-full px-2 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-1 focus:ring-amber-500">
                                            <option value="md">Mesmo Dia</option>
                                            <option value="ds">Dia Seguinte</option>
                                            <option value="du">Dias Úteis</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <RI l="RAV Auto" v={ravAuto} set={setRavAuto} />
                                <RI l="RAV Pontual" v={ravPontual} set={setRavPontual} />
                            </div>
                            {ravTipo === "pontual" && (
                                <p className="text-[11px] text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5">Sem antecipação — CET = apenas MDR</p>
                            )}
                        </div>
                    </div>

                    {/* PIX & Máquinas */}
                    <div className="card-elevated rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection("pix")} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors lg:pointer-events-none">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[11px] font-bold text-foreground uppercase">PIX & Máquinas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-blue-400 font-medium">{machines} máq. | PIX {formatPercent(pixRate)}</span>
                                <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform lg:hidden ${openSection === "pix" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        <div className={`px-3 pb-3 border-t border-border/30 space-y-2 ${openSection === "pix" ? "block" : "hidden lg:block"}`}>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <RI l="PIX" v={pixRate} set={setPixRate} />
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-bold">Aluguel/máq (R$)</label>
                                    <input type="number" min={0} step="0.01" value={rental || ''} onFocus={(e) => e.target.select()} onChange={(e) => setRental(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-bold text-right focus:ring-1 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-bold">Máquinas</label>
                                    <input type="number" min={1} value={machines} onFocus={(e) => e.target.select()} onChange={(e) => setMachines(parseInt(e.target.value) || 1)}
                                        className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-bold text-right focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-bold">Qtd. Adesão</label>
                                    <input type="number" min={0} value={maqAdesao || ''} onFocus={(e) => e.target.select()} onChange={(e) => setMaqAdesao(parseInt(e.target.value) || 0)}
                                        className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-bold text-right focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase block mb-1 font-bold">Valor Adesão (R$/un)</label>
                                    <input type="number" min={0} step={0.01} value={adesaoValor || ''} onFocus={(e) => e.target.select()} onChange={(e) => setAdesaoValor(parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-bold text-right focus:ring-1 focus:ring-blue-500" />
                                </div>
                            </div>
                            {(() => {
                                const ipv = calculateExemptMachines(tpv);
                                const paidProposta = Math.max(0, machines - ipv);
                                const totalRental = paidProposta * rental;
                                const adesaoCusto = maqAdesao * adesaoValor;
                                const totalMaq = machines + maqAdesao;
                                return (
                                    <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">Total máquinas:</span>
                                            <span className="font-bold text-foreground">{totalMaq} ({machines} proposta{maqAdesao > 0 ? ` + ${maqAdesao} adesão` : ''})</span>
                                        </div>
                                        {ipv > 0 && (
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground">IPV (isentas volume):</span>
                                                <span className="font-bold text-[#00A868]">{Math.min(ipv, machines)} de {machines}</span>
                                            </div>
                                        )}
                                        {maqAdesao > 0 && (
                                            <>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-muted-foreground">Adesão (vitalícia):</span>
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
                                            <p className="text-[11px] text-[#00A868] font-medium">✓ Todas isentas pelo IPV</p>
                                        ) : null}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground px-1 py-1">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#00A868]/20" /> &lt;5% Seguro</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500/20" /> 5-10% Atenção</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/20" /> &gt;10% Alto</span>
                    </div>
                </div>

                {/* RIGHT — CET Tables */}
                <div className="lg:col-span-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ACTIVE_BRANDS.length === 0 && (
                            <div className="card-elevated rounded-xl p-8 text-center text-muted-foreground col-span-full">
                                <p className="text-sm">Nenhuma bandeira ativa</p>
                                <p className="text-xs mt-1">Ative as bandeiras usando os toggles à esquerda</p>
                            </div>
                        )}
                        {ACTIVE_BRANDS.map((name) => {
                            const rates = brandRates[name];
                            return (
                                <div key={name} className="card-elevated rounded-xl overflow-hidden">
                                    {/* Brand Header */}
                                    <div className="px-3 py-2.5 bg-gradient-to-r from-[#00A868]/10 to-transparent border-b border-border/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden">
                                                <BrandIcon brand={name} size={18} />
                                            </div>
                                            <h3 className="text-xs font-bold text-foreground">{name}</h3>
                                        </div>
                                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-md font-bold text-foreground">Déb: {formatPercent(rates.debit)}</span>
                                    </div>
                                    {/* CET Table — 2 Column Layout */}
                                    <div className="grid grid-cols-2 divide-x divide-border/30">
                                        {[{ start: 1, end: 9 }, { start: 10, end: 18 }].map(({ start, end }) => (
                                            <div key={start} className="overflow-x-auto">
                                                <table className="w-full border-collapse text-[11px]">
                                                    <thead>
                                                        <tr className="bg-muted/40">
                                                            <th className="text-[9px] text-muted-foreground font-bold px-2 py-1.5 text-left w-10">Parc.</th>
                                                            <th className="text-[9px] text-muted-foreground font-bold px-2 py-1.5 text-right">MDR</th>
                                                            <th className="text-[9px] text-muted-foreground font-bold px-2 py-1.5 text-right">CET</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Array.from({ length: end - start + 1 }, (_, i) => {
                                                            const parcela = start + i;
                                                            const mdr = getMDR(rates, parcela);
                                                            const cet = calculateCET(mdr, rav, parcela);
                                                            const isRangeStart = parcela === 1 || parcela === 2 || parcela === 7 || parcela === 13 || parcela === 10;
                                                            const rangeLabel = parcela === 1 ? "À Vista" : parcela === 2 ? "2-6x" : parcela === 7 ? "7-12x" : parcela === 13 ? "13-18x" : null;
                                                            return (
                                                                <tr key={parcela} className={`transition-colors hover:bg-muted/30 ${
                                                                    isRangeStart ? "border-t-2 border-border/40" : "border-b border-border/5"
                                                                }`}>
                                                                    <td className="px-2 py-1 font-bold text-foreground">
                                                                        <div className="flex items-center gap-0.5">
                                                                            {parcela}x
                                                                            {rangeLabel && <span className="text-[7px] text-muted-foreground/60 font-medium">{rangeLabel}</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-2 py-1 text-foreground text-right font-medium tabular-nums">{formatPercent(mdr)}</td>
                                                                    <td className={`px-2 py-1 text-right font-black tabular-nums ${getCETColor(cet)}`}>
                                                                        <span className={`inline-flex items-center px-1 py-0.5 rounded-md text-[10px] ${getCETBg(cet)}`}>
                                                                            {formatPercent(cet)}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
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

