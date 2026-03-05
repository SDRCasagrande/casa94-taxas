"use client";

import { useState, useEffect } from "react";

/**
 * Rate Input component — must be defined OUTSIDE of page components
 * to prevent React from unmounting/remounting on every state change,
 * which causes input focus loss.
 */
export function RI({ l, v, set }: { l: string; v: number; set: (n: number) => void }) {
    const [txt, setTxt] = useState(String(v));
    useEffect(() => { setTxt(String(v)); }, [v]);
    return (
        <div>
            <label className="text-[9px] text-muted-foreground uppercase block mb-px">{l}</label>
            <div className="relative">
                <input type="text" inputMode="decimal" value={txt}
                    onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(",", ".")); if (!isNaN(n)) set(n); }}
                    onBlur={() => { const n = parseFloat(txt.replace(",", ".")); if (!isNaN(n)) { set(n); setTxt(String(n)); } else { set(0); setTxt("0"); } }}
                    className="w-full px-1.5 py-1 rounded-md bg-secondary border border-border text-foreground text-[11px] font-medium text-right pr-4 focus:ring-1 focus:ring-emerald-500" />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">%</span>
            </div>
        </div>
    );
}
