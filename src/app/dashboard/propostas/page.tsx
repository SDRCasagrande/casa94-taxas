"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/calculator";
import { FileText, Plus, Save, Trash2, Calendar, Building2, TrendingUp, FolderOpen } from "lucide-react";

interface SavedProposal {
    id: string;
    clienteNome: string;
    clienteCNPJ: string;
    tpv: number;
    economy: number;
    savedAt: string;
}

const PROPOSALS_KEY = "bitkaiser_proposals_history";
const PROPOSTA_KEY = "bitkaiser_proposta";

export default function MinhasPropostasPage() {
    const [proposals, setProposals] = useState<SavedProposal[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(PROPOSALS_KEY);
            if (saved) {
                setProposals(JSON.parse(saved));
            }
        } catch { /* ignore */ }
    }, []);

    function saveCurrentProposal() {
        try {
            const current = localStorage.getItem(PROPOSTA_KEY);
            if (!current) return;
            const d = JSON.parse(current);
            const newProposal: SavedProposal = {
                id: Date.now().toString(),
                clienteNome: d.clienteNome || "Sem nome",
                clienteCNPJ: d.clienteCNPJ || "",
                tpv: d.tpv || 0,
                economy: 0,
                savedAt: new Date().toISOString(),
            };
            const updated = [newProposal, ...proposals];
            setProposals(updated);
            localStorage.setItem(PROPOSALS_KEY, JSON.stringify(updated));
        } catch { /* ignore */ }
    }

    function removeProposal(id: string) {
        const updated = proposals.filter((p) => p.id !== id);
        setProposals(updated);
        localStorage.setItem(PROPOSALS_KEY, JSON.stringify(updated));
    }

    return (
        <div className="max-w-4xl mx-auto space-y-5 pb-20 lg:pb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00A868] flex items-center justify-center text-white shadow-lg shadow-[#00A868]/20">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Minhas Propostas</h1>
                        <p className="text-xs text-muted-foreground">
                            {proposals.length} proposta{proposals.length !== 1 ? "s" : ""} salva{proposals.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={saveCurrentProposal}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-[#00A868]/10 text-[#00A868] hover:bg-[#00A868]/20 transition-colors font-semibold"
                    >
                        <Save className="w-3.5 h-3.5" /> Salvar Atual
                    </button>
                    <Link
                        href="/dashboard/proposta"
                        className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-[#00A868] text-white hover:bg-[#008f58] transition-colors shadow-lg shadow-[#00A868]/20 font-semibold"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nova Proposta
                    </Link>
                </div>
            </div>

            {/* Proposals List */}
            {proposals.length === 0 ? (
                <div className="card-elevated p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#00A868]/10 flex items-center justify-center">
                        <FolderOpen className="w-8 h-8 text-[#00A868]/40" />
                    </div>
                    <p className="font-semibold text-foreground">Nenhuma proposta salva</p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                        Crie uma proposta no workspace e salve aqui para consultar depois.
                    </p>
                    <Link
                        href="/dashboard/proposta"
                        className="inline-flex items-center gap-2 mt-5 px-6 py-2.5 text-sm rounded-xl bg-[#00A868] text-white hover:bg-[#008f58] transition-colors font-semibold shadow-lg shadow-[#00A868]/20"
                    >
                        <Plus className="w-4 h-4" /> Criar Proposta
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    {proposals.map((proposal) => (
                        <div
                            key={proposal.id}
                            className="card-elevated rounded-xl p-4 flex items-center gap-3 hover:border-[#00A868]/30 transition-all group"
                        >
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-[#00A868]/10 flex items-center justify-center shrink-0">
                                <FileText className="w-4.5 h-4.5 text-[#00A868]" />
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                    {proposal.clienteNome}
                                </p>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                    {proposal.clienteCNPJ && (
                                        <span className="flex items-center gap-0.5">
                                            <Building2 className="w-3 h-3" /> {proposal.clienteCNPJ}
                                        </span>
                                    )}
                                    {proposal.tpv > 0 && (
                                        <span className="flex items-center gap-0.5 text-[#00A868] font-medium">
                                            <TrendingUp className="w-3 h-3" /> {formatCurrency(proposal.tpv)}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-0.5">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(proposal.savedAt).toLocaleDateString("pt-BR")}
                                    </span>
                                </div>
                            </div>
                            {/* Actions */}
                            <button
                                onClick={() => removeProposal(proposal.id)}
                                className="p-2 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                                title="Excluir proposta"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
