"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, UserPlus, X, ShieldCheck, ShieldOff, Shield,
    KeyRound, Trash2, Loader2, CheckCircle, AlertCircle,
    Mail, Plus, Save, ChevronDown, ChevronUp
} from "lucide-react";
import { PERMISSIONS, PermissionKey } from "@/lib/permissions";

interface User {
    id: string; name: string; email: string; notificationEmail: string;
    isAdmin: boolean; isActive: boolean; createdAt: string;
    roleId: string | null; role: { id: string; name: string } | null;
}
interface RolePermission { id: string; permission: string; }
interface Role {
    id: string; name: string; description: string;
    permissions: RolePermission[]; _count: { users: number };
}

type Tab = "equipe" | "cargos";

const PERM_GROUPS: Record<string, PermissionKey[]> = {
    "Ferramentas": ["dashboard.view", "cet.use", "simulator.use", "comparator.use", "tasks.use"],
    "Clientes & Negociações": ["clients.view", "clients.manage", "negotiations.view", "negotiations.manage"],
    "Administração": ["users.view", "users.manage", "roles.manage", "settings.view", "reports.export"],
};

export default function UsuariosPage() {
    const [tab, setTab] = useState<Tab>("equipe");
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    // Users state
    const [showNewUser, setShowNewUser] = useState(false);
    const [newName, setNewName] = useState(""); const [newEmail, setNewEmail] = useState("");
    const [newPw, setNewPw] = useState(""); const [newNotifEmail, setNewNotifEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [resetId, setResetId] = useState<string | null>(null);
    const [resetPw, setResetPw] = useState("");

    // Roles state
    const [showNewRole, setShowNewRole] = useState(false);
    const [roleName, setRoleName] = useState(""); const [roleDesc, setRoleDesc] = useState("");
    const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editPerms, setEditPerms] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        try {
            const [uRes, rRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/roles")]);
            const uData = await uRes.json(); const rData = await rRes.json();
            if (Array.isArray(uData)) setUsers(uData);
            if (Array.isArray(rData)) setRoles(rData);
        } catch { /* */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ─── User actions ───
    const createUser = async () => {
        if (!newName.trim() || !newEmail.trim() || !newPw) { setMsg({ type: "err", text: "Preencha nome, email e senha" }); return; }
        setSaving(true); setMsg(null);
        try {
            const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, email: newEmail, password: newPw, notificationEmail: newNotifEmail }) });
            const data = await res.json();
            if (res.ok) { setMsg({ type: "ok", text: `Usuário ${data.name} criado!` }); setShowNewUser(false); setNewName(""); setNewEmail(""); setNewPw(""); setNewNotifEmail(""); load(); }
            else setMsg({ type: "err", text: data.error || "Erro" });
        } catch { setMsg({ type: "err", text: "Erro de conexão" }); } finally { setSaving(false); }
    };
    const toggleActive = async (u: User) => { try { await fetch(`/api/admin/users/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !u.isActive }) }); load(); } catch { /* */ } };
    const assignRole = async (userId: string, roleId: string | null) => { try { await fetch(`/api/admin/users/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId }) }); load(); } catch { /* */ } };
    const resetPassword = async () => {
        if (!resetId || !resetPw || resetPw.length < 6) { setMsg({ type: "err", text: "Senha deve ter no mínimo 6 caracteres" }); return; }
        try { const res = await fetch(`/api/admin/users/${resetId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: resetPw }) }); if (res.ok) { setMsg({ type: "ok", text: "Senha resetada!" }); setResetId(null); setResetPw(""); } } catch { /* */ }
    };
    const deleteUser = async (id: string, name: string) => {
        if (!confirm(`Excluir ${name}? Todos os dados serão perdidos!`)) return;
        try { const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" }); const d = await res.json(); if (res.ok) { setMsg({ type: "ok", text: "Usuário excluído" }); load(); } else setMsg({ type: "err", text: d.error || "Erro" }); } catch { /* */ }
    };

    // ─── Role actions ───
    const createRole = async () => {
        if (!roleName.trim()) { setMsg({ type: "err", text: "Nome é obrigatório" }); return; }
        setSaving(true); setMsg(null);
        try {
            const res = await fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: roleName, description: roleDesc, permissions: [...rolePerms] }) });
            const d = await res.json();
            if (res.ok) { setMsg({ type: "ok", text: `Cargo "${d.name}" criado!` }); setShowNewRole(false); setRoleName(""); setRoleDesc(""); setRolePerms(new Set()); load(); }
            else setMsg({ type: "err", text: d.error || "Erro" });
        } catch { setMsg({ type: "err", text: "Erro de conexão" }); } finally { setSaving(false); }
    };
    const updateRole = async (role: Role) => {
        setSaving(true); setMsg(null);
        try { const res = await fetch(`/api/admin/roles/${role.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: role.name, description: role.description, permissions: [...editPerms] }) });
            if (res.ok) { setMsg({ type: "ok", text: `Cargo "${role.name}" atualizado!` }); setExpandedId(null); load(); } else { const d = await res.json(); setMsg({ type: "err", text: d.error || "Erro" }); }
        } catch { setMsg({ type: "err", text: "Erro" }); } finally { setSaving(false); }
    };
    const deleteRole = async (role: Role) => {
        if (!confirm(`Excluir o cargo "${role.name}"?`)) return;
        try { const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" }); const d = await res.json(); if (res.ok) { setMsg({ type: "ok", text: "Cargo excluído" }); load(); } else setMsg({ type: "err", text: d.error || "Erro" }); } catch { /* */ }
    };
    const toggleExpand = (role: Role) => { if (expandedId === role.id) { setExpandedId(null); return; } setExpandedId(role.id); setEditPerms(new Set(role.permissions.map(p => p.permission))); };
    const togglePerm = (set: Set<string>, setFn: (s: Set<string>) => void, perm: string) => { const n = new Set(set); if (n.has(perm)) n.delete(perm); else n.add(perm); setFn(n); };

    const PermGrid = ({ perms, setPerms }: { perms: Set<string>; setPerms: (s: Set<string>) => void }) => (
        <div className="space-y-4">
            {Object.entries(PERM_GROUPS).map(([group, keys]) => (
                <div key={group}>
                    <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2 tracking-wide">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {keys.map(key => (
                            <label key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${perms.has(key) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"}`}>
                                <input type="checkbox" checked={perms.has(key)} onChange={() => togglePerm(perms, setPerms, key)} className="sr-only" />
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${perms.has(key) ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"}`}>
                                    {perms.has(key) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                {PERMISSIONS[key]}
                            </label>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Equipe & Permissões</h1>
                        <p className="text-xs text-muted-foreground">{users.length} usuários · {roles.length} cargos</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
                <button onClick={() => setTab("equipe")} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === "equipe" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <Users className="w-4 h-4" /> Equipe
                </button>
                <button onClick={() => setTab("cargos")} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === "cargos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <Shield className="w-4 h-4" /> Cargos & Permissões
                </button>
            </div>

            {/* Message */}
            {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* ═══ TAB: EQUIPE ═══ */}
            {tab === "equipe" && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowNewUser(!showNewUser)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showNewUser ? "bg-muted text-muted-foreground" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"}`}>
                            {showNewUser ? <><X className="w-4 h-4" /> Cancelar</> : <><UserPlus className="w-4 h-4" /> Novo Usuário</>}
                        </button>
                    </div>

                    {showNewUser && (
                        <div className="bg-card border border-border rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-500" /> Criar Novo Usuário</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className="block text-xs text-muted-foreground font-medium mb-1">Nome *</label>
                                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João Silva" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50" /></div>
                                <div><label className="block text-xs text-muted-foreground font-medium mb-1">Email de login *</label>
                                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="joao@casa94.com" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50" /></div>
                                <div><label className="block text-xs text-muted-foreground font-medium mb-1">Senha *</label>
                                    <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50" /></div>
                                <div><label className="block text-xs text-muted-foreground font-medium mb-1">Email de notificação</label>
                                    <input type="email" value={newNotifEmail} onChange={(e) => setNewNotifEmail(e.target.value)} placeholder="joao@gmail.com (opcional)" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50" /></div>
                            </div>
                            <button onClick={createUser} disabled={saving} className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {saving ? "Criando..." : "Criar Usuário"}
                            </button>
                        </div>
                    )}

                    {resetId && (
                        <div className="bg-card border border-amber-500/20 rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-500" /> Resetar Senha — {users.find(u => u.id === resetId)?.name}</h2>
                            <div className="flex gap-3">
                                <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Nova senha (mín. 6 caracteres)" className="flex-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-amber-500/50" />
                                <button onClick={resetPassword} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium">Salvar</button>
                                <button onClick={() => { setResetId(null); setResetPw(""); }} className="p-2.5 bg-muted text-muted-foreground rounded-xl"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {users.map((user) => (
                            <div key={user.id} className={`bg-card border rounded-2xl p-4 transition-all ${user.isActive ? "border-border" : "border-red-500/20 opacity-60"}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${user.isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10" : "bg-red-500/10 text-red-500 border border-red-500/10"}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                                                {user.isAdmin && <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">Admin</span>}
                                                {user.role && <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold">{user.role.name}</span>}
                                                {!user.isActive && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">Inativo</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                                <select value={user.roleId || ""} onChange={e => assignRole(user.id, e.target.value || null)}
                                                    className="text-[11px] bg-transparent border border-border rounded-lg px-2 py-0.5 text-muted-foreground focus:outline-none focus:border-emerald-500/50 max-w-[130px]">
                                                    <option value="">Sem cargo</option>
                                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </div>
                                            {user.notificationEmail && <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Mail className="w-3 h-3" /> {user.notificationEmail}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={() => toggleActive(user)} className={`p-2 rounded-lg text-xs font-medium transition-all ${user.isActive ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"}`} title={user.isActive ? "Desativar" : "Ativar"}>
                                            {user.isActive ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => { setResetId(user.id); setResetPw(""); }} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" title="Resetar senha"><KeyRound className="w-4 h-4" /></button>
                                        <button onClick={() => deleteUser(user.id, user.name)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ TAB: CARGOS ═══ */}
            {tab === "cargos" && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowNewRole(!showNewRole)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showNewRole ? "bg-muted text-muted-foreground" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"}`}>
                            {showNewRole ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Cargo</>}
                        </button>
                    </div>

                    {showNewRole && (
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-500" /> Criar Novo Cargo</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className="block text-xs text-muted-foreground font-medium mb-1">Nome *</label>
                                    <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Ex: Consultor Sênior" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50" /></div>
                                <div><label className="block text-xs text-muted-foreground font-medium mb-1">Descrição</label>
                                    <input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="Breve descrição" className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50" /></div>
                            </div>
                            <PermGrid perms={rolePerms} setPerms={setRolePerms} />
                            <button onClick={createRole} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {saving ? "Criando..." : "Criar Cargo"}
                            </button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {roles.map((role) => (
                            <div key={role.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleExpand(role)}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10 flex items-center justify-center shrink-0"><Shield className="w-5 h-5" /></div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-semibold text-foreground">{role.name}</p>
                                                <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Users className="w-3 h-3" /> {role._count.users}</span>
                                                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{role.permissions.length} permissões</span>
                                            </div>
                                            {role.description && <p className="text-xs text-muted-foreground truncate">{role.description}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); deleteRole(role); }} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 className="w-4 h-4" /></button>
                                        {expandedId === role.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </div>
                                </div>
                                {expandedId === role.id && (
                                    <div className="p-4 pt-0 border-t border-border space-y-4">
                                        <PermGrid perms={editPerms} setPerms={setEditPerms} />
                                        <button onClick={() => updateRole(role)} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium disabled:opacity-50">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? "Salvando..." : "Salvar Permissões"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {roles.length === 0 && (
                            <div className="text-center py-16 text-muted-foreground"><Shield className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum cargo cadastrado. Crie o primeiro!</p></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
