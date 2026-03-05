"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPercent, BRAND_PRESETS, type BrandRates } from "@/lib/calculator";
import { RI } from "@/components/rate-input";
import { formatarDocumento, validarDocumento } from "@/lib/documento";

const BRAND_NAMES = Object.keys(BRAND_PRESETS);

interface BrandRateSet { [brand: string]: { debit: number; credit1x: number; credit2to6: number; credit7to12: number } }

interface RateSnapshot {
    // legacy flat fields (backward compat)
    debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number;
    // new structured fields
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

    // Renegotiation
    const [showReNeg, setShowReNeg] = useState(false);
    const [rr, setRR] = useState<RateSnapshot>(defaultRates());
    const [rdn, setRDN] = useState(today()); const [rda, setRDA] = useState(""); const [rn, setRN] = useState("");

    // Edit negotiation
    const [editNegId, setEditNegId] = useState<string | null>(null);
    const [er, setER] = useState<RateSnapshot>(defaultRates());
    const [edn, setEDN] = useState(""); const [eda, setEDA] = useState(""); const [en, setEN] = useState("");

    // Load from API
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
        setFRates(defaultRates()); setFDateN(today()); setFDateA(""); setFNotes("");
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
                        setFDocMsg(`CNPJ valido - ${data.razaoSocial || "Encontrado"}`);
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
                    negotiation: { dateNeg: fDateN, dateAccept: fDateA, rates: fRates, notes: fNotes },
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
                body: JSON.stringify({ dateNeg: rdn, dateAccept: rda, rates: rr, notes: rn }),
            });
            if (r.ok) {
                await loadClients();
                setShowReNeg(false); setRR(defaultRates()); setRDN(today()); setRDA(""); setRN("");
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
        setEditNegId(neg.id); setER({ ...neg.rates }); setEDN(neg.dateNeg); setEDA(neg.dateAccept); setEN(neg.notes);
    }

    async function handleSaveEditNeg() {
        if (!editNegId) return;
        try {
            await fetch(`/api/negotiations/${editNegId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rates: er, dateNeg: edn, dateAccept: eda, status: eda ? "aceita" : undefined, notes: en }),
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

    // WhatsApp share for client history
    function shareClientWhatsApp() {
        if (!sel) return;
        const activeNeg = sel.negotiations.find((n) => n.status === "aceita");
        const rates = activeNeg?.rates || sel.negotiations[0]?.rates;
        let txt = `HISTORICO - ${sel.name}\n`;
        if (sel.stoneCode) txt += `SC: ${sel.stoneCode}\n`;
        if (sel.cnpj) txt += `CNPJ: ${sel.cnpj}\n`;
        const ravInfo = rates?.ravTipo === "pontual" ? "RAV Pontual (sem antecipacao)" : `RAV Automatico: ${formatPercent(rates?.ravRate ?? rates?.rav ?? 0)}`;
        txt += `\nTAXAS ${activeNeg ? "APROVADAS" : "ATUAIS"} (VISA/MASTER):\n`;
        if (rates) {
            txt += `Deb: ${formatPercent(rates.debit)} | Cred 1x: ${formatPercent(rates.credit1x)}\n`;
            txt += `2-6x: ${formatPercent(rates.credit2to6)} | 7-12x: ${formatPercent(rates.credit7to12)}\n`;
            txt += `PIX: ${formatPercent(rates.pix)}\n`;
            txt += `${ravInfo}\n`;
        }
        txt += `\n📜 ${sel.negotiations.length} negociação(ões) registradas\n`;
        sel.negotiations.forEach((n, i) => {
            const st = { pendente: "⏳", aceita: "✅", recusada: "❌" };
            txt += `${i + 1}. ${st[n.status]} ${fmtDate(n.dateNeg)}${n.notes ? " — " + n.notes : ""}\n`;
        });
        txt += `\nBoa negociacao!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    }

    // Components — RI imported from shared component (prevents focus loss)

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
            <div className="space-y-2">
                {/* Brand tabs */}
                <div className="flex gap-0.5 flex-wrap items-center">
                    {brandList.map((b) => (
                        <div key={b} className="relative group">
                            <button type="button" onClick={() => setActiveBrand(b)}
                                className={`px-1.5 py-0.5 text-[8px] rounded font-semibold transition-all ${activeBrand === b ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40" : "bg-secondary text-muted-foreground hover:bg-muted"
                                    }`}>
                                {b}
                            </button>
                            {!BRAND_PRESETS[b] && (
                                <button type="button" onClick={() => removeBrand(b)}
                                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full text-[7px] leading-none hidden group-hover:flex items-center justify-center">x</button>
                            )}
                        </div>
                    ))}
                    {showNewBrand ? (
                        <div className="flex items-center gap-0.5">
                            <input type="text" value={newBrandInput} autoFocus
                                onChange={(e) => setNewBrandInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newBrandInput.trim()) { addBrand(newBrandInput.trim()); setNewBrandInput(""); setShowNewBrand(false); }
                                    if (e.key === "Escape") { setNewBrandInput(""); setShowNewBrand(false); }
                                }}
                                placeholder="NOME"
                                className="w-20 px-1 py-0.5 text-[8px] rounded bg-secondary border border-emerald-500/40 text-foreground focus:ring-1 focus:ring-emerald-500" />
                            <button type="button" onClick={() => { addBrand(newBrandInput.trim()); setNewBrandInput(""); setShowNewBrand(false); }}
                                className="text-[8px] text-emerald-400">OK</button>
                            <button type="button" onClick={() => { setNewBrandInput(""); setShowNewBrand(false); }}
                                className="text-[8px] text-red-400">X</button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setShowNewBrand(true)}
                            className="px-1.5 py-0.5 text-[8px] rounded font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">+</button>
                    )}
                </div>
                {/* Brand rates */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <RI l="Debito" v={currentBrand.debit} set={(v) => updateBrand("debit", v)} />
                    <RI l="Cred 1x" v={currentBrand.credit1x} set={(v) => updateBrand("credit1x", v)} />
                    <RI l="2-6x" v={currentBrand.credit2to6} set={(v) => updateBrand("credit2to6", v)} />
                    <RI l="7-12x" v={currentBrand.credit7to12} set={(v) => updateBrand("credit7to12", v)} />
                </div>
                {/* PIX + RAV section */}
                <div className="pt-2 border-t border-border space-y-1.5">
                    <h4 className="text-[9px] font-bold text-muted-foreground uppercase">PIX & RAV</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                        <RI l="PIX" v={rates.pix} set={(v) => set({ ...rates, pix: v })} />
                        <div>
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">Tipo RAV</label>
                            <select value={rates.ravTipo || "automatico"} onChange={(e) => set({ ...rates, ravTipo: e.target.value as "automatico" | "pontual" })}
                                className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] focus:ring-1 focus:ring-emerald-500">
                                <option value="automatico">Automatico</option>
                                <option value="pontual">Pontual (sem CET)</option>
                            </select>
                        </div>
                    </div>
                    {(rates.ravTipo || "automatico") === "automatico" && (
                        <div className="grid grid-cols-3 gap-1.5">
                            <RI l="RAV Auto" v={rates.ravRate ?? rates.rav} set={(v) => set({ ...rates, ravRate: v, rav: v })} />
                            <RI l="RAV Pontual" v={rates.ravPontual ?? 3.79} set={(v) => set({ ...rates, ravPontual: v })} />
                            <div>
                                <label className="text-[9px] text-muted-foreground uppercase block mb-px">Recebimento</label>
                                <select value={rates.ravTiming || "md"} onChange={(e) => set({ ...rates, ravTiming: e.target.value as "md" | "ds" | "du" })}
                                    className="w-full px-1 py-1 rounded-md bg-secondary border border-border text-foreground text-[10px] focus:ring-1 focus:ring-emerald-500">
                                    <option value="md">Mesmo Dia</option>
                                    <option value="ds">Dia Seguinte</option>
                                    <option value="du">Dias Uteis</option>
                                </select>
                            </div>
                        </div>
                    )}
                    {rates.ravTipo === "pontual" && (
                        <div className="grid grid-cols-2 gap-1.5">
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
            <div className="space-y-1.5">
                {br && (
                    <div className="flex gap-0.5 flex-wrap">
                        {BRAND_NAMES.filter(b => br[b]).map((b) => (
                            <button key={b} type="button" onClick={() => setShowBrand(b)}
                                className={`px-1 py-0.5 text-[7px] rounded font-semibold ${showBrand === b ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary/50 text-muted-foreground"
                                    }`}>
                                {b}
                            </button>
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                    {[{ l: "Deb", v: current.debit }, { l: "1x", v: current.credit1x }, { l: "2-6x", v: current.credit2to6 },
                    { l: "7-12x", v: current.credit7to12 }, { l: "PIX", v: rates.pix },
                    { l: ravLabel, v: rates.ravTipo === "pontual" ? 0 : (rates.ravRate ?? rates.rav) }].map((r) => (
                        <div key={r.l} className="bg-secondary rounded-md p-1 text-center">
                            <p className="text-[8px] text-muted-foreground">{r.l}</p>
                            <p className="text-[10px] font-bold text-foreground">{formatPercent(r.v)}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    function StatusBadge({ s }: { s: Negotiation["status"] }) {
        const cls = { pendente: "bg-amber-500/10 text-amber-500 border-amber-500/30", aceita: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", recusada: "bg-red-500/10 text-red-500 border-red-500/30" };
        const lbl = { pendente: "⏳ Pendente", aceita: "✅ Aceita", recusada: "❌ Recusada" };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls[s]}`}>{lbl[s]}</span>;
    }

    function DateFields({ dn, setDN, da, setDA }: { dn: string; setDN: (s: string) => void; da: string; setDA: (s: string) => void }) {
        return (
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-px">📅 Data Negociação</label>
                    <input type="date" value={dn} onChange={(e) => setDN(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-px">✅ Data Aceite</label>
                    <input type="date" value={da} onChange={(e) => setDA(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs focus:ring-1 focus:ring-emerald-500" />
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // ─── LIST ───
    if (view === "list") {
        return (
            <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Negociações</h1>
                        <p className="text-xs text-muted-foreground">CRM de controle de taxas por cliente</p>
                    </div>
                    <button onClick={() => { resetNewForm(); setView("new"); }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 shadow-sm">
                        ➕ Novo Cliente
                    </button>
                </div>

                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, Stone Code ou CNPJ..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500" />
                </div>

                {filtered.length === 0 ? (
                    <div className="glass-card rounded-2xl p-10 text-center">
                        <p className="text-3xl mb-3">🤝</p>
                        <p className="font-semibold text-foreground text-sm">Nenhum cliente cadastrado</p>
                        <p className="text-xs text-muted-foreground mt-1">Cadastre clientes para acompanhar negociações.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((c) => {
                            const last = c.negotiations[0];
                            const rates = last?.rates;
                            return (
                                <button key={c.id} onClick={() => { setSelId(c.id); setView("detail"); setEditNegId(null); setShowReNeg(false); }}
                                    className="w-full glass-card rounded-xl p-3 text-left hover:ring-1 hover:ring-emerald-500/30 transition-all">
                                    <div className="flex items-start gap-3 mb-2">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-emerald-500">{c.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground text-sm truncate">{c.name}</p>
                                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                                                {c.stoneCode && <span>SC: {c.stoneCode}</span>}
                                                {c.cnpj && <span>{c.cnpj}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                            {last && <StatusBadge s={last.status} />}
                                            <span className="text-[10px] text-muted-foreground">{c.negotiations.length} neg.</span>
                                        </div>
                                    </div>
                                    {last && rates && (
                                        <div className="space-y-1.5">
                                            <div className="flex gap-4 text-[10px]">
                                                <span className="text-muted-foreground">📅 Neg: <strong className="text-foreground">{fmtDate(last.dateNeg)}</strong></span>
                                                <span className="text-muted-foreground">✅ Aceite: <strong className={last.dateAccept ? "text-emerald-500" : "text-amber-500"}>{last.dateAccept ? fmtDate(last.dateAccept) : "Pendente"}</strong></span>
                                            </div>
                                            <div className="grid grid-cols-6 gap-1">
                                                {[{ l: "Déb", v: rates.debit }, { l: "1x", v: rates.credit1x }, { l: "2-6x", v: rates.credit2to6 },
                                                { l: "7-12x", v: rates.credit7to12 }, { l: "PIX", v: rates.pix }, { l: "RAV", v: rates.rav }].map((r) => (
                                                    <div key={r.l} className="bg-secondary/50 rounded p-1 text-center">
                                                        <p className="text-[8px] text-muted-foreground">{r.l}</p>
                                                        <p className="text-[10px] font-bold text-foreground">{formatPercent(r.v)}</p>
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
            <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView("list")} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-foreground text-sm">← Voltar</button>
                    <h1 className="text-lg font-bold text-foreground">Novo Cliente + Negociação</h1>
                </div>

                <div className="glass-card rounded-xl p-4 space-y-3">
                    <h3 className="text-[10px] font-bold text-foreground uppercase">👤 Dados do Cliente</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">Nome/Razao Social *</label>
                            <input value={fn} onChange={(e) => setFN(e.target.value)} placeholder="Nome"
                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">Stone Code</label>
                            <input value={fsc} onChange={(e) => setFSC(e.target.value)} placeholder="123456"
                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">
                                CNPJ/CPF {cnpjLoading && <span className="text-emerald-400 animate-pulse">buscando...</span>}
                            </label>
                            <input value={fcnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00"
                                className={`w-full px-2 py-1.5 rounded-md bg-secondary border text-foreground text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500 ${fDocOk === true ? "border-emerald-500" : fDocOk === false ? "border-red-500" : "border-border"
                                    }`} />
                            {fDocMsg && (
                                <p className={`text-[9px] mt-0.5 ${fDocOk ? "text-emerald-400" : "text-red-400"}`}>{fDocMsg}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">Telefone</label>
                            <input value={fph} onChange={(e) => setFPH(e.target.value)} placeholder="(00) 00000-0000"
                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">E-mail</label>
                            <input value={fem} onChange={(e) => setFEM(e.target.value)} placeholder="email@emp.com"
                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-xl p-4 space-y-3 border border-emerald-500/20">
                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase">📊 Taxas Negociadas</h3>
                    <RatesForm rates={fRates} set={setFRates} />
                    <DateFields dn={fDateN} setDN={setFDateN} da={fDateA} setDA={setFDateA} />
                    <div>
                        <label className="text-[9px] text-muted-foreground uppercase block mb-px">📝 Observações</label>
                        <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} placeholder="Detalhes..."
                            className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground resize-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                </div>

                <button onClick={handleSaveClient} disabled={!fn.trim()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 shadow-sm">
                    💾 Salvar Cliente + Negociação
                </button>
            </div>
        );
    }

    // ─── DETAIL ───
    if (view === "detail" && sel) {
        const activeRates = sel.negotiations.find((n) => n.status === "aceita")?.rates;

        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setView("list"); setSelId(null); setEditNegId(null); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-foreground text-sm">← Voltar</button>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{sel.name}</h1>
                            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                                {sel.stoneCode && <span>SC: {sel.stoneCode}</span>}
                                {sel.cnpj && <span>{sel.cnpj}</span>}
                                {sel.phone && <span>📞 {sel.phone}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        <button onClick={shareClientWhatsApp}
                            className="px-3 py-1.5 text-xs rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20">📱 WhatsApp</button>
                        <button onClick={() => {
                            setShowReNeg(true); setEditNegId(null);
                            if (activeRates) setRR({ ...activeRates }); else setRR(defaultRates());
                            setRDN(today()); setRDA(""); setRN("");
                        }} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                            🔄 Renegociar
                        </button>
                        <button onClick={() => handleDeleteClient(sel.id)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">🗑️</button>
                    </div>
                </div>

                {activeRates && (
                    <div className="glass-card rounded-xl p-3 border border-emerald-500/20">
                        <h3 className="text-[10px] font-bold text-emerald-500 uppercase mb-2">✅ Taxas Vigentes (Aprovadas)</h3>
                        <RatesReadonly rates={activeRates} />
                    </div>
                )}

                {showReNeg && (
                    <div className="glass-card rounded-xl p-4 space-y-3 border border-blue-500/30">
                        <h3 className="text-[10px] font-bold text-blue-500 uppercase">🔄 Nova Renegociação</h3>
                        <RatesForm rates={rr} set={setRR} />
                        <DateFields dn={rdn} setDN={setRDN} da={rda} setDA={setRDA} />
                        <div>
                            <label className="text-[9px] text-muted-foreground uppercase block mb-px">📝 Observações</label>
                            <textarea value={rn} onChange={(e) => setRN(e.target.value)} rows={2} placeholder="Motivo..."
                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground resize-none" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddReNeg} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500">💾 Registrar</button>
                            <button onClick={() => setShowReNeg(false)} className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-xs">Cancelar</button>
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">📜 Histórico ({sel.negotiations.length})</h3>
                    <div className="space-y-2">
                        {sel.negotiations.map((neg, idx) => {
                            const isEditing = editNegId === neg.id;
                            return (
                                <div key={neg.id} className={`glass-card rounded-xl p-3 ${idx === 0 ? "ring-1 ring-emerald-500/20" : ""}`}>
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-bold text-amber-500 uppercase">✏️ Editando</h4>
                                                <button onClick={() => setEditNegId(null)} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                                            </div>
                                            <RatesForm rates={er} set={setER} />
                                            <DateFields dn={edn} setDN={setEDN} da={eda} setDA={setEDA} />
                                            <textarea value={en} onChange={(e) => setEN(e.target.value)} rows={2} placeholder="Obs..."
                                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-xs resize-none" />
                                            <button onClick={handleSaveEditNeg}
                                                className="w-full py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500">💾 Salvar</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <StatusBadge s={neg.status} />
                                                    {idx === 0 && <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">RECENTE</span>}
                                                </div>
                                                <div className="flex gap-1 flex-wrap">
                                                    {neg.status === "pendente" && (
                                                        <>
                                                            <button onClick={() => handleNegStatus(neg.id, "aceita")}
                                                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">✅ Aceitar</button>
                                                            <button onClick={() => handleNegStatus(neg.id, "recusada")}
                                                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20">❌ Recusar</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => startEditNeg(neg)}
                                                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">✏️ Editar</button>
                                                    {sel.negotiations.length > 1 && (
                                                        <button onClick={() => handleDeleteNeg(neg.id)}
                                                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20">🗑️</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 text-[10px] mb-2">
                                                <span className="text-muted-foreground">📅 {fmtDate(neg.dateNeg)}</span>
                                                <span className="text-muted-foreground">✅ {neg.dateAccept ? fmtDate(neg.dateAccept) : "Pendente"}</span>
                                            </div>
                                            <RatesReadonly rates={neg.rates} />
                                            {neg.notes && <p className="text-[10px] text-muted-foreground mt-2 italic border-t border-border pt-1.5">📝 {neg.notes}</p>}
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
