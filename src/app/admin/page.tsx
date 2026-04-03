"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Building2, Users, Package, CreditCard, Plus, Search,
    ToggleLeft, ToggleRight, Loader2, LogOut, ChevronRight,
    DollarSign, TrendingUp, AlertCircle, CheckCircle2,
    Pencil, Trash2, X, Eye, Send, Activity
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Organization {
    id: string; name: string; slug: string; cnpj: string;
    phone: string; email: string; city: string; state: string;
    isActive: boolean; createdAt: string;
    _count: { users: number; clients: number; billings: number };
    subscriptions: { product: { name: string; slug: string; monthlyPrice: number }; isActive: boolean }[];
}

interface Product {
    id: string; name: string; slug: string; monthlyPrice: number;
    isActive: boolean; description: string;
    _count: { subscriptions: number };
}

interface Stats {
    totalOrgs: number; activeOrgs: number; totalUsers: number;
    totalProducts: number; mrr: number;
}

type Tab = "orgs" | "products" | "billing";

export default function AdminDashboard() {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("orgs");
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    // New org modal
    const [showNewOrg, setShowNewOrg] = useState(false);
    const [orgForm, setOrgForm] = useState({ name: "", slug: "", cnpj: "", email: "", phone: "", city: "", state: "" });
    const [adminEmail, setAdminEmail] = useState("");
    const [adminName, setAdminName] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const [oRes, pRes, sRes] = await Promise.all([
                fetch("/api/admin/orgs"),
                fetch("/api/admin/products"),
                fetch("/api/admin/stats"),
            ]);
            const oData = await oRes.json();
            const pData = await pRes.json();
            const sData = await sRes.json();
            if (Array.isArray(oData)) setOrgs(oData);
            if (Array.isArray(pData)) setProducts(pData);
            if (sData && !sData.error) setStats(sData);
        } catch { /* */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filteredOrgs = orgs.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.slug.toLowerCase().includes(search.toLowerCase()) ||
        o.email.toLowerCase().includes(search.toLowerCase())
    );

    const createOrg = async () => {
        if (!orgForm.name.trim() || !adminEmail.trim()) {
            setMsg({ type: "err", text: "Nome da org e email do admin são obrigatórios" });
            return;
        }
        setSaving(true); setMsg(null);
        try {
            const res = await fetch("/api/admin/orgs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...orgForm, adminEmail, adminName }),
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: "ok", text: `Organização ${data.name} criada! Admin receberá email.` });
                setShowNewOrg(false);
                setOrgForm({ name: "", slug: "", cnpj: "", email: "", phone: "", city: "", state: "" });
                setAdminEmail(""); setAdminName("");
                load();
            } else {
                setMsg({ type: "err", text: data.error || "Erro" });
            }
        } catch { setMsg({ type: "err", text: "Erro de conexão" }); } finally { setSaving(false); }
    };

    const toggleOrg = async (org: Organization) => {
        try {
            await fetch(`/api/admin/orgs/${org.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !org.isActive }),
            });
            load();
        } catch { /* */ }
    };

    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    };

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00A868]" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
            {/* Top Bar */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00A868] to-[#00D084] flex items-center justify-center">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-lg font-black tracking-tight leading-none pt-1">BitTask Admin</h1>
                            <p className="text-[10px] text-gray-400 mt-1 sm:mt-0">Super Admin Panel</p>
                        </div>
                    </div>
                    <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Organizações", value: stats.activeOrgs, sub: `${stats.totalOrgs} total`, icon: Building2, color: "from-blue-500 to-blue-600" },
                            { label: "Usuários", value: stats.totalUsers, icon: Users, color: "from-purple-500 to-purple-600" },
                            { label: "Produtos", value: stats.totalProducts, icon: Package, color: "from-amber-500 to-amber-600" },
                            { label: "MRR", value: `R$ ${stats.mrr.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: "from-[#00A868] to-[#00D084]" },
                        ].map((s, i) => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                                        <s.icon className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-xs text-gray-400">{s.label}</span>
                                </div>
                                <p className="text-xl font-black">{s.value}</p>
                                {s.sub && <p className="text-[10px] text-gray-500">{s.sub}</p>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit">
                    {([
                        { key: "orgs", label: "Organizações", icon: Building2 },
                        { key: "products", label: "Produtos", icon: Package },
                    ] as { key: Tab; label: string; icon: any }[]).map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-[#00A868] text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>
                            <t.icon className="w-3.5 h-3.5" /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Message */}
                {msg && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${msg.type === "ok" ? "bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                        {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {msg.text}
                        <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-3 h-3" /></button>
                    </div>
                )}

                {/* ─── ORGANIZATIONS TAB ─── */}
                {tab === "orgs" && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar organização..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:border-[#00A868]/50 transition-colors" />
                            </div>
                            <button onClick={() => setShowNewOrg(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00A868] to-[#00D084] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#00A868]/20 transition-all">
                                <Plus className="w-4 h-4" /> Nova Organização
                            </button>
                        </div>

                        {filteredOrgs.map(org => (
                            <div key={org.id} className={`bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-all ${!org.isActive ? "opacity-50" : ""}`}>
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                                            <h3 className="font-bold text-white pr-2">{org.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${org.isActive ? "bg-[#00A868]/10 text-[#00A868]" : "bg-red-500/10 text-red-400"}`}>
                                                    {org.isActive ? "Ativo" : "Inativo"}
                                                </span>
                                                <div className="sm:hidden">
                                                    <button onClick={() => toggleOrg(org)} title={org.isActive ? "Desativar" : "Ativar"} className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                                        {org.isActive ? <ToggleRight className="w-5 h-5 text-[#00A868]" /> : <ToggleLeft className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{org.slug} · {org.city}/{org.state}</p>
                                        {org.email && <p className="text-xs text-gray-500 mt-0.5">{org.email}</p>}

                                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {org._count.users} usuários</span>
                                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {org._count.clients} clientes</span>
                                        </div>

                                        {/* Active products */}
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {org.subscriptions.filter(s => s.isActive).map((s, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                                                    {s.product.name} · R$ {s.product.monthlyPrice.toFixed(2).replace('.', ',')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="hidden sm:flex items-center gap-1 shrink-0 mt-1">
                                        <button onClick={() => toggleOrg(org)} title={org.isActive ? "Desativar" : "Ativar"} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                            {org.isActive ? <ToggleRight className="w-5 h-5 text-[#00A868]" /> : <ToggleLeft className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredOrgs.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Nenhuma organização encontrada</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── PRODUCTS TAB ─── */}
                {tab === "products" && (
                    <div className="space-y-3">
                        {products.map(p => (
                            <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white">{p.name}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.isActive ? "bg-[#00A868]/10 text-[#00A868]" : "bg-red-500/10 text-red-400"}`}>
                                                {p.isActive ? "Ativo" : "Inativo"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>
                                        <p className="text-sm font-bold text-[#00A868] mt-1">R$ {p.monthlyPrice.toFixed(2).replace('.', ',')}/mês</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-white">{p._count.subscriptions}</p>
                                        <p className="text-[10px] text-gray-500">assinantes</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── NEW ORG MODAL ─── */}
            {showNewOrg && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">Nova Organização</h2>
                            <button onClick={() => setShowNewOrg(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-400 mb-1">Nome da empresa *</label>
                                <input value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="Ex: Casa94 Stone Xinguará" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">CNPJ</label>
                                <input value={orgForm.cnpj} onChange={e => setOrgForm({...orgForm, cnpj: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="00.000.000/0001-00" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                                <input value={orgForm.email} onChange={e => setOrgForm({...orgForm, email: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="contato@empresa.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Telefone</label>
                                <input value={orgForm.phone} onChange={e => setOrgForm({...orgForm, phone: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="(99) 99999-9999" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Cidade</label>
                                <input value={orgForm.city} onChange={e => setOrgForm({...orgForm, city: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">UF</label>
                                <input value={orgForm.state} onChange={e => setOrgForm({...orgForm, state: e.target.value})} maxLength={2} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="PA" />
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-3">
                            <h3 className="text-sm font-bold text-[#00A868]">Admin da Organização</h3>
                            <p className="text-xs text-gray-400">Este usuário receberá um email para definir sua senha e será o administrador inicial.</p>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Admin *</label>
                                <input value={adminName} onChange={e => setAdminName(e.target.value)} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="Nome completo" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Email do Admin *</label>
                                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white" placeholder="admin@empresa.com" />
                            </div>
                        </div>

                        <button onClick={createOrg} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00A868] to-[#00D084] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-[#00A868]/20 transition-all">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                            {saving ? "Criando..." : "Criar Organização"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
