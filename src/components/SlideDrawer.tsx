"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface SlideDrawerProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    width?: "sm" | "md" | "lg" | "xl";
    children: React.ReactNode;
}

const WIDTHS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };

export default function SlideDrawer({ open, onClose, title, subtitle, width = "lg", children }: SlideDrawerProps) {
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) { setVisible(true); setClosing(false); }
    }, [open]);

    useEffect(() => {
        if (!open && visible) {
            setClosing(true);
            const t = setTimeout(() => { setVisible(false); setClosing(false); }, 250);
            return () => clearTimeout(t);
        }
    }, [open, visible]);

    // ESC to close
    useEffect(() => {
        if (!visible) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [visible, onClose]);

    // Lock body scroll
    useEffect(() => {
        if (visible) { document.body.style.overflow = "hidden"; }
        return () => { document.body.style.overflow = ""; };
    }, [visible]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[90] flex justify-end" onClick={onClose}>
            {/* Backdrop */}
            <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${closing ? "opacity-0 transition-opacity duration-200" : "backdrop-enter"}`} />

            {/* Panel */}
            <div
                ref={panelRef}
                onClick={e => e.stopPropagation()}
                className={`relative w-full ${WIDTHS[width]} h-full bg-card border-l border-border shadow-2xl flex flex-col ${closing ? "slide-drawer-exit" : "slide-drawer-enter"}`}
            >
                {/* Header */}
                {(title || subtitle) && (
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 gap-3">
                        <div className="min-w-0 flex-1">
                            {title && <h2 className="text-base font-bold text-foreground truncate">{title}</h2>}
                            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Close button if no header */}
                {!title && !subtitle && (
                    <button onClick={onClose} className="absolute top-3 right-3 z-10 p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
