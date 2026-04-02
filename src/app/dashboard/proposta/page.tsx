"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    calculateCET,
    calculateExemptMachines,
    formatCurrency,
    formatPercent,
    COMPETITORS,
    getMDRForInstallment,
    BRAND_PRESETS,
    type BrandRates,
} from "@/lib/calculator";
import { exportPDF, exportExcel, type ProposalData } from "@/lib/exports";
import {
    ArrowRight,
    Check,
    Users,
    TrendingUp,
    Package,
    Truck,
    Palette,
    ShieldCheck,
    QrCode,
    Store,
    Crown,
    ChevronDown,
    MousePointer2,
    Calculator,
    Smartphone,
    FileText,
    FileSpreadsheet,
    RefreshCcw,
    User,
    Wallet,
    Percent,
    SmartphoneNfc,
    FileSignature,
    TrendingDown,
    Activity
} from "lucide-react";
import { RI } from "@/components/rate-input";
import { DocumentInput } from "@/components/DocumentInput";
import { PhoneInput } from "@/components/PhoneInput";
import { BrandIcon } from "@/components/BrandIcons";

const STORAGE_KEY = "bitkaiser_proposta_v2";
const CRM_STORAGE_KEY = "bitkaiser_negociacoes";

interface CompRates { debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number }
interface MachineConfig { quantity: number; rental: number }

export default function PropostaPage() {
    // Client
    const [nome, setNome] = useState("");
    const [cnpj, setCnpj] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    // Volume R$
    const [vDeb, setVDeb] = useState(30000);
    const [vCred, setVCred] = useState(55000);
    const [vPix, setVPix] = useState(15000);

    // Stone — multi-brand
    const DEFAULT_BRANDS = ["VISA/MASTER", "ELO"];
    const [brandRates, setBrandRates] = useState<Record<string, BrandRates>>(() => {
        const filtered: Record<string, BrandRates> = {};
        DEFAULT_BRANDS.forEach(b => { if (BRAND_PRESETS[b]) filtered[b] = { ...BRAND_PRESETS[b] }; });
        return filtered;
    });
    const BRANDS = Object.keys(brandRates);
    const [activeBrand, setActiveBrand] = useState("VISA/MASTER");
    const sr = brandRates[activeBrand] || BRAND_PRESETS["VISA/MASTER"];
    const setSR = (fnOrVal: ((prev: BrandRates) => BrandRates) | BrandRates) => {
        setBrandRates((prev) => ({
            ...prev,
            [activeBrand]: typeof fnOrVal === "function" ? fnOrVal(prev[activeBrand]) : fnOrVal,
        }));
    };
    const [ravRate, setRavRate] = useState(1.30);
    const [ravPontual, setRavPontual] = useState(3.79);
    const [ravTipo, setRavTipo] = useState<"automatico" | "pontual">("automatico");
    const [ravTiming, setRavTiming] = useState<"md" | "ds" | "du">("md");
    const rav = ravTipo === "pontual" ? 0 : ravRate;
    const [pixR, setPixR] = useState(0.00);
    const [sMach, setSMach] = useState<MachineConfig>({ quantity: 1, rental: 0 });

    // Competitor
    const [compId, setCompId] = useState("rede");
    const [cr, setCR] = useState<CompRates>({ debit: 1.39, credit1x: 2.69, credit2to6: 3.15, credit7to12: 3.79, pix: 0.99, rav: 1.99 });
    const [cMach, setCMach] = useState<MachineConfig>({ quantity: 1, rental: 0 });
    const [cExempt, setCExempt] = useState(0);

    // Agreement
    const [agreement, setAgreement] = useState<"fidelidade" | "adesao">("fidelidade");
    const [fidMonths, setFidMonths] = useState(13);
    const [metaTPV, setMetaTPV] = useState(50000);
    const [manualExempt, setManualExempt] = useState(false);
    const [adesaoQty, setAdesaoQty] = useState(1);

    // CRM search
    const [crmResults, setCrmResults] = useState<{ name: string; stoneCode: string; cnpj: string; phone: string; email: string }[]>([]);
    const [showCrm, setShowCrm] = useState(false);
    const [newBrandInput, setNewBrandInput] = useState("");
    const [showNewBrand, setShowNewBrand] = useState(false);

    // Derived
    const tpv = vDeb + vCred + vPix;
    const sDeb = tpv > 0 ? (vDeb / tpv) * 100 : 0;
    const sCred = tpv > 0 ? (vCred / tpv) * 100 : 0;
    const sPix = tpv > 0 ? (vPix / tpv) * 100 : 0;

    const comp = COMPETITORS.find((c) => c.id === compId) || COMPETITORS[0];

    // Stone costs
    const sDebitCost = (vDeb * sr.debit) / 100;
    const sAvgCET = (calculateCET(sr.credit1x, rav, 1) + calculateCET(sr.credit2to6, rav, 6) + calculateCET(sr.credit7to12, rav, 12)) / 3;
    const sCreditCost = (vCred * sAvgCET) / 100;
    const sPixCost = (vPix * pixR) / 100;
    const sFeeTot = sDebitCost + sCreditCost + sPixCost;

    // Competitor costs
    const cDebitCost = (vDeb * cr.debit) / 100;
    const cAvgCET = (calculateCET(cr.credit1x, cr.rav, 1) + calculateCET(cr.credit2to6, cr.rav, 6) + calculateCET(cr.credit7to12, cr.rav, 12)) / 3;
    const cCreditCost = (vCred * cAvgCET) / 100;
    const cPixCost = (vPix * cr.pix) / 100;
    const cFeeTot = cDebitCost + cCreditCost + cPixCost;

    // IPV Stone
    const sExempt = calculateExemptMachines(tpv);
    const sPaid = Math.max(0, sMach.quantity - sExempt);
    const sRental = agreement === "adesao" ? 0 : (manualExempt ? 0 : sPaid * sMach.rental);
    // IPV Comp
    const cPaid = Math.max(0, cMach.quantity - cExempt);
    const cRental = cPaid * cMach.rental;

    const sTot = sFeeTot + sRental;
    const cTot = cFeeTot + cRental;
    const economy = cTot - sTot;

    // CET table
    const cetTable = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => {
            const mdr = getMDRForInstallment(sr, i + 1);
            return { inst: i + 1, cet: calculateCET(mdr, rav, i + 1) };
        }), [sr, rav]);

    // Load
    useEffect(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            if (s) {
                const d = JSON.parse(s);
                if (d.nome) setNome(d.nome); if (d.cnpj) setCnpj(d.cnpj);
                if (d.phone) setPhone(d.phone); if (d.email) setEmail(d.email);
                if (d.vDeb !== undefined) setVDeb(d.vDeb); if (d.vCred !== undefined) setVCred(d.vCred); if (d.vPix !== undefined) setVPix(d.vPix);
                if (d.sr) setSR(d.sr);
                if (d.ravRate !== undefined) setRavRate(d.ravRate);
                if (d.ravPontual !== undefined) setRavPontual(d.ravPontual);
                if (d.ravTipo) setRavTipo(d.ravTipo);
                if (d.ravTiming) setRavTiming(d.ravTiming);
                if (d.rav !== undefined && d.ravRate === undefined) setRavRate(d.rav); // migrate
                if (d.ravMD !== undefined && d.ravRate === undefined) setRavRate(d.ravMD); // migrate v2
                if (d.pixR !== undefined) setPixR(d.pixR);
                if (d.sMach) setSMach(d.sMach); if (d.compId) setCompId(d.compId);
                if (d.cr) setCR(d.cr); if (d.cMach) setCMach(d.cMach);
                if (d.cExempt !== undefined) setCExempt(d.cExempt);
                if (d.agreement) setAgreement(d.agreement); if (d.fidMonths) setFidMonths(d.fidMonths);
                if (d.metaTPV) setMetaTPV(d.metaTPV); if (d.manualExempt !== undefined) setManualExempt(d.manualExempt);
                if (d.adesaoQty !== undefined) setAdesaoQty(d.adesaoQty);
            }
        } catch { /* */ }
    }, []);

    // Save
    const save = useCallback(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ nome, cnpj, phone, email, vDeb, vCred, vPix, sr, ravRate, ravPontual, ravTipo, ravTiming, pixR, sMach, compId, cr, cMach, cExempt, agreement, fidMonths, metaTPV, manualExempt, adesaoQty })); } catch { /* */ }
    }, [nome, cnpj, phone, email, vDeb, vCred, vPix, sr, ravRate, ravPontual, ravTipo, ravTiming, pixR, sMach, compId, cr, cMach, cExempt, agreement, fidMonths, metaTPV, manualExempt, adesaoQty]);
    useEffect(() => { save(); }, [save]);

    // CRM Search
    function searchCRM(query: string) {
        setNome(query);
        if (query.length < 2) { setCrmResults([]); setShowCrm(false); return; }
        try {
            const raw = localStorage.getItem(CRM_STORAGE_KEY);
            if (raw) {
                const clients = JSON.parse(raw);
                const results = clients.filter((c: { name: string; stoneCode: string; cnpj: string }) =>
                    c.name.toLowerCase().includes(query.toLowerCase()) || c.stoneCode.includes(query) || c.cnpj.includes(query)
                ).slice(0, 5);
                setCrmResults(results);
                setShowCrm(results.length > 0);
            }
        } catch { /* */ }
    }

    function selectCRM(c: { name: string; stoneCode: string; cnpj: string; phone: string; email: string }) {
        setNome(c.name); setCnpj(c.cnpj); setPhone(c.phone || ""); setEmail(c.email || "");
        setShowCrm(false); setCrmResults([]);
    }

    function handleReset() {
        localStorage.removeItem(STORAGE_KEY);
        setNome(""); setCnpj(""); setPhone(""); setEmail("");
        setVDeb(30000); setVCred(55000); setVPix(15000);
        const defaultBrands: Record<string, BrandRates> = {};
        DEFAULT_BRANDS.forEach(b => { if (BRAND_PRESETS[b]) defaultBrands[b] = { ...BRAND_PRESETS[b] }; });
        setBrandRates(defaultBrands); setActiveBrand("VISA/MASTER");
        setRavRate(1.30); setRavPontual(3.79); setRavTipo("automatico"); setRavTiming("md"); setPixR(0); setSMach({ quantity: 1, rental: 0 });
        setCompId("rede"); setCR({ debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, pix: 0, rav: 0 });
        setCMach({ quantity: 1, rental: 0 }); setCExempt(0);
        setAgreement("fidelidade"); setFidMonths(13); setMetaTPV(50000); setManualExempt(false); setAdesaoQty(1);
    }

    function getExportData(): ProposalData {
        return {
            cliente: { nome, cnpj, telefone: phone, email },
            tpv, volDebit: vDeb, volCredit: vCred, volPix: vPix,
            shareDebit: sDeb, shareCredit: sCred, sharePix: sPix,
            stoneRates: sr, rav, pixRate: pixR,
            competitorName: comp.name, compRates: cr,
            stoneFee: sFeeTot, compFee: cFeeTot,
            stoneRental: sRental, compRental: cRental,
            stoneTotal: sTot, compTotal: cTot,
            economy, agreementType: agreement,
            machines: sMach.quantity,
            isExempt: sRental === 0,
        };
    }

    function shareWhatsApp() {
        const exemptInfo = sExempt > 0 ? ` (${sExempt} isentas por volume)` : "";
        const rentalInfo = sRental === 0 ? "ISENTO" : formatCurrency(sRental) + "/mes";
        const ravInfo = ravTipo === "pontual" ? "RAV Pontual (sem antecipacao)" : `RAV Automatico ${ravTiming === "md" ? "Mesmo Dia" : ravTiming === "ds" ? "Dia Seguinte" : "Dias Uteis"}: ${formatPercent(ravRate)}`;
        const lines = [
            `PROPOSTA STONE - ${nome || "Cliente"}`,
            cnpj ? `CNPJ: ${cnpj}` : "",
            `TPV: ${formatCurrency(tpv)}/mes`,
            "",
            `TAXAS STONE (${activeBrand}):`,
            `Deb: ${formatPercent(sr.debit)} | Cred 1x: ${formatPercent(sr.credit1x)} | 2-6x: ${formatPercent(sr.credit2to6)} | 7-12x: ${formatPercent(sr.credit7to12)}`,
            `PIX: ${formatPercent(pixR)}`,
            ravInfo,
            "",
            `MAQUINAS: ${sMach.quantity} unidade(s)${exemptInfo}`,
            `Aluguel: ${rentalInfo}`,
            "",
            `ECONOMIA vs ${comp.name}: ${formatCurrency(economy)}/mes | ${formatCurrency(economy * 12)}/ano`,
        ].filter(Boolean).join("\n");
        window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
    }

    // Rate Input — imported from shared component (prevents focus loss)

    return (
        <div className="max-w-[1400px] mx-auto space-y-3">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00A868] flex items-center justify-center shadow-lg shadow-[#00A868]/20 text-white">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Simulador de Proposta</h1>
                        <p className="text-sm text-muted-foreground">Stone vs {comp.name} — Comparação + Proposta unificada</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={shareWhatsApp} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors">
                        <Smartphone className="w-4 h-4" /> WhatsApp
                    </button>
                    <button onClick={() => exportPDF(getExportData())} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                        <FileText className="w-4 h-4" /> PDF
                    </button>
                    <button onClick={() => exportExcel(getExportData())} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 transition-colors">
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors">
                        <RefreshCcw className="w-4 h-4" /> Reset
                    </button>
                </div>
            </div>

            {/* ROW 1: Client + Volume + TPV */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Client — 5 cols */}
                <div className="md:col-span-5 card-elevated rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-[#00A868]" />
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Cliente</h3>
                    </div>
                    <div className="relative">
                        <input value={nome} onChange={(e) => searchCRM(e.target.value)} placeholder="Nome / Stone Code"
                            onFocus={() => nome.length >= 2 && crmResults.length > 0 && setShowCrm(true)}
                            className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-[#00A868]" />
                        {showCrm && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                                {crmResults.map((c, i) => (
                                    <button key={i} onClick={() => selectCRM(c)} className="w-full px-3 py-2 text-left text-xs hover:bg-[#00A868]/10 transition-colors border-b border-border last:border-0">
                                        <span className="font-semibold text-foreground">{c.name}</span>
                                        {c.stoneCode && <span className="text-muted-foreground ml-2">SC: {c.stoneCode}</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <DocumentInput value={cnpj} onChange={setCnpj} compact placeholder="CPF ou CNPJ" />
                        <PhoneInput value={phone} onChange={setPhone} compact placeholder="Telefone" />
                        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail"
                            className="px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-[11px] placeholder:text-muted-foreground" />
                    </div>
                </div>

                {/* Volume — 5 cols */}
                <div className="md:col-span-5 card-elevated rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-[#00A868]" />
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Volume (R$)</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <select value={compId} onChange={(e) => setCompId(e.target.value)}
                                className="px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px]">
                                {COMPETITORS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[{ l: "Débito", v: vDeb, s: setVDeb, sh: sDeb }, { l: "Crédito", v: vCred, s: setVCred, sh: sCred }, { l: "PIX", v: vPix, s: setVPix, sh: sPix }].map(
                            (item) => (
                                <div key={item.l} className="text-center">
                                    <p className="text-[11px] text-muted-foreground uppercase">{item.l}</p>
                                    <div className="relative">
                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                        <input type="number" value={item.v} onChange={(e) => item.s(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-6 pr-1 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs font-bold text-right focus:ring-1 focus:ring-[#00A868]" />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5"><span className="font-semibold text-foreground">{item.sh.toFixed(1)}%</span></p>
                                </div>
                            ))}
                    </div>
                </div>

                {/* TPV Summary — 2 cols */}
                <div className="md:col-span-2 card-elevated rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <p className="text-[11px] text-muted-foreground uppercase">TPV Total</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(tpv)}</p>
                    <p className="text-[10px] text-muted-foreground">/mês</p>
                </div>
            </div>

            {/* ROW 2: Stone Rates + Competitor Rates + CET */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Stone Rates — multi-brand */}
                <div className="md:col-span-3 card-elevated rounded-xl p-4 border-[1px] border-[#00A868]/20">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00A868]" />
                            <h3 className="text-xs font-bold text-[#00A868] uppercase tracking-wider">Taxas por Bandeira</h3>
                        </div>
                        <span className="text-[10px] text-[#00A868] font-medium">{BRANDS.length} ativas</span>
                    </div>

                    <div className="space-y-1.5">
                        {Array.from(new Set([...Object.keys(BRAND_PRESETS), ...Object.keys(brandRates)])).map((b) => {
                            const isEnabled = !!brandRates[b];
                            const isSelected = activeBrand === b && isEnabled;
                            const bRates = brandRates[b] || BRAND_PRESETS[b] || { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 };
                            
                            return (
                                <div key={b} className={`rounded-xl transition-all overflow-hidden ${
                                    isSelected ? "bg-[#00A868]/5 border-2 border-[#00A868] shadow-sm shadow-[#00A868]/10"
                                        : isEnabled ? "bg-[#00A868]/5 border border-[#00A868]/20"
                                            : "bg-secondary/30 border border-border/50"
                                }`}>
                                    <div className="flex items-center gap-0 px-1.5 py-1.5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isEnabled) {
                                                    const next = { ...brandRates }; delete next[b];
                                                    setBrandRates(next);
                                                    if (activeBrand === b) { setActiveBrand(Object.keys(next)[0] || ""); }
                                                } else {
                                                    setBrandRates({ ...brandRates, [b]: BRAND_PRESETS[b] || { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 } });
                                                    setActiveBrand(b);
                                                }
                                            }}
                                            className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold transition-all mr-1.5 ${
                                                isEnabled ? "bg-[#00A868] text-white shadow-sm shadow-[#00A868]/30" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                            }`} title={isEnabled ? "Desativar" : "Ativar"}>
                                            {isEnabled ? "✓" : "✗"}
                                        </button>

                                        <button
                                            onClick={() => { if (isEnabled) setActiveBrand(isSelected ? "" : b); }}
                                            className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${isEnabled ? "hover:bg-[#00A868]/5 cursor-pointer" : "cursor-default"}`}>
                                            <BrandIcon brand={b} size={12} />
                                            <span className={`text-xs font-bold truncate ${isEnabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>{b}</span>
                                            {isEnabled && (
                                                <span className="ml-auto text-[9px] text-muted-foreground hidden lg:inline-block">
                                                    {bRates.debit > 0 ? `Déb ${formatPercent(bRates.debit)}` : ""}
                                                </span>
                                            )}
                                        </button>

                                        {!BRAND_PRESETS[b] && !isEnabled && (
                                            <button onClick={() => {
                                                const next = { ...brandRates }; delete next[b]; setBrandRates(next);
                                                if (activeBrand === b) setActiveBrand(Object.keys(next)[0] || "");
                                            }} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center text-xs hover:bg-red-500/20 transition-colors shrink-0">🗑</button>
                                        )}

                                        {isEnabled && (
                                            <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                        )}
                                    </div>

                                    {isSelected && (
                                        <div className="px-2 pb-2 pt-1 border-t border-[#00A868]/10 grid grid-cols-2 gap-1.5">
                                            <RI l="Debito" v={bRates.debit} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, debit: v } })} />
                                            <RI l="Cred 1x" v={bRates.credit1x} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit1x: v } })} />
                                            <RI l="2-6x" v={bRates.credit2to6} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit2to6: v } })} />
                                            <RI l="7-12x" v={bRates.credit7to12} set={(v) => setBrandRates({ ...brandRates, [b]: { ...bRates, credit7to12: v } })} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Add Brand */}
                        {showNewBrand ? (
                            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-[#00A868]/5 border border-[#00A868]/20 mt-2">
                                <input type="text" value={newBrandInput} autoFocus
                                    onChange={(e) => setNewBrandInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newBrandInput.trim()) {
                                            const name = newBrandInput.trim();
                                            if (!brandRates[name]) {
                                                setBrandRates({ ...brandRates, [name]: { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 } });
                                                setActiveBrand(name);
                                            }
                                            setNewBrandInput(""); setShowNewBrand(false);
                                        }
                                        if (e.key === "Escape") { setNewBrandInput(""); setShowNewBrand(false); }
                                    }}
                                    placeholder="Nome (Ex: SOROCRED)"
                                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-secondary border border-[#00A868]/30 text-foreground focus:ring-1 focus:ring-[#00A868]" />
                                <button onClick={() => {
                                    const name = newBrandInput.trim();
                                    if (name && !brandRates[name]) {
                                        setBrandRates({ ...brandRates, [name]: { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0, credit13to18: 0 } });
                                        setActiveBrand(name);
                                    }
                                    setNewBrandInput(""); setShowNewBrand(false);
                                }} className="px-3 py-1.5 text-xs rounded-lg bg-[#00A868] text-white font-bold hover:bg-[#008f58] transition-colors">OK</button>
                                <button onClick={() => { setNewBrandInput(""); setShowNewBrand(false); }}
                                    className="px-2 py-1.5 text-xs rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors">✕</button>
                            </div>
                        ) : (
                            <button onClick={() => setShowNewBrand(true)}
                                className="w-full flex items-center justify-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 transition-colors border border-dashed border-[#00A868]/20">
                                <span className="text-sm">+</span> Adicionar Personalizada
                            </button>
                        )}
                    </div>

                    {/* PIX + RAV — separados das bandeiras */}
                    <div className="mt-4 pt-3 border-t border-border">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">PIX & RAV (todas bandeiras)</h4>
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                            <RI l="PIX" v={pixR} set={setPixR} />
                            <div>
                                <label className="text-[11px] text-muted-foreground uppercase block mb-px">Tipo RAV</label>
                                <select value={ravTipo} onChange={(e) => setRavTipo(e.target.value as "automatico" | "pontual")}
                                    className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] focus:ring-1 focus:ring-[#00A868]">
                                    <option value="automatico">Automatico</option>
                                    <option value="pontual">Pontual (sem CET)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            <RI l="RAV Auto" v={ravRate} set={setRavRate} />
                            <RI l="RAV Pontual" v={ravPontual} set={setRavPontual} />
                            {ravTipo === "automatico" ? (
                                <div>
                                    <label className="text-[11px] text-muted-foreground uppercase block mb-px">Recebimento</label>
                                    <select value={ravTiming} onChange={(e) => setRavTiming(e.target.value as "md" | "ds" | "du")}
                                        className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] focus:ring-1 focus:ring-[#00A868]">
                                        <option value="md">Mesmo Dia</option>
                                        <option value="ds">Dia Seguinte</option>
                                        <option value="du">Dias Uteis</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="flex items-end">
                                    <p className="text-[11px] text-amber-400 bg-amber-500/10 rounded-md px-2 py-1">Sem antecipacao</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Competitor Rates — 3 cols */}
                <div className="md:col-span-3 card-elevated rounded-xl p-4 border-[1px]" style={{ borderColor: comp.color + '30' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Percent className="w-4 h-4" style={{ color: comp.color }} />
                        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: comp.color }}>Taxas {comp.name}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        <RI l="Débito" v={cr.debit} set={(v) => setCR((p) => ({ ...p, debit: v }))} />
                        <RI l="Créd 1x" v={cr.credit1x} set={(v) => setCR((p) => ({ ...p, credit1x: v }))} />
                        <RI l="2-6x" v={cr.credit2to6} set={(v) => setCR((p) => ({ ...p, credit2to6: v }))} />
                        <RI l="7-12x" v={cr.credit7to12} set={(v) => setCR((p) => ({ ...p, credit7to12: v }))} />
                        <RI l="PIX" v={cr.pix} set={(v) => setCR((p) => ({ ...p, pix: v }))} />
                        <RI l="RAV" v={cr.rav} set={(v) => setCR((p) => ({ ...p, rav: v }))} />
                    </div>
                </div>

                {/* CET Grid — 6 cols */}
                <div className="md:col-span-6 card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-foreground" />
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">CET Stone — {activeBrand} (1x-12x)</h3>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                        {cetTable.map(({ inst, cet }) => {
                            const color = cet < 5 ? "text-[#00A868]" : cet < 10 ? "text-amber-500" : "text-red-500";
                            const bg = cet < 5 ? "bg-[#00A868]/10" : cet < 10 ? "bg-amber-500/10" : "bg-red-500/10";
                            return (
                                <div key={inst} className={`p-1 rounded text-center ${bg}`}>
                                    <p className="text-[11px] text-muted-foreground">{inst}x</p>
                                    <p className={`text-[11px] font-bold ${color}`}>{formatPercent(cet)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ROW 3: Machines + IPV + Agreement + Diff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
                {/* Machines Stone */}
                <div className="md:col-span-3 card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <SmartphoneNfc className="w-4 h-4 text-[#00A868]" />
                        <h3 className="text-xs font-bold text-[#00A868] uppercase tracking-wider">Máquinas Stone</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        <div>
                            <label className="text-[11px] text-muted-foreground uppercase block mb-px">Qtd</label>
                            <input type="number" value={sMach.quantity} onChange={(e) => setSMach((p) => ({ ...p, quantity: parseInt(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-xs text-center" />
                        </div>
                        <div>
                            <label className="text-[11px] text-muted-foreground uppercase block mb-px">Aluguel</label>
                            <div className="relative">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">R$</span>
                                <input type="number" step="0.01" value={sMach.rental} onChange={(e) => setSMach((p) => ({ ...p, rental: parseFloat(e.target.value) || 0 }))}
                                    className="w-full pl-5 pr-1 py-1 rounded-md bg-secondary border border-border text-foreground text-xs text-right" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between text-[10px] mt-2 pt-1.5 border-t border-border">
                        <span className="text-muted-foreground">IPV: {sExempt} isenta(s)</span>
                        <span className={`font-bold ${sRental === 0 ? "text-[#00A868]" : "text-foreground"}`}>{sRental === 0 ? "✓ ISENTO" : formatCurrency(sRental) + "/mês"}</span>
                    </div>
                </div>

                {/* Machines Comp — 3 cols */}
                <div className="md:col-span-3 card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <SmartphoneNfc className="w-4 h-4" style={{ color: comp.color }} />
                        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: comp.color }}>Máquinas {comp.name}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        <div>
                            <label className="text-[11px] text-muted-foreground uppercase block mb-px">Qtd</label>
                            <input type="number" value={cMach.quantity} onChange={(e) => setCMach((p) => ({ ...p, quantity: parseInt(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-xs text-center" />
                        </div>
                        <div>
                            <label className="text-[11px] text-muted-foreground uppercase block mb-px">Aluguel</label>
                            <div className="relative">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">R$</span>
                                <input type="number" step="0.01" value={cMach.rental} onChange={(e) => setCMach((p) => ({ ...p, rental: parseFloat(e.target.value) || 0 }))}
                                    className="w-full pl-5 pr-1 py-1 rounded-md bg-secondary border border-border text-foreground text-xs text-right" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] text-muted-foreground uppercase block mb-px">Isentas</label>
                            <input type="number" min={0} value={cExempt} onChange={(e) => setCExempt(parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-xs text-center" />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 pt-1.5 border-t border-border text-right">
                        Efetivo: <span className="font-semibold text-foreground">{formatCurrency(cRental)}/mês</span>
                    </p>
                </div>

                {/* Agreement — 3 cols */}
                <div className="md:col-span-3 card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FileSignature className="w-4 h-4 text-foreground" />
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Acordo</h3>
                    </div>
                    <div className="flex gap-1 mb-2">
                        <button onClick={() => setAgreement("fidelidade")}
                            className={`flex-1 py-1 text-[10px] rounded-md font-medium ${agreement === "fidelidade" ? "bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/30" : "bg-secondary text-muted-foreground border border-border"}`}>
                            Fidelidade
                        </button>
                        <button onClick={() => setAgreement("adesao")}
                            className={`flex-1 py-1 text-[10px] rounded-md font-medium ${agreement === "adesao" ? "bg-[#00A868]/10 text-[#00A868] border border-blue-500/30" : "bg-secondary text-muted-foreground border border-border"}`}>
                            Adesão
                        </button>
                    </div>
                    {agreement === "fidelidade" ? (
                        <div className="space-y-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                    <label className="text-[11px] text-muted-foreground uppercase block mb-px">Meses</label>
                                    <select value={fidMonths} onChange={(e) => setFidMonths(parseInt(e.target.value))}
                                        className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px]">
                                        {[6, 12, 13, 24, 36].map((m) => <option key={m} value={m}>{m}m</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground uppercase block mb-px">Meta TPV</label>
                                    <div className="relative">
                                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                        <input type="number" value={metaTPV} onChange={(e) => setMetaTPV(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-5 pr-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] text-right" />
                                    </div>
                                </div>
                            </div>
                            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                                <input type="checkbox" checked={manualExempt} onChange={(e) => setManualExempt(e.target.checked)} className="rounded w-3 h-3" />
                                Isenção manual
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                    <label className="text-[11px] text-muted-foreground uppercase block mb-px">Qtd Máquinas</label>
                                    <input type="number" min={1} value={adesaoQty} onChange={(e) => setAdesaoQty(parseInt(e.target.value) || 1)}
                                        className="w-full px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] text-center" />
                                </div>
                                <div>
                                    <label className="text-[11px] text-muted-foreground uppercase block mb-px">Total Entrada</label>
                                    <div className="px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] text-center font-semibold">
                                        R$ {(478.80 * adesaoQty).toFixed(2).replace(".", ",")}
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-[#00A868] font-semibold">✓ Máquinas isentas de aluguel</p>
                        </div>
                    )}
                </div>

                {/* Cost Diff — 3 cols */}
                <div className="md:col-span-3 card-elevated rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingDown className="w-4 h-4 text-foreground" />
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Diferença</h3>
                    </div>
                    <div className="space-y-1 text-[11px]">
                        {[
                            { l: "Taxas Déb", d: cDebitCost - sDebitCost },
                            { l: "Taxas Créd", d: cCreditCost - sCreditCost },
                            { l: "Taxas PIX", d: cPixCost - sPixCost },
                            { l: "Aluguel", d: cRental - sRental },
                        ].map((r) => (
                            <div key={r.l} className="flex justify-between">
                                <span className="text-muted-foreground">{r.l}</span>
                                <span className={`font-medium ${r.d > 0 ? "text-[#00A868]" : r.d < 0 ? "text-red-500" : "text-foreground"}`}>
                                    {r.d > 0 ? "+" : ""}{formatCurrency(r.d)}
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                            <span>Total</span>
                            <span className={economy > 0 ? "text-[#00A868]" : economy < 0 ? "text-red-500" : "text-foreground"}>
                                {economy > 0 ? "+" : ""}{formatCurrency(economy)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 4: Economy Bar */}
            <div className={`rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-lg ${economy > 0 ? "bg-[#00A868] glow-green" :
                economy < 0 ? "bg-gradient-to-r from-amber-600 to-amber-500" : "bg-gradient-to-r from-slate-600 to-slate-500"}`}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        {economy > 0 ? <TrendingDown className="w-6 h-6 text-white" /> : <TrendingUp className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white/80 mb-1">{economy > 0 ? "Economia com a Stone" : economy < 0 ? "Custo adicional na Stone" : "Custos Equivalentes"}</p>
                        <p className="text-3xl font-black tracking-tight">{formatCurrency(Math.abs(economy))}<span className="text-base font-normal text-white/80">/mês</span></p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(Math.abs(economy) * 12)}<span className="text-sm font-normal">/ano</span></p>
                    <div className="flex gap-3 text-[10px] text-white/60 mt-0.5">
                        <span>Stone: {formatCurrency(sTot)}</span>
                        <span>{comp.name}: {formatCurrency(cTot)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
