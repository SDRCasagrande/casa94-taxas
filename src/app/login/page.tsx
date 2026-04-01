"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotMsg, setForgotMsg] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

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
            router.push("/dashboard");
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
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#00A868] shadow-lg glow-green mb-4">
                        <span className="text-3xl font-black text-white">BT</span>
                    </div>
                    <h1 className="text-3xl font-bold gradient-text">BitTask</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Gestão de negociações & propostas para agentes Stone
                    </p>
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

                            <button type="button" onClick={() => { setForgotMode(true); setError(""); }}
                                className="w-full text-sm text-muted-foreground hover:text-[#00A868] transition-colors">
                                Esqueceu a senha?
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6">
                    Powered by <span className="font-semibold text-foreground">BKaiser Solution</span>
                </p>
            </div>
        </div>
    );
}
