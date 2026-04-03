"use client";

import { useState } from "react";
import { RI } from "@/components/rate-input";
import { BrandIcon } from "@/components/BrandIcons";
import { BrandSelectorModal } from "@/components/BrandSelectorModal";
import { RateSnapshot, defaultBrandRates, getStage, normalizeStatus } from "./types";

/* ═══ STATUS BADGE ═══ */
export function StageBadge({ status }: { status: string }) {
    const st = getStage(normalizeStatus(status));
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
        </span>
    );
}

/* ═══ RATES FORM ═══ */
export function RatesForm({ rates, set }: { rates: RateSnapshot; set: (r: RateSnapshot) => void }) {
    const [activeBrand, setActiveBrand] = useState("VISA/MASTER");
    const [showBrandModal, setShowBrandModal] = useState(false);
    const [enabledBrands, setEnabledBrands] = useState<Record<string, boolean>>(() => {
        const eb: Record<string, boolean> = {};
        Object.keys(rates.brandRates || defaultBrandRates()).forEach(b => eb[b] = ["VISA/MASTER", "ELO"].includes(b));
        return eb;
    });
    const br = rates.brandRates || defaultBrandRates();
    const cb = br[activeBrand] || { debit: rates.debit, credit1x: rates.credit1x, credit2to6: rates.credit2to6, credit7to12: rates.credit7to12 };
    function up(f: string, v: number) { const n = { ...br, [activeBrand]: { ...cb, [f]: v } }; const vm = n["VISA/MASTER"] || cb; set({ ...rates, brandRates: n, debit: vm.debit, credit1x: vm.credit1x, credit2to6: vm.credit2to6, credit7to12: vm.credit7to12 }); }

    function handleBrandClick(b: string) {
        const isEnabled = enabledBrands[b] !== false;
        if (isEnabled) {
            if (activeBrand === b) {
                setEnabledBrands(prev => ({ ...prev, [b]: false }));
                const next = Object.keys(br).find(k => k !== b && enabledBrands[k] !== false);
                if (next) setActiveBrand(next);
            } else {
                setActiveBrand(b);
            }
        } else {
            setEnabledBrands(prev => ({ ...prev, [b]: true }));
            setActiveBrand(b);
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] text-muted-foreground font-medium">Bandeiras Ativas</span>
                <button type="button" onClick={() => setShowBrandModal(true)}
                    className="text-[10px] font-bold text-[#00A868] hover:text-[#008f58] transition-colors">
                    + Gerenciar
                </button>
            </div>
            
            {showBrandModal && (
                <BrandSelectorModal
                    brands={Object.keys(br)}
                    enabledBrands={enabledBrands}
                    activeBrand={activeBrand}
                    onToggle={(b, enabled) => setEnabledBrands(prev => ({ ...prev, [b]: enabled }))}
                    onSelect={setActiveBrand}
                    onClose={() => setShowBrandModal(false)}
                />
            )}

            <div className="space-y-1.5">
                {Object.keys(br).map(b => {
                    const isEnabled = enabledBrands[b] !== false;
                    const isSelected = activeBrand === b && isEnabled;
                    const bRates = br[b];
                    return (
                        <div key={b} className={`rounded-xl transition-all overflow-hidden ${
                            isSelected
                                ? "bg-[#00A868]/5 border-2 border-[#00A868] shadow-sm shadow-[#00A868]/10"
                                : isEnabled
                                    ? "bg-[#00A868]/5 border border-[#00A868]/20"
                                    : "bg-secondary/30 border border-border/50"
                        }`}>
                            <div className="flex items-center gap-0 px-1.5 py-1.5">
                                <button type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isEnabled) {
                                            setEnabledBrands(prev => ({ ...prev, [b]: false }));
                                            if (activeBrand === b) {
                                                const next = Object.keys(br).find(k => k !== b && enabledBrands[k] !== false);
                                                if (next) setActiveBrand(next);
                                            }
                                        } else {
                                            setEnabledBrands(prev => ({ ...prev, [b]: true }));
                                            setActiveBrand(b);
                                        }
                                    }}
                                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold transition-all touch-target ${
                                        isEnabled
                                            ? "bg-[#00A868] text-white shadow-sm shadow-[#00A868]/30"
                                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    }`}>
                                    {isEnabled ? "✓" : "✗"}
                                </button>
                                <button type="button"
                                    onClick={() => { if (isEnabled) setActiveBrand(isSelected ? "" : b); }}
                                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${isEnabled ? "hover:bg-[#00A868]/5 cursor-pointer" : "cursor-default"}`}>
                                    <BrandIcon brand={b} size={14} />
                                    <span className={`text-xs font-bold truncate ${isEnabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>{b}</span>
                                </button>
                            </div>
                            
                            {isSelected && (
                                <div className="p-3 bg-card/60 border-t border-[#00A868]/20 space-y-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <RI l="Débito" v={bRates.debit} set={v => up("debit", v)} />
                                        <RI l="Crédito 1x" v={bRates.credit1x} set={v => up("credit1x", v)} />
                                        <RI l="2-6x" v={bRates.credit2to6} set={v => up("credit2to6", v)} />
                                        <RI l="7-12x" v={bRates.credit7to12} set={v => up("credit7to12", v)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                                        <RI l="PIX" v={rates.pix} set={v => set({ ...rates, pix: v })} />
                                        <RI l="RAV" v={rates.ravRate ?? rates.rav} set={v => set({ ...rates, ravRate: v, rav: v })} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
