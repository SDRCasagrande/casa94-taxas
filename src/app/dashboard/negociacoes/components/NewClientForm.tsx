"use client";

import { useState } from "react";
import { DocumentInput } from "@/components/DocumentInput";
import { PhoneInput } from "@/components/PhoneInput";
import { ChevronLeft } from "lucide-react";
import { RatesForm } from "./StageBadge";
import { RateSnapshot, UserOption, defaultRates, today } from "./types";

export function NewClientForm({ users, onSave, onCancel }: {
    users: UserOption[];
    onSave: (data: { name: string; stoneCode: string; cnpj: string; phone: string; email: string; rates: RateSnapshot; dateNeg: string; notes: string; assigneeId?: string }) => void;
    onCancel: () => void;
}) {
    const [fn, setFN] = useState(""); const [fsc, setFSC] = useState(""); const [fcnpj, setFCNPJ] = useState("");
    const [fph, setFPH] = useState(""); const [fem, setFEM] = useState("");
    const [fRates, setFRates] = useState<RateSnapshot>(defaultRates());
    const [fDateN, setFDateN] = useState(today()); const [fNotes, setFNotes] = useState("");
    const [fAssignee, setFAssignee] = useState("");

    async function handleCnpjFetch(data: { name?: string; fantasia?: string; telefone?: string; email?: string }) {
        if (data.name && !fn.trim()) setFN(data.fantasia || data.name);
        if (data.telefone && !fph.trim()) setFPH(data.telefone);
        if (data.email && !fem.trim()) setFEM(data.email.toLowerCase());
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-10">
            <div className="flex items-center gap-3">
                <button onClick={onCancel} className="p-2 rounded-lg hover:bg-muted touch-target"><ChevronLeft className="w-5 h-5" /></button>
                <h1 className="text-lg font-bold text-foreground">Novo Cliente + Negociação</h1>
            </div>
            <div className="card-elevated p-4 sm:p-5 space-y-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Dados do Cliente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Nome / Razão Social *</label>
                        <input value={fn} onChange={e => setFN(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    <div className="sm:col-span-2 lg:col-span-1"><label className="text-xs font-medium text-muted-foreground block mb-1">CNPJ/CPF</label>
                        <DocumentInput value={fcnpj} onChange={setFCNPJ} onCNPJData={handleCnpjFetch} allowBypass /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Stone Code</label>
                        <input value={fsc} onChange={e => setFSC(e.target.value)} placeholder="123456" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Telefone</label>
                        <PhoneInput value={fph} onChange={setFPH} /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">E-mail</label>
                        <input value={fem} onChange={e => setFEM(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                </div>
            </div>
            <div className="bg-card border border-[#00A868]/20 rounded-2xl p-4 sm:p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#00A868] uppercase tracking-wider">Taxas Negociadas</h3>
                <RatesForm rates={fRates} set={setFRates} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data Negociação</label>
                        <input type="date" value={fDateN} onChange={e => setFDateN(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none [color-scheme:dark]" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Responsável</label>
                        <select value={fAssignee} onChange={e => setFAssignee(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none">
                            <option value="">Selecione...</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select></div>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Observações</label>
                    <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} placeholder="Detalhes..." className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm resize-none focus:outline-none" /></div>
            </div>
            <button onClick={() => {
                if (!fn.trim()) return;
                onSave({ name: fn, stoneCode: fsc, cnpj: fcnpj, phone: fph, email: fem, rates: fRates, dateNeg: fDateN, notes: fNotes, assigneeId: fAssignee || undefined });
            }} disabled={!fn.trim()} className="w-full py-3.5 rounded-xl bg-[#00A868] text-white font-bold hover:bg-[#008f58] disabled:opacity-50 shadow-lg shadow-[#00A868]/20 active:scale-[0.98] transition-all">Salvar e Adicionar ao Pipeline</button>
        </div>
    );
}
