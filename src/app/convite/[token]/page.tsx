"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertTriangle, Lock, User, Eye, EyeOff } from "lucide-react";

export default function ConvitePage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;

    const [invite, setInvite] = useState<{ email: string; role: string; orgName: string } | null>(null);
    const [error, setError] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetch(`/api/auth/invite/${token}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) setError(data.error);
                else setInvite(data);
            })
            .catch(() => setError("Erro ao validar convite"))
            .finally(() => setLoading(false));
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("As senhas não coincidem");
            return;
        }
        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const res = await fetch("/api/auth/accept-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, name, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Erro ao criar conta");
                return;
            }
            setSuccess(true);
            setTimeout(() => router.push("/login"), 2000);
        } catch {
            setError("Erro de conexão");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
                <Loader2 className="w-8 h-8 animate-spin text-[#00A868]" />
            </div>
        );
    }

    if (error && !invite) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
                <div className="card-elevated rounded-2xl p-8 max-w-md w-full text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h1 className="text-xl font-bold text-foreground">Convite Inválido</h1>
                    <p className="text-muted-foreground">{error}</p>
                    <button onClick={() => router.push("/login")} className="btn-primary px-6 py-2 rounded-xl text-sm">
                        Ir para Login
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
                <div className="card-elevated rounded-2xl p-8 max-w-md w-full text-center space-y-4">
                    <CheckCircle2 className="w-12 h-12 text-[#00A868] mx-auto" />
                    <h1 className="text-xl font-bold text-foreground">Conta Criada!</h1>
                    <p className="text-muted-foreground">Redirecionando para o login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
            <div className="card-elevated rounded-2xl p-8 max-w-md w-full space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00A868] to-[#00D084] flex items-center justify-center mx-auto">
                        <User className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground">Criar Conta</h1>
                    <p className="text-sm text-muted-foreground">
                        Você foi convidado para <span className="font-semibold text-[#00A868]">{invite?.orgName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                        Cargo: <span className="font-medium">{invite?.role === 'admin' ? 'Administrador' : 'Agente'}</span>
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-500 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email (readonly) */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                        <input
                            type="email"
                            value={invite?.email || ""}
                            readOnly
                            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm opacity-60"
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome completo</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Seu nome"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:border-[#00A868] focus:ring-1 focus:ring-[#00A868] transition-colors"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:border-[#00A868] focus:ring-1 focus:ring-[#00A868] transition-colors pr-10"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirmar senha</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repita a senha"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:border-[#00A868] focus:ring-1 focus:ring-[#00A868] transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00A868] to-[#00D084] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#00A868]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {submitting ? "Criando conta..." : "Criar Conta e Entrar"}
                    </button>
                </form>
            </div>
        </div>
    );
}
