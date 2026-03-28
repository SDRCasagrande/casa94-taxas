"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])
    if (!mounted) return <div className="w-20 h-9" />

    return (
        <div className="flex items-center gap-0.5 p-1 bg-muted/50 border border-border/50 rounded-xl">
            <button
                onClick={() => setTheme("light")}
                className={`p-2 rounded-lg text-sm font-medium transition-all duration-300 ${theme === "light"
                    ? "bg-white text-amber-500 shadow-sm shadow-amber-500/10"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                aria-label="Modo claro"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-lg text-sm font-medium transition-all duration-300 ${theme === "dark"
                    ? "bg-slate-700 text-slate-100 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                aria-label="Modo escuro"
            >
                <Moon className="w-4 h-4" />
            </button>
        </div>
    )
}
