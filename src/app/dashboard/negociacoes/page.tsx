"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPercent, BRAND_PRESETS, type BrandRates } from "@/lib/calculator";
import { RI } from "@/components/rate-input";
import { formatarDocumento, validarDocumento } from "@/lib/documento";

const BRAND_NAMES = Object.keys(BRAND_PRESETS);

interface BrandRateSet { [brand: string]: { debit: number; credit1x: number; credit2to6: number; credit7to12: number } }

interface RateSnapshot {
    debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number;
    brandRates?: BrandRateSet;
    ravTipo?: "automatico" | "pontual";
    ravRate?: number;
    ravPontual?: number;
    ravTiming?: "md" | "ds" | "du";
}

function defaultBrandRates(): BrandRateSet {
    const br: BrandRateSet = {};
    for (const [name, rates] of Object.entries(BRAND_PRESETS)) {
        br[name] = { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    }
    return br;
}

interface Negotiation {
    id: string; dateNeg: string; dateAccept: string;
    status: "pendente" | "aceita" | "recusada";
    rates: RateSnapshot; notes: string;
    alertDate?: string; alertSent?: boolean;
}

function buildGoogleCalendarUrl(clientName: string, alertDate: string) {
    const d = alertDate.replace(/-/g, "");
    const title = encodeURIComponent(`Renegociar taxas — ${clientName}`);
    const details = encodeURIComponent(`Lembrete de renegociação de taxas do cliente ${clientName}.\n\nAcesse: https://casa94.bkaiser.com.br/dashboard/negociacoes`);
    return `https://calendar.google.com/calendar/event?action=TEMPLATE&text=${title}&dates=${d}/${d}&details=${details}`;
}

function ReminderField({ alertDate, setAlertDate, label }: { alertDate: string; setAlertDate: (v: string) => void; label?: string }) {
    const [mode, setMode] = useState<"days" | "date">("days");
    const [days, setDays] = useState(15);

    function handleDaysSet(d: number) {
        setDays(d);
        const target = new Date();
        target.setDate(target.getDate() + d);
        setAlertDate(target.toISOString().split("T")[0]);
    }

    return (
        <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">{label || "Lembrete"}</label>
            <div className="flex gap-2">
                <button type="button" onClick={() => setMode("days")}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${mode === "days" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/40" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>Em X dias</button>
                <button type="button" onClick={() => setMode("date")}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${mode === "date" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/40" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>Data específica</button>
                {alertDate && (
                    <button type="button" onClick={() => setAlertDate("")}
                        className="px-3 py-1.5 text-xs rounded-lg font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">Remover</button>
                )}
            </div>
            {mode === "days" ? (
                <div className="flex gap-2 items-center">
                    <div className="flex gap-1.5">
                        {[7, 15, 30, 60].map(d => (
                            <button key={d} type="button" onClick={() => handleDaysSet(d)}
                                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${days === d && alertDate ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
                                {d}d
                            </button>
                        ))}
                    </div>
                    <input type="number" min={1} value={days} onChange={(e) => handleDaysSet(parseInt(e.target.value) || 15)}
                        className="w-16 px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs text-center focus:ring-1 focus:ring-amber-500" />
                </div>
            ) : (
                <input type="date" value={alertDate} onChange={(e) => setAlertDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all" />
            )}
            {alertDate && (
                <p className="text-xs text-amber-500 font-medium">⏰ Lembrete em {fmtDate(alertDate)}</p>
            )}
        </div>
    );
}

interface Client {
    id: string; name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    createdAt: string; negotiations: Negotiation[];
}

function defaultRates(): RateSnapshot {
    return {
        debit: 0.84, credit1x: 1.86, credit2to6: 2.18, credit7to12: 2.41, pix: 0.00, rav: 1.30,
        brandRates: defaultBrandRates(), ravTipo: "automatico", ravRate: 1.30, ravPontual: 3.79, ravTiming: "md",
    };
}
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; } }

type View = "list" | "detail" | "new";

/* ═══ Sub-components ═══ */

function RatesForm({ rates, set }: { rates: RateSnapshot; set: (r: RateSnapshot) => void }) {
    const [activeBrand, setActiveBrand] = useState("VISA/MASTER");
    const br = rates.brandRates || defaultBrandRates();
    const currentBrand = br[activeBrand] || { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };

    function updateBrand(field: string, val: number) {
        const newBr = { ...br, [activeBrand]: { ...currentBrand, [field]: val } };
        const visa = newBr["VISA/MASTER"] || currentBrand;
        set({ ...rates, brandRates: newBr, debit: visa.debit, credit1x: visa.credit1x, credit2to6: visa.credit2to6, credit7to12: visa.credit7to12 });
    }

    const [newBrandInput, setNewBrandInput] = useState("");
    const [showNewBrand, setShowNewBrand] = useState(false);

    function addBrand(name: string) {
        if (name && !br[name]) {
            const newBr = { ...br, [name]: { debit: 0, credit1x: 0, credit2to6: 0, credit7to12: 0 } };
            set({ ...rates, brandRates: newBr });
            setActiveBrand(name);
        }
    }

    function removeBrand(b: string) {
        const newBr = { ...br }; delete newBr[b];
        set({ ...rates, brandRates: newBr });
        if (activeBrand === b) setActiveBrand(Object.keys(newBr)[0]);
    }

    const brandList = Object.keys(br);

    return (
        <div className="space-y-4">
            {/* Brand tabs */}
            <div className="flex gap-1.5 flex-wrap items-center">
                {brandList.map((b) => (
                    <div key={b} className="relative group">
                        <button type="button" onClick={() => setActiveBrand(b)}
                            className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${activeBrand === b ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40" : "bg-secondary text-muted-foreground hover:bg-muted"
                                }`}>
                            {b}
                        </button>
                        {!BRAND_PRESETS[b] && (
                            <button type="button" onClick={() => removeBrand(b)}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] leading-none hidden group-hover:flex items-center justify-center">×</button>
                        )}
                    </div>
                ))}
                {showNewBrand ? (
                    <div className="flex items-center gap-1.5">
                        <input type="text" value={newBrandInput} autoFocus
                            onChange={(e) => setNewBrandInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newBrandInput.trim()) { addBrand(newBrandInput.trim()); setNewBrandInput(""); setShowNewBrand(false); }
                                if (e.key === "Escape") { setNewBrandInput(""); setShowNewBrand(false); }
                            }}
                            placeholder="BANDEIRA"
                            className="w-24 px-2 py-1.5 text-xs rounded-lg bg-secondary border border-emerald-500/40 text-foreground focus:ring-1 focus:ring-emerald-500" />
                        <button type="button" onClick={() => { addBrand(newBrandInput.trim()); setNewBrandInput(""); setShowNewBrand(false); }}
                            className="text-xs font-semibold text-emerald-500 hover:text-emerald-400">OK</button>
                        <button type="button" onClick={() => { setNewBrandInput(""); setShowNewBrand(false); }}
                            className="text-xs font-semibold text-red-400 hover:text-red-300">✕</button>
                    </div>
                ) : (
                    <button type="button" onClick={() => setShowNewBrand(true)}
                        className="px-3 py-1.5 text-xs rounded-lg font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors">+ Bandeira</button>
                )}
            </div>
            {/* Brand rates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <RI l="Débito" v={currentBrand.debit} set={(v) => updateBrand("debit", v)} />
                <RI l="Crédito 1x" v={currentBrand.credit1x} set={(v) => updateBrand("credit1x", v)} />
                <RI l="2-6x" v={currentBrand.credit2to6} set={(v) => updateBrand("credit2to6", v)} />
                <RI l="7-12x" v={currentBrand.credit7to12} set={(v) => updateBrand("credit7to12", v)} />
            </div>
            {/* PIX + RAV section */}
            <div className="pt-4 border-t border-border space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">PIX & RAV</h4>
                <div className="grid grid-cols-2 gap-3">
                    <RI l="PIX" v={rates.pix} set={(v) => set({ ...rates, pix: v })} />
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Tipo RAV</label>
                        <select value={rates.ravTipo || "automatico"} onChange={(e) => set({ ...rates, ravTipo: e.target.value as "automatico" | "pontual" })}
                            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all">
                            <option value="automatico">Automático</option>
                            <option value="pontual">Pontual (sem CET)</option>
                        </select>
                    </div>
                </div>
                {(rates.ravTipo || "automatico") === "automatico" && (
                    <div className="grid grid-cols-3 gap-3">
                        <RI l="RAV Auto" v={rates.ravRate ?? rates.rav} set={(v) => set({ ...rates, ravRate: v, rav: v })} />
                        <RI l="RAV Pontual" v={rates.ravPontual ?? 3.79} set={(v) => set({ ...rates, ravPontual: v })} />
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Recebimento</label>
                            <select value={rates.ravTiming || "md"} onChange={(e) => set({ ...rates, ravTiming: e.target.value as "md" | "ds" | "du" })}
                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all">
                                <option value="md">Mesmo Dia</option>
                                <option value="ds">Dia Seguinte</option>
                                <option value="du">Dias Úteis</option>
                            </select>
                        </div>
                    </div>
                )}
                {rates.ravTipo === "pontual" && (
                    <div className="grid grid-cols-2 gap-3">
                        <RI l="RAV Auto" v={rates.ravRate ?? rates.rav} set={(v) => set({ ...rates, ravRate: v, rav: v })} />
                        <RI l="RAV Pontual" v={rates.ravPontual ?? 3.79} set={(v) => set({ ...rates, ravPontual: v })} />
                    </div>
                )}
            </div>
        </div>
    );
}

function RatesReadonly({ rates }: { rates: RateSnapshot }) {
    const [showBrand, setShowBrand] = useState("VISA/MASTER");
    const br = rates.brandRates;
    const current = br?.[showBrand] || { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    const ravLabel = rates.ravTipo === "pontual" ? "Pontual" : `Auto ${rates.ravTiming === "ds" ? "D.Seg" : rates.ravTiming === "du" ? "D.Uteis" : "M.Dia"}`;

    return (
        <div className="space-y-3">
            {br && (
                <div className="flex gap-1.5 flex-wrap">
                    {BRAND_NAMES.filter(b => br[b]).map((b) => (
                        <button key={b} type="button" onClick={() => setShowBrand(b)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${showBrand === b ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                                }`}>
                            {b}
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[{ l: "Débito", v: current.debit }, { l: "Créd 1x", v: current.credit1x }, { l: "2-6x", v: current.credit2to6 },
                { l: "7-12x", v: current.credit7to12 }, { l: "PIX", v: rates.pix },
                { l: ravLabel, v: rates.ravTipo === "pontual" ? 0 : (rates.ravRate ?? rates.rav) }].map((r) => (
                    <div key={r.l} className="bg-secondary rounded-xl p-2.5 text-center">
                        <p className="text-xs text-muted-foreground font-medium">{r.l}</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{formatPercent(r.v)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusBadge({ s }: { s: Negotiation["status"] }) {
    const cls = {
        pendente: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
        aceita: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
        recusada: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
    };
    const lbl = { pendente: "Pendente", aceita: "Aceita", recusada: "Recusada" };
    return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cls[s]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s === "pendente" ? "bg-amber-500" : s === "aceita" ? "bg-emerald-500" : "bg-red-500"}`} />
        {lbl[s]}
    </span>;
}

function DateFields({ dn, setDN, da, setDA }: { dn: string; setDN: (s: string) => void; da: string; setDA: (s: string) => void }) {
    return (
        <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Data Negociação</label>
                <input type="date" value={dn} onChange={(e) => setDN(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
            </div>
            <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Data Aceite</label>
                <input type="date" value={da} onChange={(e) => setDA(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
            </div>
        </div>
    );
}

export default function NegociacoesPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [view, setView] = useState<View>("list");
    const [selId, setSelId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    // New client form
    const [fn, setFN] = useState(""); const [fsc, setFSC] = useState(""); const [fcnpj, setFCNPJ] = useState("");
    const [fph, setFPH] = useState(""); const [fem, setFEM] = useState("");
    const [fDocMsg, setFDocMsg] = useState(""); const [fDocOk, setFDocOk] = useState<boolean | null>(null);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [fRates, setFRates] = useState<RateSnapshot>(defaultRates());
    const [fDateN, setFDateN] = useState(today()); const [fDateA, setFDateA] = useState("");
    const [fNotes, setFNotes] = useState("");
    const [fAlertDate, setFAlertDate] = useState("");

    // Renegotiation
    const [showReNeg, setShowReNeg] = useState(false);
    const [rr, setRR] = useState<RateSnapshot>(defaultRates());
    const [rdn, setRDN] = useState(today()); const [rda, setRDA] = useState(""); const [rn, setRN] = useState("");
    const [rAlertDate, setRAlertDate] = useState("");

    // Edit negotiation
    const [editNegId, setEditNegId] = useState<string | null>(null);
    const [er, setER] = useState<RateSnapshot>(defaultRates());
    const [edn, setEDN] = useState(""); const [eda, setEDA] = useState(""); const [en, setEN] = useState("");
    const [eAlertDate, setEAlertDate] = useState("");

    const loadClients = useCallback(async () => {
        try {
            const r = await fetch("/api/clients");
            if (r.ok) {
                const data = await r.json();
                setClients(data);
            }
        } catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { loadClients(); }, [loadClients]);

    const sel = clients.find((c) => c.id === selId);
    const filtered = search
        ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.stoneCode.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search))
        : clients;

    function resetNewForm() {
        setFN(""); setFSC(""); setFCNPJ(""); setFPH(""); setFEM("");
        setFRates(defaultRates()); setFDateN(today()); setFDateA(""); setFNotes(""); setFAlertDate("");
        setFDocMsg(""); setFDocOk(null);
    }

    async function handleCnpjChange(raw: string) {
        const formatted = formatarDocumento(raw);
        setFCNPJ(formatted);
        const nums = raw.replace(/\D/g, "");
        if (nums.length === 14) {
            const v = validarDocumento(nums);
            setFDocMsg(v.mensagem); setFDocOk(v.valido);
            if (v.valido && v.tipo === "cnpj") {
                setCnpjLoading(true);
                try {
                    const r = await fetch(`/api/cnpj?cnpj=${nums}`);
                    if (r.ok) {
                        const data = await r.json();
                        if (data.razaoSocial && !fn.trim()) setFN(data.razaoSocial);
                        if (data.telefone && !fph.trim()) setFPH(data.telefone);
                        if (data.email && !fem.trim()) setFEM(data.email);
                        setFDocMsg(`CNPJ válido — ${data.razaoSocial || "Encontrado"}`);
                    }
                } catch { /* */ }
                setCnpjLoading(false);
            }
        } else if (nums.length === 11) {
            const v = validarDocumento(nums);
            setFDocMsg(v.mensagem); setFDocOk(v.valido);
        } else {
            setFDocMsg(""); setFDocOk(null);
        }
    }

    async function handleSaveClient() {
        if (!fn.trim()) return;
        try {
            const r = await fetch("/api/clients", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fn, stoneCode: fsc, cnpj: fcnpj, phone: fph, email: fem,
                    negotiation: { dateNeg: fDateN, dateAccept: fDateA, rates: fRates, notes: fNotes, alertDate: fAlertDate },
                }),
            });
            if (r.ok) {
                const client = await r.json();
                setClients([client, ...clients]);
                setSelId(client.id); setView("detail"); resetNewForm();
            }
        } catch { /* */ }
    }

    async function handleAddReNeg() {
        if (!sel) return;
        try {
            const r = await fetch(`/api/clients/${sel.id}/negotiations`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dateNeg: rdn, dateAccept: rda, rates: rr, notes: rn, alertDate: rAlertDate }),
            });
            if (r.ok) {
                await loadClients();
                setShowReNeg(false); setRR(defaultRates()); setRDN(today()); setRDA(""); setRN(""); setRAlertDate("");
            }
        } catch { /* */ }
    }

    async function handleNegStatus(negId: string, status: "aceita" | "recusada") {
        try {
            await fetch(`/api/negotiations/${negId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, dateAccept: status === "aceita" ? today() : "" }),
            });
            await loadClients();
        } catch { /* */ }
    }

    function startEditNeg(neg: Negotiation) {
        setEditNegId(neg.id); setER({ ...neg.rates }); setEDN(neg.dateNeg); setEDA(neg.dateAccept); setEN(neg.notes); setEAlertDate(neg.alertDate || "");
    }

    async function handleSaveEditNeg() {
        if (!editNegId) return;
        try {
            await fetch(`/api/negotiations/${editNegId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rates: er, dateNeg: edn, dateAccept: eda, status: eda ? "aceita" : undefined, notes: en, alertDate: eAlertDate }),
            });
            await loadClients(); setEditNegId(null);
        } catch { /* */ }
    }

    async function handleDeleteNeg(negId: string) {
        try {
            await fetch(`/api/negotiations/${negId}`, { method: "DELETE" });
            await loadClients();
        } catch { /* */ }
    }

    async function handleDeleteClient(id: string) {
        try {
            await fetch(`/api/clients/${id}`, { method: "DELETE" });
            setClients(clients.filter((c) => c.id !== id));
            if (selId === id) { setView("list"); setSelId(null); }
        } catch { /* */ }
    }

    function shareClientWhatsApp() {
        if (!sel) return;
        const activeNeg = sel.negotiations.find((n) => n.status === "aceita");
        const rates = activeNeg?.rates || sel.negotiations[0]?.rates;
        let txt = `HISTÓRICO — ${sel.name}\n`;
        if (sel.stoneCode) txt += `Stone Code: ${sel.stoneCode}\n`;
        if (sel.cnpj) txt += `CNPJ: ${sel.cnpj}\n`;
        const ravInfo = rates?.ravTipo === "pontual" ? "RAV Pontual (sem antecipação)" : `RAV Automático: ${formatPercent(rates?.ravRate ?? rates?.rav ?? 0)}`;
        txt += `\nTAXAS ${activeNeg ? "APROVADAS" : "ATUAIS"} (VISA/MASTER):\n`;
        if (rates) {
            txt += `Débito: ${formatPercent(rates.debit)} | Crédito 1x: ${formatPercent(rates.credit1x)}\n`;
            txt += `2-6x: ${formatPercent(rates.credit2to6)} | 7-12x: ${formatPercent(rates.credit7to12)}\n`;
            txt += `PIX: ${formatPercent(rates.pix)}\n`;
            txt += `${ravInfo}\n`;
        }
        txt += `\n${sel.negotiations.length} negociação(ões) registradas\n`;
        sel.negotiations.forEach((n, i) => {
            const st = { pendente: "⏳", aceita: "✅", recusada: "❌" };
            txt += `${i + 1}. ${st[n.status]} ${fmtDate(n.dateNeg)}${n.notes ? " — " + n.notes : ""}\n`;
        });
        txt += `\nBoa negociação!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // ─── LIST VIEW ───
    if (view === "list") {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Negociações</h1>
                        <p className="text-sm text-muted-foreground mt-1">CRM de controle de taxas por cliente</p>
                    </div>
                    <button onClick={() => { resetNewForm(); setView("new"); }}
                        className="px-5 py-2.5 text-sm rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors shadow-sm">
                        + Novo Cliente
                    </button>
                </div>

                <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, Stone Code ou CNPJ..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                </div>

                {filtered.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <p className="font-semibold text-foreground text-base">Nenhum cliente cadastrado</p>
                        <p className="text-sm text-muted-foreground mt-1">Cadastre clientes para acompanhar negociações de taxas.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((c) => {
                            const last = c.negotiations[0];
                            const rates = last?.rates;
                            return (
                                <button key={c.id} onClick={() => { setSelId(c.id); setView("detail"); setEditNegId(null); setShowReNeg(false); }}
                                    className="w-full bg-card border border-border rounded-2xl p-5 text-left hover:border-emerald-500/40 hover:shadow-sm transition-all">
                                    <div className="flex items-start gap-4 mb-3">
                                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{c.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground text-base truncate">{c.name}</p>
                                            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                                {c.stoneCode && <span>SC: {c.stoneCode}</span>}
                                                {c.cnpj && <span>{c.cnpj}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                            {last && <StatusBadge s={last.status} />}
                                            <span className="text-xs text-muted-foreground">{c.negotiations.length} negociação(ões)</span>
                                        </div>
                                    </div>
                                    {last && rates && (
                                        <div className="space-y-2">
                                            <div className="flex gap-6 text-xs">
                                                <span className="text-muted-foreground">Negociação: <strong className="text-foreground">{fmtDate(last.dateNeg)}</strong></span>
                                                <span className="text-muted-foreground">Aceite: <strong className={last.dateAccept ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{last.dateAccept ? fmtDate(last.dateAccept) : "Pendente"}</strong></span>
                                            </div>
                                            <div className="grid grid-cols-6 gap-2">
                                                {[{ l: "Débito", v: rates.debit }, { l: "1x", v: rates.credit1x }, { l: "2-6x", v: rates.credit2to6 },
                                                { l: "7-12x", v: rates.credit7to12 }, { l: "PIX", v: rates.pix }, { l: "RAV", v: rates.rav }].map((r) => (
                                                    <div key={r.l} className="bg-secondary/60 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-muted-foreground">{r.l}</p>
                                                        <p className="text-sm font-bold text-foreground">{formatPercent(r.v)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ─── NEW CLIENT ───
    if (view === "new") {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView("list")} className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-xl font-bold text-foreground">Novo Cliente + Negociação</h1>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Dados do Cliente</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Nome / Razão Social *</label>
                            <input value={fn} onChange={(e) => setFN(e.target.value)} placeholder="Nome completo ou razão social"
                                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Stone Code</label>
                            <input value={fsc} onChange={(e) => setFSC(e.target.value)} placeholder="123456"
                                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
                                CNPJ/CPF {cnpjLoading && <span className="text-emerald-500 animate-pulse ml-1">buscando...</span>}
                            </label>
                            <input value={fcnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00"
                                className={`w-full px-3 py-2.5 rounded-lg bg-secondary border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40 transition-all ${fDocOk === true ? "border-emerald-500" : fDocOk === false ? "border-red-500" : "border-border"
                                    }`} />
                            {fDocMsg && (
                                <p className={`text-xs mt-1 ${fDocOk ? "text-emerald-500" : "text-red-500"}`}>{fDocMsg}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Telefone</label>
                            <input value={fph} onChange={(e) => setFPH(e.target.value)} placeholder="(00) 00000-0000"
                                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">E-mail</label>
                            <input value={fem} onChange={(e) => setFEM(e.target.value)} placeholder="email@empresa.com"
                                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-emerald-500/20 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Taxas Negociadas</h3>
                    <RatesForm rates={fRates} set={setFRates} />
                    <DateFields dn={fDateN} setDN={setFDateN} da={fDateA} setDA={setFDateA} />
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Observações</label>
                        <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={3} placeholder="Detalhes da negociação..."
                            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all" />
                    </div>
                    <ReminderField alertDate={fAlertDate} setAlertDate={setFAlertDate} label="Lembrete de Renegociação" />
                </div>

                <button onClick={handleSaveClient} disabled={!fn.trim()}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm">
                    Salvar Cliente + Negociação
                </button>
            </div>
        );
    }

    // ─── DETAIL VIEW ───
    if (view === "detail" && sel) {
        const activeRates = sel.negotiations.find((n) => n.status === "aceita")?.rates;

        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setView("list"); setSelId(null); setEditNegId(null); }}
                            className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{sel.name}</h1>
                            <div className="flex gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
                                {sel.stoneCode && <span>SC: {sel.stoneCode}</span>}
                                {sel.cnpj && <span>{sel.cnpj}</span>}
                                {sel.phone && <span>{sel.phone}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={shareClientWhatsApp}
                            className="px-4 py-2 text-sm rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 font-semibold hover:bg-green-500/20 transition-colors">WhatsApp</button>
                        <button onClick={() => {
                            setShowReNeg(true); setEditNegId(null);
                            if (activeRates) setRR({ ...activeRates }); else setRR(defaultRates());
                            setRDN(today()); setRDA(""); setRN("");
                        }} className="px-4 py-2 text-sm rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors">
                            Renegociar
                        </button>
                        <button onClick={() => handleDeleteClient(sel.id)}
                            className="px-4 py-2 text-sm rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-semibold hover:bg-red-500/20 transition-colors">Excluir</button>
                    </div>
                </div>

                {activeRates && (
                    <div className="bg-card border border-emerald-500/20 rounded-2xl p-5">
                        <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">Taxas Vigentes (Aprovadas)</h3>
                        <RatesReadonly rates={activeRates} />
                    </div>
                )}

                {showReNeg && (
                    <div className="bg-card border border-blue-500/30 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Nova Renegociação</h3>
                        <RatesForm rates={rr} set={setRR} />
                        <DateFields dn={rdn} setDN={setRDN} da={rda} setDA={setRDA} />
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Observações</label>
                            <textarea value={rn} onChange={(e) => setRN(e.target.value)} rows={3} placeholder="Motivo da renegociação..."
                                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" />
                        </div>
                        <ReminderField alertDate={rAlertDate} setAlertDate={setRAlertDate} label="Lembrete de Renegociação" />
                        <div className="flex gap-3">
                            <button onClick={handleAddReNeg} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors">Registrar</button>
                            <button onClick={() => setShowReNeg(false)} className="px-6 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-base font-bold text-foreground mb-3">Histórico ({sel.negotiations.length})</h3>
                    <div className="space-y-3">
                        {sel.negotiations.map((neg, idx) => {
                            const isEditing = editNegId === neg.id;
                            return (
                                <div key={neg.id} className={`bg-card border rounded-2xl p-5 ${idx === 0 ? "border-emerald-500/20" : "border-border"}`}>
                                    {isEditing ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Editando Negociação</h4>
                                                <button onClick={() => setEditNegId(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">✕</button>
                                            </div>
                                            <RatesForm rates={er} set={setER} />
                                            <DateFields dn={edn} setDN={setEDN} da={eda} setDA={setEDA} />
                                            <textarea value={en} onChange={(e) => setEN(e.target.value)} rows={2} placeholder="Observações..."
                                                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm resize-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all" />
                                            <ReminderField alertDate={eAlertDate} setAlertDate={setEAlertDate} label="Lembrete" />
                                            <button onClick={handleSaveEditNeg}
                                                className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 transition-colors">Salvar Alterações</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <StatusBadge s={neg.status} />
                                                    {idx === 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full">Mais recente</span>}
                                                </div>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {neg.status === "pendente" && (
                                                        <>
                                                            <button onClick={() => handleNegStatus(neg.id, "aceita")}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors">Aceitar</button>
                                                            <button onClick={() => handleNegStatus(neg.id, "recusada")}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors">Recusar</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => startEditNeg(neg)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors">Editar</button>
                                                    {sel.negotiations.length > 1 && (
                                                        <button onClick={() => handleDeleteNeg(neg.id)}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors">Excluir</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-6 text-sm mb-3">
                                                <span className="text-muted-foreground">Negociação: <strong className="text-foreground">{fmtDate(neg.dateNeg)}</strong></span>
                                                <span className="text-muted-foreground">Aceite: <strong className={neg.dateAccept ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{neg.dateAccept ? fmtDate(neg.dateAccept) : "Pendente"}</strong></span>
                                            </div>
                                            <RatesReadonly rates={neg.rates} />
                                            {neg.alertDate && (
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${neg.alertSent ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                        {neg.alertSent ? '✅ Lembrete enviado' : `⏰ Lembrete: ${fmtDate(neg.alertDate)}`}
                                                    </span>
                                                    {!neg.alertSent && (
                                                        <a href={buildGoogleCalendarUrl(sel?.name || '', neg.alertDate)}
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors">
                                                            📅 Google Agenda
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {neg.notes && <p className="text-sm text-muted-foreground mt-3 italic border-t border-border pt-3">{neg.notes}</p>}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
