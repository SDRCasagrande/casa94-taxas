"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
    LayoutDashboard, Calculator, FileBarChart, GitCompare,
    Handshake, Settings, Users, LogOut, Menu, X, ChevronRight,
    Bell, Search, MoreHorizontal
} from "lucide-react";

/* ═══ Navigation Items ═══ */
const NAV_ITEMS = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard, mobileLabel: "Início" },
    { href: "/dashboard/cet", label: "Calculador CET", icon: Calculator, mobileLabel: "CET" },
    { href: "/dashboard/proposta", label: "Simulador", icon: FileBarChart, mobileLabel: "Simulador" },
    { href: "/dashboard/comparativo", label: "Comparação", icon: GitCompare, mobileLabel: "Comparar" },
    { href: "/dashboard/negociacoes", label: "Negociações", icon: Handshake, mobileLabel: "Negociações" },
    { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
    { href: "/dashboard/usuarios", label: "Usuários", icon: Users },
];

// Bottom nav shows first 4 + "More" overflow
const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 4);
const OVERFLOW_ITEMS = NAV_ITEMS.slice(4);

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((d) => { if (d.user) setUser(d.user); })
            .catch(() => { });
    }, []);

    // Close menus on route change
    useEffect(() => {
        setSidebarOpen(false);
        setMoreOpen(false);
    }, [pathname]);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    const currentNav = NAV_ITEMS.find((item) => item.href === pathname);
    const isOverflowActive = OVERFLOW_ITEMS.some(item => pathname === item.href);

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* ═══ Mobile Sidebar Overlay ═══ */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ═══ Sidebar ═══ */}
            <aside
                className={`fixed top-0 left-0 h-screen w-[280px] bg-card border-r border-border z-50
                    flex flex-col transition-transform duration-300 ease-out
                    lg:translate-x-0 lg:sticky
                    ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
            >
                {/* Logo Header */}
                <div className="h-16 flex items-center justify-between px-5 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="text-sm font-black text-white">BK</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-sm text-foreground leading-tight">BitKaiser</h1>
                            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Taxas & Propostas</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors lg:hidden"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Menu Principal
                    </p>
                    {NAV_ITEMS.slice(0, 5).map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                    ${isActive
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/15"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                    isActive
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                                }`}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <span>{item.label}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                )}
                            </Link>
                        );
                    })}

                    <div className="pt-4 pb-2">
                        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Administração
                        </p>
                    </div>
                    {NAV_ITEMS.slice(5).map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                    ${isActive
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/15"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                    isActive
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                                }`}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile Footer */}
                <div className="p-3 border-t border-border space-y-2 shrink-0">
                    {user && (
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10 flex items-center justify-center text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-h-screen lg:ml-[280px]">
                {/* ═══ Top Bar ═══ */}
                <header className="sticky top-0 z-30 h-14 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors lg:hidden"
                        >
                            <Menu className="w-5 h-5 text-muted-foreground" />
                        </button>

                        {/* Page title with breadcrumb */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="hidden sm:inline text-muted-foreground font-medium">BitKaiser</span>
                            <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground/40" />
                            <h2 className="font-semibold text-foreground flex items-center gap-2">
                                {currentNav && <currentNav.icon className="w-4 h-4 text-emerald-500" />}
                                {currentNav?.label || "Dashboard"}
                            </h2>
                        </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {user && (
                            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-border">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* ═══ Page Content ═══ */}
                <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-y-auto">
                    {children}
                </main>
            </div>

            {/* ═══ Mobile Bottom Nav ═══ */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border lg:hidden safe-area-bottom">
                <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
                    {BOTTOM_NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1.5 rounded-xl transition-all duration-200
                                    ${isActive
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <div className={`p-1.5 rounded-lg transition-all ${
                                    isActive ? "bg-emerald-500/10 shadow-sm" : ""
                                }`}>
                                    <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                                </div>
                                <span className={`text-[10px] font-medium leading-none ${isActive ? "font-bold" : ""}`}>
                                    {item.mobileLabel || item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* More button */}
                    <div className="relative">
                        <button
                            onClick={() => setMoreOpen(!moreOpen)}
                            className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1.5 rounded-xl transition-all duration-200
                                ${isOverflowActive || moreOpen
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <div className={`p-1.5 rounded-lg transition-all ${
                                isOverflowActive ? "bg-emerald-500/10 shadow-sm" : ""
                            }`}>
                                <MoreHorizontal className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-medium leading-none">Mais</span>
                        </button>

                        {/* More dropdown */}
                        {moreOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                                <div className="absolute bottom-full right-0 mb-2 w-52 bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 overflow-hidden z-50">
                                    {OVERFLOW_ITEMS.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all
                                                    ${isActive
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                    }`}
                                            >
                                                <item.icon className="w-4 h-4" />
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                    <div className="border-t border-border">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sair
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </nav>
        </div>
    );
}
