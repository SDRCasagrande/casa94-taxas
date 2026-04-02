"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, UserPlus, X, ShieldCheck, ShieldOff, Shield,
    KeyRound, Trash2, Loader2, CheckCircle, AlertCircle,
    Mail, Send
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmModal";

interface User {
    id: string; name: string; email: string; notificationEmail: string;
    userRole: string; isActive: boolean; createdAt: string;
}

type Tab = "equipe" | "convites";

const ROLE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    super_admin: { label: "Super Admin", color: "text-purple-500 bg-purple-500/10", icon: ShieldCheck },
    admin: { label: "Admin", color: "text-amber-500 bg-amber-500/10", icon: Shield },
    agent: { label: "Agente", color: "text-blue-500 bg-blue-500/10", icon: Users },
};

export default function UsuariosPage() {
    const confirmAction = useConfirm();
    const [tab, setTab] = useState<Tab>("equipe");
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState("agent");

    // Invite state
    const [showInvite, setShowInvite] = useState(false);
    const [invEmail, setInvEmail] = useState("");
    const [invRole, setInvRole] = useState("agent");
    const [inviting, setInviting] = useState(false);

    // Reset password state
    const [resetId, setResetId] = useState<string | null>(null);
    const [resetPw, setResetPw] = useState("");

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (Array.isArray(data)) setUsers(data);
            // Get current user role from session
            const meRes = await fetch("/api/auth/me");
            const me = await meRes.json();
            if (me?.userRole) setCurrentUserRole(me.userRole);
        } catch { /* */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const canManage = currentUserRole === "admin" || currentUserRole === "super_admin";

    // ─── Actions ───
    const sendInvite = async () => {
        if (!invEmail.trim()) { setMsg({ type: "err", text: "Email é obrigatório" }); return; }
        setInviting(true); setMsg(null);
        try {
            const res = await fetch("/api/teams/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: invEmail, role: invRole }),
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: "ok", text: `Convite enviado para ${invEmail}!` });
                setShowInvite(false); setInvEmail(""); setInvRole("agent");
            } else {
                setMsg({ type: "err", text: data.error || "Erro" });
            }
        } catch { setMsg({ type: "err", text: "Erro de conexão" }); } finally { setInviting(false); }
    };

    const toggleActive = async (u: User) => {
        try {
            await fetch(`/api/admin/users/${u.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !u.isActive }),
            });
            load();
        } catch { /* */ }
    };

    const changeRole = async (userId: string, newRole: string) => {
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userRole: newRole }),
            });
            load();
        } catch { /* */ }
    };

    const resetPassword = async () => {
        if (!resetId || !resetPw || resetPw.length < 6) { setMsg({ type: "err", text: "Senha mínima: 6 caracteres" }); return; }
        try {
            const res = await fetch(`/api/admin/users/${resetId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: resetPw }),
            });
            if (res.ok) { setMsg({ type: "ok", text: "Senha resetada!" }); setResetId(null); setResetPw(""); }
        } catch { /* */ }
    };

    const deleteUser = async (u: User) => {
        const confirmed = await confirmAction({ title: "Remover membro", message: `Tem certeza que deseja remover ${u.name} da equipe?` });
        if (!confirmed) return;
        try { await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" }); load(); } catch { /* */ }
    };

    if (loading) return (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-6 h-6 animate-spin text-[#00A868]" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Equipe</h1>
                    <p className="text-sm text-muted-foreground">{users.length} membros</p>
                </div>
                {canManage && (
                    <button onClick={() => setShowInvite(true)} className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Convidar
                    </button>
                )}
            </div>

            {/* Message */}
            {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${msg.type === "ok" ? "bg-[#00A868]/10 text-[#00A868]" : "bg-red-500/10 text-red-500"}`}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-3 h-3" /></button>
                </div>
            )}

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="card-elevated rounded-2xl p-6 w-full max-w-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Convidar Membro</h2>
                            <button onClick={() => setShowInvite(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                            <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:border-[#00A868] transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Cargo</label>
                            <select value={invRole} onChange={e => setInvRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground">
                                <option value="agent">Agente</option>
                                <option value="admin">Administrador</option>
                            </select>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {invRole === "admin" ? "Pode convidar membros, resetar senhas e gerenciar equipe" : "Pode usar todas as ferramentas, mas não gerenciar equipe"}
                            </p>
                        </div>
                        <button onClick={sendInvite} disabled={inviting} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00A868] to-[#00D084] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {inviting ? "Enviando..." : "Enviar Convite"}
                        </button>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="card-elevated rounded-2xl p-6 w-full max-w-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Resetar Senha</h2>
                            <button onClick={() => { setResetId(null); setResetPw(""); }}><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground">Para: {users.find(u => u.id === resetId)?.name}</p>
                        <input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="Nova senha (mín. 6 chars)" className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground" />
                        <button onClick={resetPassword} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00A868] to-[#00D084] text-white font-semibold text-sm">
                            Resetar Senha
                        </button>
                    </div>
                </div>
            )}

            {/* Users List */}
            <div className="space-y-2">
                {users.map(u => {
                    const roleInfo = ROLE_LABELS[u.userRole] || ROLE_LABELS.agent;
                    const RoleIcon = roleInfo.icon;
                    return (
                        <div key={u.id} className={`card-elevated rounded-xl p-4 flex items-center gap-4 transition-all ${!u.isActive ? "opacity-50" : ""}`}>
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A868] to-[#00D084] flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm text-foreground">{u.name}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${roleInfo.color}`}>
                                        <RoleIcon className="w-2.5 h-2.5" /> {roleInfo.label}
                                    </span>
                                    {!u.isActive && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">Inativo</span>}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                            </div>

                            {/* Actions (admin only) */}
                            {canManage && u.userRole !== "super_admin" && (
                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Role toggle */}
                                    <select value={u.userRole} onChange={e => changeRole(u.id, e.target.value)} className="text-[10px] px-2 py-1 rounded-lg bg-muted/50 border border-border text-foreground">
                                        <option value="agent">Agente</option>
                                        <option value="admin">Admin</option>
                                    </select>

                                    {/* Toggle active */}
                                    <button onClick={() => toggleActive(u)} title={u.isActive ? "Desativar" : "Ativar"} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                                        {u.isActive ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                    </button>

                                    {/* Reset password */}
                                    <button onClick={() => setResetId(u.id)} title="Resetar senha" className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                                        <KeyRound className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete */}
                                    <button onClick={() => deleteUser(u)} title="Remover" className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
