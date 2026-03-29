"use client";

import { useState, useEffect } from "react";
import {
    Settings, User, Lock, Save, Loader2,
    CheckCircle, AlertCircle
} from "lucide-react";

export default function ConfiguracoesPage() {
    const [profile, setProfile] = useState<{
        name: string;
        email: string;
        phone: string;
        notificationEmail: string;
    } | null>(null);
    const [name, setName] = useState("");
    const [loginEmail, setLoginEmail] = useState("");
    const [phone, setPhone] = useState("");
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
                setName(d.name || "");
                setLoginEmail(d.email || "");
                setPhone(d.phone || "");
                setNotifEmail(d.notificationEmail || "");
            })
            .finally(() => setLoading(false));
    }, []);

    const saveProfile = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email: loginEmail, phone, notificationEmail: notifEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                setProfile(data);
                setMsg({ type: "ok", text: "Dados atualizados com sucesso!" });
                // Reload page to force sidebar to re-read the refreshed JWT cookie
                setTimeout(() => window.location.reload(), 800);
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

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
    );
    if (!profile) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-red-500 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Erro ao carregar perfil</p>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Configurações</h1>
                    <p className="text-xs text-muted-foreground">Gerencie seu perfil e segurança</p>
                </div>
            </div>

            {/* Message */}
            {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                    msg.type === "ok"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                }`}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* Profile Section */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    Meus Dados
                </h2>
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-muted-foreground font-medium mb-1">Nome</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Seu nome"
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-muted-foreground font-medium mb-1">Telefone</label>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="(00) 00000-0000"
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground font-medium mb-1">Email de acesso (login + recuperação de senha)</label>
                        <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="seu-email@empresa.com"
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground font-medium mb-1">Email de notificação (opcional — alertas de renegociação)</label>
                        <input
                            type="email"
                            value={notifEmail}
                            onChange={(e) => setNotifEmail(e.target.value)}
                            placeholder="Deixe vazio para usar o email de acesso"
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? "Salvando..." : "Salvar Dados"}
                    </button>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    Alterar Senha
                </h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-muted-foreground font-medium mb-1">Senha atual</label>
                        <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-amber-500/50 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground font-medium mb-1">Nova senha</label>
                        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-amber-500/50 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground font-medium mb-1">Confirmar nova senha</label>
                        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-amber-500/50 transition-colors" />
                    </div>
                    <button onClick={savePassword} disabled={saving || !currentPw || !newPw}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 mt-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {saving ? "Alterando..." : "Alterar Senha"}
                    </button>
                </div>
            </div>
        </div>
    );
}
