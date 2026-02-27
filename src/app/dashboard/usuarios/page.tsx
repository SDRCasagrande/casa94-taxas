"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
    id: string;
    name: string;
    email: string;
    notificationEmail: string;
    isAdmin: boolean;
    isActive: boolean;
    createdAt: string;
}

export default function UsuariosPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPw, setNewPw] = useState("");
    const [newNotifEmail, setNewNotifEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [resetId, setResetId] = useState<string | null>(null);
    const [resetPw, setResetPw] = useState("");

    const load = useCallback(() => {
        fetch("/api/admin/users")
            .then((r) => r.json())
            .then((d) => { if (Array.isArray(d)) setUsers(d); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const createUser = async () => {
        if (!newName.trim() || !newEmail.trim() || !newPw) {
            setMsg({ type: "err", text: "Preencha nome, email e senha" });
            return;
        }
        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, email: newEmail, password: newPw, notificationEmail: newNotifEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: "ok", text: `Usuário ${data.name} criado!` });
                setShowNew(false);
                setNewName(""); setNewEmail(""); setNewPw(""); setNewNotifEmail("");
                load();
            } else {
                setMsg({ type: "err", text: data.error || "Erro ao criar" });
            }
        } catch { setMsg({ type: "err", text: "Erro de conexão" }); }
        finally { setSaving(false); }
    };

    const toggleActive = async (user: User) => {
        try {
            await fetch(`/api/admin/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !user.isActive }),
            });
            load();
        } catch { setMsg({ type: "err", text: "Erro ao alterar status" }); }
    };

    const resetPassword = async () => {
        if (!resetId || !resetPw || resetPw.length < 6) {
            setMsg({ type: "err", text: "Senha deve ter no mínimo 6 caracteres" });
            return;
        }
        try {
            const res = await fetch(`/api/admin/users/${resetId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: resetPw }),
            });
            if (res.ok) {
                setMsg({ type: "ok", text: "Senha resetada!" });
                setResetId(null);
                setResetPw("");
            }
        } catch { setMsg({ type: "err", text: "Erro ao resetar senha" }); }
    };

    const deleteUser = async (id: string, name: string) => {
        if (!confirm(`Excluir ${name}? Todos os dados serão perdidos!`)) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) { setMsg({ type: "ok", text: "Usuário excluído" }); load(); }
            else setMsg({ type: "err", text: data.error || "Erro" });
        } catch { setMsg({ type: "err", text: "Erro de conexão" }); }
    };

    if (loading) return <div className="p-8 text-gray-400">Carregando...</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">👥 Gerenciar Usuários</h1>
                <button onClick={() => setShowNew(!showNew)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors">
                    {showNew ? "✕ Cancelar" : "➕ Novo Usuário"}
                </button>
            </div>

            {msg && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.type === "ok" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                    {msg.text}
                </div>
            )}

            {/* New User Form */}
            {showNew && (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Criar Novo Usuário</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Nome *</label>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)}
                                placeholder="João Silva" className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Email de login *</label>
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="joao@casa94.com" className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Senha *</label>
                            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                                placeholder="Mínimo 6 caracteres" className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Email de notificação</label>
                            <input type="email" value={newNotifEmail} onChange={(e) => setNewNotifEmail(e.target.value)}
                                placeholder="joao@gmail.com (opcional)" className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50" />
                        </div>
                    </div>
                    <button onClick={createUser} disabled={saving}
                        className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50">
                        {saving ? "Criando..." : "✅ Criar Usuário"}
                    </button>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetId && (
                <div className="bg-gray-800/50 border border-amber-500/30 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-3">🔒 Resetar Senha — {users.find(u => u.id === resetId)?.name}</h2>
                    <div className="flex gap-3">
                        <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
                            placeholder="Nova senha (mín. 6 caracteres)" className="flex-1 px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50" />
                        <button onClick={resetPassword} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors">Salvar</button>
                        <button onClick={() => { setResetId(null); setResetPw(""); }} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">✕</button>
                    </div>
                </div>
            )}

            {/* Users List */}
            <div className="space-y-3">
                {users.map((user) => (
                    <div key={user.id} className={`bg-gray-800/50 border rounded-2xl p-4 transition-colors ${user.isActive ? "border-gray-700/50" : "border-red-500/20 opacity-60"}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${user.isActive ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}`}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-white">{user.name}</p>
                                        {!user.isActive && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Inativo</span>}
                                    </div>
                                    <p className="text-xs text-gray-400">{user.email}</p>
                                    {user.notificationEmail && (
                                        <p className="text-[10px] text-gray-500">📧 {user.notificationEmail}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => toggleActive(user)}
                                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${user.isActive ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>
                                    {user.isActive ? "Desativar" : "Ativar"}
                                </button>
                                <button onClick={() => { setResetId(user.id); setResetPw(""); }}
                                    className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                                    🔒 Senha
                                </button>
                                <button onClick={() => deleteUser(user.id, user.name)}
                                    className="px-3 py-1.5 text-xs rounded-lg font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-xs text-gray-500 mt-6 text-center">
                Total: {users.length} usuários • {users.filter(u => u.isActive).length} ativos
            </p>
        </div>
    );
}
