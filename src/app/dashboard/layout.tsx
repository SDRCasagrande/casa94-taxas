"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard, Calculator, FileBarChart, GitCompare,
    Handshake, Settings, Users, LogOut, Menu, X, ChevronRight,
    CheckSquare, Briefcase, MoreHorizontal, Plus
} from "lucide-react";

/* ═══ Navigation Items ═══ */
const MAIN_NAV = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/dashboard/clientes", label: "Carteira", icon: Briefcase },
    { href: "/dashboard/negociacoes", label: "Pipeline", icon: Handshake },
    { href: "/dashboard/tarefas", label: "Tarefas", icon: CheckSquare },
];

const TOOLS_NAV = [
    { href: "/dashboard/cet", label: "CET", icon: Calculator },
    { href: "/dashboard/proposta", label: "Simulador", icon: FileBarChart },
    { href: "/dashboard/comparativo", label: "Comparação", icon: GitCompare },
];

const ADMIN_NAV = [
    { href: "/dashboard/usuarios", label: "Equipe", icon: Users },
];

const PERSONAL_NAV = [
    { href: "/dashboard/configuracoes", label: "Meu Perfil", icon: Settings },
];

const ALL_NAV = [...MAIN_NAV, ...TOOLS_NAV, ...ADMIN_NAV, ...PERSONAL_NAV];

/* ═══ Bottom Nav items (5 max for mobile) ═══ */
const BOTTOM_NAV = [
    { href: "/dashboard/negociacoes", label: "Propostas", icon: Handshake, type: "link" as const },
    { href: "/dashboard/tarefas", label: "Tarefas", icon: CheckSquare, type: "link" as const },
    { href: "#new", label: "Novo", icon: Plus, type: "fab" as const },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, type: "link" as const },
    { href: "#more", label: "Mais", icon: MoreHorizontal, type: "action" as const },
];

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

    const currentNav = ALL_NAV.find((item) => item.href === pathname);
    const isActive = (href: string) => pathname === href;

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* ═══ DESKTOP: Sidebar (lg+) ═══ */}
            <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-[260px] bg-card border-r border-border z-50 flex-col">
                {/* Logo Header */}
                <div className="h-16 flex items-center px-5 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center shadow-md shadow-[#00A868]/20">
                            <span className="text-sm font-black text-white">BT</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-sm text-foreground leading-tight">BitTask</h1>
                            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Gestão & Propostas</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Menu Principal
                    </p>
                    {MAIN_NAV.map((item) => (
                        <Link key={item.href} href={item.href}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                ${isActive(item.href)
                                    ? "bg-[#00A868]/10 text-[#00A868] shadow-sm border border-[#00A868]/15"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                isActive(item.href)
                                    ? "bg-[#00A868]/15 text-[#00A868]"
                                    : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                            }`}>
                                <item.icon className="w-4 h-4" />
                            </div>
                            <span>{item.label}</span>
                            {isActive(item.href) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00A868]" />}
                        </Link>
                    ))}

                    <div className="pt-4 pb-2">
                        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Ferramentas
                        </p>
                    </div>
                    {TOOLS_NAV.map((item) => (
                        <Link key={item.href} href={item.href}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                ${isActive(item.href)
                                    ? "bg-[#00A868]/10 text-[#00A868] shadow-sm border border-[#00A868]/15"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                isActive(item.href)
                                    ? "bg-[#00A868]/15 text-[#00A868]"
                                    : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                            }`}>
                                <item.icon className="w-4 h-4" />
                            </div>
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <div className="pt-4 pb-2">
                        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Administração
                        </p>
                    </div>
                    {ADMIN_NAV.map((item) => (
                        <Link key={item.href} href={item.href}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                ${isActive(item.href)
                                    ? "bg-[#00A868]/10 text-[#00A868] shadow-sm border border-[#00A868]/15"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                isActive(item.href)
                                    ? "bg-[#00A868]/15 text-[#00A868]"
                                    : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                            }`}>
                                <item.icon className="w-4 h-4" />
                            </div>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* User Profile Footer */}
                <div className="p-3 border-t border-border space-y-2 shrink-0">
                    {user && (
                        <Link href="/dashboard/configuracoes" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/80 transition-colors cursor-pointer group">
                            <div className="w-9 h-9 rounded-xl bg-[#00A868]/10 border border-[#00A868]/10 flex items-center justify-center text-sm font-bold text-[#00A868] shrink-0">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <Settings className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                        </Link>
                    )}
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 font-medium">
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="lg:ml-[260px] flex flex-col min-h-screen">
                {/* ═══ Top Bar ═══ */}
                <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
                    <div className="flex items-center gap-2">
                        {/* Mobile: Logo only */}
                        <div className="lg:hidden flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#00A868] flex items-center justify-center shadow-sm shadow-[#00A868]/20">
                                <span className="text-xs font-black text-white">BT</span>
                            </div>
                            <div>
                                <h2 className="font-bold text-sm text-foreground leading-tight">{currentNav?.label || "BitTask"}</h2>
                            </div>
                        </div>

                        {/* Desktop: Breadcrumb */}
                        <div className="hidden lg:flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground font-medium">BitTask</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                            <h2 className="font-semibold text-foreground flex items-center gap-2">
                                {currentNav && <currentNav.icon className="w-4 h-4 text-[#00A868]" />}
                                {currentNav?.label || "Dashboard"}
                            </h2>
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        {user && (
                            <Link href="/dashboard/configuracoes" className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#00A868]/10 flex items-center justify-center text-xs font-bold text-[#00A868]">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="hidden sm:inline text-sm font-medium text-foreground">{user.name.split(" ")[0]}</span>
                            </Link>
                        )}
                    </div>
                </header>

                {/* ═══ Page Content ═══ */}
                <main className="flex-1 p-4 lg:p-6 overflow-y-auto main-content">
                    {children}
                </main>
            </div>

            {/* ═══ MOBILE: Bottom Navigation Bar (< lg) ═══ */}
            <nav className="bottom-nav lg:hidden">
                <div className="flex items-center justify-around">
                    {BOTTOM_NAV.map((item) => {
                        if (item.type === "fab") {
                            return (
                                <Link key="fab" href="/dashboard/clientes"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        router.push("/dashboard/clientes?view=new");
                                    }}
                                    className="flex flex-col items-center justify-center -mt-5">
                                    <div className="w-14 h-14 rounded-full bg-[#00A868] flex items-center justify-center shadow-lg shadow-[#00A868]/30 active:scale-95 transition-transform">
                                        <Plus className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-[#00A868] mt-1">{item.label}</span>
                                </Link>
                            );
                        }
                        if (item.type === "action") {
                            return (
                                <button
                                    key="more"
                                    onClick={() => setMoreOpen(!moreOpen)}
                                    className={`bottom-nav-item ${moreOpen ? "active" : ""}`}
                                >
                                    <item.icon className="nav-icon" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        }
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`bottom-nav-item ${isActive(item.href) ? "active" : ""}`}
                            >
                                <item.icon className="nav-icon" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* ═══ MOBILE: "Mais" Drawer (tools + admin + logout) ═══ */}
            {moreOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
                        onClick={() => setMoreOpen(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden animate-slide-up safe-area-bottom">
                        <div className="bg-white rounded-t-3xl border-t border-border shadow-2xl p-5 pb-6 mx-auto max-w-lg">
                            {/* Drag handle */}
                            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Ferramentas</p>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {TOOLS_NAV.map((item) => (
                                    <Link key={item.href} href={item.href}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all touch-target
                                            ${isActive(item.href)
                                                ? "bg-[#00A868]/10 text-[#00A868]"
                                                : "bg-secondary text-muted-foreground hover:bg-muted"
                                            }`}>
                                        <item.icon className="w-5 h-5" />
                                        <span className="text-[11px] font-semibold">{item.label}</span>
                                    </Link>
                                ))}
                            </div>

                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Administração</p>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[...ADMIN_NAV, ...PERSONAL_NAV].map((item) => (
                                    <Link key={item.href} href={item.href}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all touch-target
                                            ${isActive(item.href)
                                                ? "bg-[#00A868]/10 text-[#00A868]"
                                                : "bg-secondary text-muted-foreground hover:bg-muted"
                                            }`}>
                                        <item.icon className="w-5 h-5" />
                                        <span className="text-[11px] font-semibold">{item.label}</span>
                                    </Link>
                                ))}
                            </div>

                            {/* User info + logout */}
                            <div className="border-t border-border pt-4 flex items-center justify-between">
                                {user && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#00A868]/10 flex items-center justify-center text-sm font-bold text-[#00A868]">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{user.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{user.email}</p>
                                        </div>
                                    </div>
                                )}
                                <button onClick={handleLogout}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-500 bg-red-50 hover:bg-red-100 font-medium transition-colors touch-target">
                                    <LogOut className="w-4 h-4" />
                                    Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
