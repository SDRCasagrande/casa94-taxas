"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
    { href: "/dashboard", label: "Início", icon: "🏠" },
    { href: "/dashboard/cet", label: "Calculador CET", icon: "🧮" },
    { href: "/dashboard/proposta", label: "Simulador", icon: "📊" },
    { href: "/dashboard/comparativo", label: "Comparação", icon: "📋" },
    { href: "/dashboard/negociacoes", label: "Negociações", icon: "🤝" },
    { href: "/dashboard/configuracoes", label: "Configurações", icon: "⚙️" },
    { href: "/dashboard/usuarios", label: "Usuários", icon: "👥" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((d) => {
                if (d.user) setUser(d.user);
            })
            .catch(() => { });
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    const currentNav = NAV_ITEMS.find((item) => item.href === pathname);

    return (
        <div className="min-h-screen bg-background flex text-foreground">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-card border-r border-border z-50
          flex flex-col transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                {/* Logo */}
                <div className="p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
                            <span className="text-lg font-black text-white">BK</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-foreground">BitKaiser</h1>
                            <p className="text-xs text-muted-foreground -mt-0.5">Taxas & Propostas</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                                        ? "bg-gradient-to-r from-emerald-500/20 to-blue-500/10 text-emerald-500 dark:text-emerald-400 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                <span>{item.label}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-border">
                    {user && (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-sm font-bold text-emerald-500">
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                    >
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h2 className="text-lg font-semibold text-foreground">
                            {currentNav?.icon} {currentNav?.label || "Dashboard"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6 overflow-y-auto">{children}</main>
            </div>
        </div>
    );
}
