"use client";

import { useState, useEffect } from "react";
import {
    Settings, User, Lock, Save, Loader2,
    CheckCircle, AlertCircle, Calendar, ExternalLink, Unlink
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

    // Google Calendar state
    const [gcalConnected, setGcalConnected] = useState(false);
    const [gcalConfigured, setGcalConfigured] = useState(false);
    const [gcalLoading, setGcalLoading] = useState(true);
    const [gcalDisconnecting, setGcalDisconnecting] = useState(false);

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

        // Check Google Calendar status
        fetch("/api/google-calendar/status")
            .then((r) => r.json())
            .then((d) => {
                setGcalConnected(d.connected);
                setGcalConfigured(d.configured);
            })
            .catch(() => {})
            .finally(() => setGcalLoading(false));

        // Check for callback query params
        const params = new URLSearchParams(window.location.search);
        const gcalStatus = params.get("gcal");
        if (gcalStatus === "connected") {
            setMsg({ type: "ok", text: "✅ Google Calendar conectado com sucesso!" });
            setGcalConnected(true);
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
        } else if (gcalStatus === "denied") {
            setMsg({ type: "err", text: "Acesso ao Google Calendar negado." });
            window.history.replaceState({}, "", window.location.pathname);
        } else if (gcalStatus === "error") {
            setMsg({ type: "err", text: "Erro ao conectar Google Calendar. Tente novamente." });
            window.history.replaceState({}, "", window.location.pathname);
        }
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

    const handleGcalDisconnect = async () => {
        if (!confirm("Desconectar Google Calendar? Tarefas existentes não serão afetadas, mas novas tarefas não serão sincronizadas.")) return;
        setGcalDisconnecting(true);
        try {
            await fetch("/api/google-calendar/disconnect", { method: "POST" });
            setGcalConnected(false);
            setMsg({ type: "ok", text: "Google Calendar desconectado." });
        } catch {
            setMsg({ type: "err", text: "Erro ao desconectar." });
        } finally {
            setGcalDisconnecting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#00A868]" />
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
                <div className="w-10 h-10 rounded-xl bg-[#00A868] flex items-center justify-center shadow-lg shadow-[#00A868]/20">
                    <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Configurações</h1>
                    <p className="text-xs text-muted-foreground">Gerencie seu perfil, segurança e integrações</p>
                </div>
            </div>

            {/* Message */}
            {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                    msg.type === "ok"
                        ? "bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20"
                        : "bg-red-500/10 text-red-600 border border-red-500/20"
                }`}>
                    {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* ═══ Google Calendar Integration ═══ */}
            <div className="card-elevated p-6">
                <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#00A868]/10 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-[#00A868]" />
                    </div>
                    Integrações
                </h2>

                <div className={`rounded-xl border p-4 ${gcalConnected ? 'border-[#00A868]/30 bg-[#00A868]/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Google Calendar Icon */}
                            <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center shrink-0 shadow-sm">
                                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                                    <rect x="3" y="4" width="18" height="17" rx="2" stroke="#4285f4" strokeWidth="1.5" fill="white"/>
                                    <path d="M3 8h18" stroke="#4285f4" strokeWidth="1.5"/>
                                    <circle cx="8" cy="4" r="1.5" fill="#ea4335"/>
                                    <circle cx="16" cy="4" r="1.5" fill="#ea4335"/>
                                    <rect x="6" y="11" width="3" height="2.5" rx="0.5" fill="#34a853"/>
                                    <rect x="10.5" y="11" width="3" height="2.5" rx="0.5" fill="#fbbc04"/>
                                    <rect x="15" y="11" width="3" height="2.5" rx="0.5" fill="#4285f4"/>
                                    <rect x="6" y="15" width="3" height="2.5" rx="0.5" fill="#fbbc04"/>
                                    <rect x="10.5" y="15" width="3" height="2.5" rx="0.5" fill="#ea4335"/>
                                    <rect x="15" y="15" width="3" height="2.5" rx="0.5" fill="#34a853"/>
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    Google Calendar
                                    {gcalConnected && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00A868]/10 text-[#00A868] border border-[#00A868]/20">
                                            <CheckCircle className="w-2.5 h-2.5" /> Conectado
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {gcalConnected
                                        ? "Tarefas com data serão sincronizadas automaticamente com seu Google Calendar."
                                        : "Conecte para sincronizar tarefas automaticamente com o Google Calendar."}
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0">
                            {gcalLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            ) : gcalConnected ? (
                                <button
                                    onClick={handleGcalDisconnect}
                                    disabled={gcalDisconnecting}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                >
                                    {gcalDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                                    Desconectar
                                </button>
                            ) : (
                                <a
                                    href="/api/google-calendar/auth"
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#00A868] text-white hover:bg-[#008f58] transition-colors shadow-lg shadow-[#00A868]/20"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> Conectar com Google
                                </a>
                            )}
                        </div>
                    </div>

                    {gcalConnected && (
                        <div className="mt-3 pt-3 border-t border-[#00A868]/10 grid grid-cols-3 gap-2">
                            <div className="text-center">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Sync</p>
                                <p className="text-xs font-bold text-[#00A868]">Automático</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Direção</p>
                                <p className="text-xs font-bold text-foreground">BitTask → Google</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Eventos</p>
                                <p className="text-xs font-bold text-foreground">Tarefas c/ data</p>
                            </div>
                        </div>
                    )}

                    {!gcalConfigured && !gcalLoading && (
                        <p className="text-[11px] text-amber-500 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Google Calendar API não configurada no servidor. Configure GOOGLE_CLIENT_ID no .env
                        </p>
                    )}
                </div>
            </div>

            {/* Profile Section */}
            <div className="card-elevated p-6">
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
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-muted-foreground font-medium mb-1">Telefone</label>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="(00) 00000-0000"
                                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 transition-colors"
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
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground font-medium mb-1">Email de notificação (opcional — alertas de renegociação)</label>
                        <input
                            type="email"
                            value={notifEmail}
                            onChange={(e) => setNotifEmail(e.target.value)}
                            placeholder="Deixe vazio para usar o email de acesso"
                            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-[#00A868] hover:bg-[#008f58] text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? "Salvando..." : "Salvar Dados"}
                    </button>
                </div>
            </div>

            {/* Change Password */}
            <div className="card-elevated p-6">
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

