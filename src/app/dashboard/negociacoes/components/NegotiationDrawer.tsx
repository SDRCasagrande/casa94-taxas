"use client";

import { useState, useEffect, useRef } from "react";
import { formatPercent, calculateCET } from "@/lib/calculator";
import { RI } from "@/components/rate-input";
import { MessageSquare, CalendarPlus, FileDown, ArrowRight, Trash2, Send, Clock } from "lucide-react";
import { generateProposalPDF } from "@/lib/proposal-pdf";
import SlideDrawer from "@/components/SlideDrawer";
import { StageBadge } from "./StageBadge";
import {
    RateSnapshot, getLeadAge, getStage, normalizeStatus,
    fmtDate, fmtDateTime, gcalLink, shareWhatsApp, STAGES
} from "./types";

export function NegotiationDrawer({ neg, onClose, onChangeStage, onDeleteNeg, loadAll }: {
    neg: any;
    onClose: () => void;
    onChangeStage: (negId: string, newStatus: string) => Promise<void>;
    onDeleteNeg: (negId: string) => Promise<void>;
    loadAll: () => void;
}) {
    const [editingRates, setEditingRates] = useState(false);
    const [drawerRates, setDrawerRates] = useState<RateSnapshot | null>(null);
    const [savingRates, setSavingRates] = useState(false);
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    // Comments
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [sendingComment, setSendingComment] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (neg?.id) {
            setLoadingComments(true);
            setComments([]);
            setEditingRates(false);
            setDrawerRates(null);
            fetch(`/api/negotiations/${neg.id}/comments`)
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setComments(data); })
                .catch(() => {})
                .finally(() => setLoadingComments(false));
        }
    }, [neg?.id]);

    async function sendComment() {
        if (!neg || !commentText.trim()) return;
        setSendingComment(true);
        try {
            const res = await fetch(`/api/negotiations/${neg.id}/comments`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: commentText.trim() }),
            });
            if (res.ok) {
                const c = await res.json();
                setComments(prev => [...prev, c]);
                setCommentText("");
                setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
        } catch { /* */ }
        setSendingComment(false);
    }

    return (
        <SlideDrawer
            open={!!neg}
            onClose={onClose}
            title={neg?.clientName || ""}
            subtitle={neg?.stoneCode ? `SC: ${neg.stoneCode}` : neg?.cnpj || ""}
        >
            {neg && (
                <div className="p-5 space-y-5">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                        <StageBadge status={neg.status} />
                        {(() => {
                            const age = getLeadAge(neg);
                            return age.label ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    age.level === "warm" ? "bg-amber-500/10 text-amber-500"
                                    : age.level === "hot" ? "bg-red-500/10 text-red-500"
                                    : age.level === "cold" ? "bg-indigo-500/10 text-indigo-400"
                                    : ""
                                }`}>{age.label}</span>
                            ) : null;
                        })()}
                    </div>

                    {/* Client Info */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dados do Cliente</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-secondary rounded-xl p-3">
                                <p className="text-[9px] text-muted-foreground uppercase">CNPJ</p>
                                <p className="text-xs font-bold text-foreground">{neg.cnpj || "—"}</p>
                            </div>
                            <div className="bg-secondary rounded-xl p-3">
                                <p className="text-[9px] text-muted-foreground uppercase">Telefone</p>
                                <p className="text-xs font-bold text-foreground">{neg.clientPhone || "—"}</p>
                            </div>
                            <div className="bg-secondary rounded-xl p-3">
                                <p className="text-[9px] text-muted-foreground uppercase">Data Negociação</p>
                                <p className="text-xs font-bold text-foreground">{fmtDate(neg.dateNeg)}</p>
                            </div>
                            {neg.assignee && (
                                <div className="bg-secondary rounded-xl p-3">
                                    <p className="text-[9px] text-muted-foreground uppercase">Responsável</p>
                                    <p className="text-xs font-bold text-foreground">{neg.assignee.name}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rates Summary — Editable */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxas Negociadas</h4>
                            {!editingRates ? (
                                <button onClick={() => { setEditingRates(true); setDrawerRates({ ...neg.rates }); }}
                                    className="text-[10px] font-bold text-[#00A868] hover:text-[#008f58] transition-colors px-2 py-1 rounded-lg hover:bg-[#00A868]/10 touch-target">
                                    ✏️ Editar
                                </button>
                            ) : (
                                <div className="flex gap-1">
                                    <button onClick={async () => {
                                        if (!drawerRates) return;
                                        setSavingRates(true);
                                        try {
                                            await fetch(`/api/negotiations/${neg.id}`, {
                                                method: "PUT", headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ rates: drawerRates })
                                            });
                                            neg.rates = { ...drawerRates };
                                            setEditingRates(false);
                                            loadAll();
                                            setMsg({ type: "ok", text: "Taxas atualizadas!" });
                                        } catch { setMsg({ type: "err", text: "Erro ao salvar" }); }
                                        setSavingRates(false);
                                    }} disabled={savingRates}
                                        className="text-[10px] font-bold text-white bg-[#00A868] hover:bg-[#008f58] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                                        {savingRates ? "Salvando..." : "Salvar"}
                                    </button>
                                    <button onClick={() => { setEditingRates(false); setDrawerRates(null); }}
                                        className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { l: "Débito", k: "debit" },
                                { l: "Créd 1x", k: "credit1x" },
                                { l: "2-6x", k: "credit2to6" },
                                { l: "7-12x", k: "credit7to12" },
                                { l: "PIX", k: "pix" },
                                { l: "RAV", k: "rav" },
                            ].map(r => {
                                const val = editingRates && drawerRates
                                    ? (drawerRates as any)[r.k === "rav" ? "ravRate" : r.k] ?? (drawerRates as any)[r.k] ?? 0
                                    : r.k === "rav" ? (neg.rates.ravRate ?? neg.rates.rav) : neg.rates[r.k];
                                return (
                                    <div key={r.l} className={`rounded-xl p-2.5 text-center border transition-all ${
                                        editingRates ? "bg-card border-[#00A868]/30" : "bg-[#00A868]/5 border-[#00A868]/10"
                                    }`}>
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">{r.l}</p>
                                        {editingRates && drawerRates ? (
                                            <input type="number" step="0.01" value={val}
                                                onChange={e => {
                                                    const key = r.k === "rav" ? "ravRate" : r.k;
                                                    setDrawerRates(prev => prev ? { ...prev, [key]: parseFloat(e.target.value) || 0, ...(r.k === "rav" ? { rav: parseFloat(e.target.value) || 0 } : {}) } : prev);
                                                }}
                                                className="w-full text-center text-sm font-black text-[#00A868] bg-transparent focus:outline-none border-b border-[#00A868]/30 pb-0.5" />
                                        ) : (
                                            <p className="text-sm font-black text-[#00A868]">{formatPercent(val)}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CET Block */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            📊 Custo Efetivo Total (CET)
                        </h4>
                        {(() => {
                            const rates = editingRates && drawerRates ? drawerRates : neg.rates;
                            const ravVal = rates.ravRate ?? rates.rav ?? 0;
                            const cetRows = [
                                { label: "Débito", mdr: rates.debit, parcelas: 1 },
                                { label: "Créd 1x", mdr: rates.credit1x, parcelas: 1 },
                                { label: "Créd 2x", mdr: rates.credit2to6, parcelas: 2 },
                                { label: "Créd 6x", mdr: rates.credit2to6, parcelas: 6 },
                                { label: "Créd 12x", mdr: rates.credit7to12, parcelas: 12 },
                            ];
                            return (
                                <div className="rounded-xl border border-border overflow-hidden">
                                    <div className="grid grid-cols-4 gap-0 text-center bg-secondary/50 py-1.5">
                                        <span className="text-[8px] font-bold uppercase text-muted-foreground">Modalidade</span>
                                        <span className="text-[8px] font-bold uppercase text-muted-foreground">MDR</span>
                                        <span className="text-[8px] font-bold uppercase text-muted-foreground">RAV</span>
                                        <span className="text-[8px] font-bold uppercase text-[#00A868]">CET</span>
                                    </div>
                                    {cetRows.map(row => {
                                        const cet = calculateCET(row.mdr, ravVal, row.parcelas);
                                        return (
                                            <div key={row.label} className="grid grid-cols-4 gap-0 text-center py-2 border-t border-border/50 hover:bg-muted/30 transition-colors">
                                                <span className="text-[10px] font-semibold text-foreground">{row.label}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">{formatPercent(row.mdr)}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">{formatPercent(ravVal)}</span>
                                                <span className="text-[10px] font-black text-[#00A868]">{formatPercent(cet)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Stage History */}
                    {neg.stageHistory && neg.stageHistory.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Histórico</h4>
                            <div className="space-y-1">
                                {[...neg.stageHistory].reverse().map((h: any, i: number) => {
                                    const st = getStage(h.to || h.status);
                                    return (
                                        <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-secondary/50 min-w-0">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                                            <span className="text-xs font-medium text-foreground shrink-0">{st.label}</span>
                                            <span className="text-[10px] text-muted-foreground ml-auto truncate min-w-0">
                                                {fmtDateTime(h.timestamp)}
                                                {h.userName && ` · ${h.userName}`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {neg.notes && (
                        <div className="space-y-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observação Inicial</h4>
                            <p className="text-xs text-foreground bg-secondary rounded-xl p-3 whitespace-pre-wrap break-words italic">{neg.notes}</p>
                        </div>
                    )}

                    {/* Chat / Documentation */}
                    <div className="space-y-2 pt-2 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Documentação da Equipe
                        </h4>

                        <div className="max-h-48 overflow-y-auto space-y-2 py-1">
                            {loadingComments ? (
                                <p className="text-[10px] text-muted-foreground text-center py-3">Carregando...</p>
                            ) : comments.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground/50 text-center py-4 italic">Nenhuma atualização ainda. Documente o progresso desta negociação.</p>
                            ) : (
                                comments.map(c => (
                                    <div key={c.id} className="flex gap-2 items-start">
                                        <div className="w-6 h-6 rounded-full bg-[#00A868]/20 text-[#00A868] flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">
                                            {c.user?.name?.charAt(0) || "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-[10px] font-bold text-foreground">{c.user?.name?.split(" ")[0] || "Usuário"}</span>
                                                <span className="text-[9px] text-muted-foreground/50">
                                                    {new Date(c.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-foreground/80 mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={commentsEndRef} />
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                                placeholder="Documentar atualização..."
                                className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#00A868]/50"
                            />
                            <button
                                onClick={sendComment}
                                disabled={sendingComment || !commentText.trim()}
                                className="px-3 py-2.5 rounded-xl bg-[#00A868] text-white text-xs font-bold hover:bg-[#008f58] transition-colors disabled:opacity-40 shrink-0 touch-target">
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-2 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ações</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { shareWhatsApp(neg); onClose(); }}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00A868]/10 text-[#00A868] text-xs font-bold hover:bg-[#00A868]/20 transition-colors touch-target">
                                <MessageSquare className="w-4 h-4" /> WhatsApp
                            </button>
                            <a href={gcalLink(neg)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 text-blue-500 text-xs font-bold hover:bg-blue-500/20 transition-colors touch-target">
                                <CalendarPlus className="w-4 h-4" /> Agendar
                            </a>
                            <button onClick={() => {
                                generateProposalPDF(
                                    { name: neg.clientName, stoneCode: neg.stoneCode, cnpj: neg.cnpj, phone: neg.clientPhone },
                                    neg,
                                    "Agente"
                                );
                                onClose();
                            }} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500/20 transition-colors touch-target">
                                <FileDown className="w-4 h-4" /> Exportar PDF
                            </button>
                            {normalizeStatus(neg.status) !== "fechado" && normalizeStatus(neg.status) !== "recusado" && (
                                <button onClick={() => {
                                    const idx = STAGES.findIndex(s => s.id === normalizeStatus(neg.status));
                                    if (idx < STAGES.length - 2) { onChangeStage(neg.id, STAGES[idx + 1].id); onClose(); }
                                }} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-muted transition-colors touch-target">
                                    <ArrowRight className="w-4 h-4" /> Avançar Etapa
                                </button>
                            )}
                        </div>

                        <div className="pt-2">
                            <select
                                value={normalizeStatus(neg.status)}
                                onChange={e => { onChangeStage(neg.id, e.target.value); onClose(); }}
                                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-xs font-medium focus:outline-none">
                                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>

                        <button onClick={() => { onDeleteNeg(neg.id); onClose(); }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500/20 transition-colors mt-2 touch-target">
                            <Trash2 className="w-4 h-4" /> Excluir Negociação
                        </button>
                    </div>

                    {/* Success/Error message */}
                    {msg && (
                        <div className={`p-2.5 rounded-xl text-xs font-medium text-center ${msg.type === "ok" ? "bg-[#00A868]/10 text-[#00A868]" : "bg-red-500/10 text-red-500"}`}>
                            {msg.text}
                        </div>
                    )}
                </div>
            )}
        </SlideDrawer>
    );
}
