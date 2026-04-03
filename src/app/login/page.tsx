"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Shield } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-4 border-[#00A868] border-t-transparent animate-spin" /></div>}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotMsg, setForgotMsg] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const host = window.location.hostname;
        setIsAdmin(host.startsWith('admin.') || host === 'admin.localhost');

        // Check for oauth errors
        const urlError = searchParams.get("error");
        if (urlError) {
            const attemptedEmail = searchParams.get("email");
            if (urlError === "not_found") {
                setError(`A conta para ${attemptedEmail || 'este email'} não possui um cadastro ativo.`);
            } else if (urlError === "org_disabled") {
                setError("Sua organização foi desativada. Contate o suporte.");
            } else if (urlError === "denied") {
                setError("O login com Google foi cancelado.");
            } else {
                setError("Falha na autenticação via Google.");
            }
            // Clear URL gracefully
            router.replace("/login");
        }
    }, [searchParams, router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Erro ao fazer login");
                return;
            }
            router.push(isAdmin ? "/admin" : "/dashboard");
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }

    async function handleForgot(e: React.FormEvent) {
        e.preventDefault();
        setForgotMsg("");
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (res.ok) {
                setForgotMsg(data.message || "Se o email existir, uma nova senha será enviada.");
            } else {
                setError(data.error || "Erro ao solicitar recuperação");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#00A868]/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#00A868]/5 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00A868]/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md mx-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    {isAdmin ? (
                        <>
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-slate-900/30">
                                <Shield className="w-10 h-10 text-[#00A868]" />
                            </div>
                            <h1 className="text-3xl font-bold text-foreground">BitTask <span className="text-[#00A868]">Admin</span></h1>
                            <p className="text-muted-foreground mt-2 text-sm">
                                Painel Administrativo — Acesso restrito
                            </p>
                        </>
                    ) : (
                        <>
                            <Image src="/logo.png" alt="BitTask" width={80} height={80} className="mx-auto mb-4" priority />
                            <h1 className="text-3xl font-bold gradient-text">BitTask</h1>
                            <p className="text-muted-foreground mt-2 text-sm">
                                Gestão inteligente de negociações & propostas
                            </p>
                        </>
                    )}
                </div>

                {/* Login / Forgot Password Card */}
                <div className="card-elevated p-8">
                    {forgotMode ? (
                        /* Forgot Password Form */
                        <form onSubmit={handleForgot} className="space-y-5">
                            <div className="text-center mb-2">
                                <p className="text-lg font-semibold text-foreground">🔒 Esqueceu a senha?</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Digite seu email de acesso e enviaremos uma nova senha temporária.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#00A868] focus:border-transparent transition-all duration-200"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            {forgotMsg && (
                                <div className="p-3 bg-[#00A868]/10 border border-[#00A868]/20 rounded-xl text-[#00A868] text-sm text-center">
                                    ✅ {forgotMsg}
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-3.5 rounded-xl bg-[#00A868] text-white font-semibold
                                    hover:bg-[#008f58] active:scale-[0.98] disabled:opacity-60
                                    transition-all duration-200 shadow-lg shadow-[#00A868]/20">
                                {loading ? "Enviando..." : "📧 Enviar Nova Senha"}
                            </button>

                            <button type="button" onClick={() => { setForgotMode(false); setForgotMsg(""); setError(""); }}
                                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                                ← Voltar ao login
                            </button>
                        </form>
                    ) : (
                        /* Login Form */
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#00A868] focus:border-transparent transition-all duration-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-4 pr-12 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#00A868] focus:border-transparent transition-all duration-200"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all p-1.5 rounded-lg"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-3.5 rounded-xl bg-[#00A868] text-white font-semibold text-base
                                    hover:bg-[#008f58] active:scale-[0.98]
                                    disabled:opacity-60 disabled:cursor-not-allowed
                                    transition-all duration-200 shadow-lg shadow-[#00A868]/20">
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Entrando...
                                    </span>
                                ) : "Entrar"}
                            </button>

                            {!isAdmin && (
                                <>
                                    <div className="relative py-2 flex items-center">
                                        <div className="flex-grow border-t border-border"></div>
                                        <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">Ou</span>
                                        <div className="flex-grow border-t border-border"></div>
                                    </div>

                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setLoading(true);
                                            window.location.href = "/api/auth/google";
                                        }}
                                        disabled={loading}
                                        className="w-full py-3.5 rounded-xl bg-white text-gray-700 font-semibold text-base
                                            border border-gray-200 hover:bg-gray-50 active:scale-[0.98]
                                            disabled:opacity-60 disabled:cursor-not-allowed
                                            transition-all duration-200 shadow-sm flex items-center justify-center gap-3">
                                        <svg viewBox="0 0 24 24" className="w-5 h-5">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Continuar com Google
                                    </button>
                                </>
                            )}

                            <button type="button" onClick={() => { setForgotMode(true); setError(""); }}
                                className="w-full text-sm text-muted-foreground hover:text-[#00A868] transition-colors mt-2">
                                Esqueceu a senha?
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6">
                    {isAdmin ? (
                        <span>🔐 Acesso exclusivo para administradores <span className="font-semibold text-foreground">BKaiser Solution</span></span>
                    ) : (
                        <span>Powered by <span className="font-semibold text-foreground">BKaiser Solution</span></span>
                    )}
                </p>
            </div>
        </div>
    );
}
