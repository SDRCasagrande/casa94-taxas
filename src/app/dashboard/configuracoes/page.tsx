"use client";

import { useState, useEffect } from "react";

export default function ConfiguracoesPage() {
    const [profile, setProfile] = useState<{
        name: string;
        email: string;
        notificationEmail: string;
    } | null>(null);
    const [loginEmail, setLoginEmail] = useState("");
    const [notifEmail, setNotifEmail] = useState("");
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    useEffect(() => {
        fetch("/api/user/profile")
            .then((r) => r.json())
            .then((d) => {
                setProfile(d);
                setLoginEmail(d.email || "");
                setNotifEmail(d.notificationEmail || "");
            })
            .finally(() => setLoading(false));
    }, []);

    const saveEmails = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail, notificationEmail: notifEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                setProfile(data);
                setMsg({ type: "ok", text: "Dados atualizados com sucesso!" });
            } else {
                setMsg({ type: "err", text: data.error || "Erro ao salvar" });
            }
        } catch {
            setMsg({ type: "err", text: "Erro de conexão" });
        } finally {
            setSaving(false);
        }
    };

    const savePassword = async () => {
        if (newPw !== confirmPw) {
            setMsg({ type: "err", text: "Senhas não conferem" });
            return;
        }
        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: "ok", text: "Senha alterada com sucesso!" });
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
            } else {
                setMsg({ type: "err", text: data.error || "Erro ao alterar senha" });
            }
        } catch {
            setMsg({ type: "err", text: "Erro de conexão" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-400">Carregando...</div>;
    if (!profile) return <div className="p-8 text-red-400">Erro ao carregar perfil</div>;

    return (
        <div className="p-4 md:p-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">⚙️ Configurações</h1>

            {msg && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.type === "ok" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                    {msg.text}
                </div>
            )}

            {/* Profile Info */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">👤 Perfil</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Nome</label>
                        <div className="px-4 py-2.5 bg-gray-700/50 rounded-xl text-gray-300">{profile.name}</div>
                    </div>
                </div>
            </div>

            {/* Email Settings */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-2">📧 Emails</h2>
                <p className="text-sm text-gray-400 mb-4">
                    O email de acesso é usado para login e para receber a senha recuperada.
                    O email de notificação (opcional) recebe os alertas de renegociação — se vazio, usa o de acesso.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Email de acesso (login)</label>
                        <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="seu-email@empresa.com"
                            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Email de notificação (opcional — deixe vazio para usar o de acesso)</label>
                        <input
                            type="email"
                            value={notifEmail}
                            onChange={(e) => setNotifEmail(e.target.value)}
                            placeholder="outro-email@gmail.com (opcional)"
                            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                    <button
                        onClick={saveEmails}
                        disabled={saving}
                        className="w-full px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? "Salvando..." : "💾 Salvar Emails"}
                    </button>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4">🔒 Alterar Senha</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Senha atual</label>
                        <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Nova senha</label>
                        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Confirmar nova senha</label>
                        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <button onClick={savePassword} disabled={saving || !currentPw || !newPw}
                        className="w-full px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 mt-2">
                        {saving ? "Alterando..." : "🔒 Alterar Senha"}
                    </button>
                </div>
            </div>
        </div>
    );
}
