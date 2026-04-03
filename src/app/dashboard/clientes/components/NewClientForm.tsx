"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { DocumentInput } from "@/components/DocumentInput";
import { PhoneInput } from "@/components/PhoneInput";
import { calcSafra } from "./types";

export function NewClientForm({ onSave, onCancel }: {
    onSave: (data: { name: string; stoneCode: string; cnpj: string; phone: string; email: string; segment: string; credentialDate: string; brand: string; safra: string; category: string }) => void;
    onCancel: () => void;
}) {
    const [fn, setFN] = useState(""); const [fsc, setFSC] = useState(""); const [fcnpj, setFCNPJ] = useState("");
    const [fbrand, setFBrand] = useState("STONE"); const [fBrandCustom, setFBrandCustom] = useState(""); const [fsafra, setFSafra] = useState("M0");
    const [fph, setFPH] = useState(""); const [fem, setFEM] = useState(""); const [fseg, setFSeg] = useState("");
    const [fcategory, setFCategory] = useState("");
    const [fcd, setFCD] = useState("");

    async function handleCnpjFetch(data: { name?: string; fantasia?: string; telefone?: string; email?: string; situacao?: string }) {
        if (data.name && !fn.trim()) setFN(data.fantasia || data.name);
        if (data.telefone && !fph.trim()) setFPH(data.telefone);
        if (data.email && !fem.trim()) setFEM(data.email.toLowerCase());
        if (data.situacao && !fseg.trim()) setFSeg(data.situacao);
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
                <button onClick={onCancel} className="p-2 rounded-xl hover:bg-muted touch-target"><ChevronLeft className="w-5 h-5" /></button>
                <h1 className="text-lg font-bold">Novo Cliente</h1>
            </div>
            <div className="card-elevated p-4 sm:p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Nome / Razão Social *</label>
                        <input value={fn} onChange={e => setFN(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Empresa *</label>
                        {fbrand === "__custom__" ? (
                            <div className="flex gap-2">
                                <input value={fBrandCustom} onChange={e => setFBrandCustom(e.target.value.toUpperCase())} placeholder="Nome da empresa" autoFocus
                                    className="flex-1 px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" />
                                <button type="button" onClick={() => { setFBrand("STONE"); setFBrandCustom(""); }} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted">✕</button>
                            </div>
                        ) : (
                            <select value={fbrand} onChange={e => setFBrand(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50">
                                <option value="STONE">Stone</option>
                                <option value="TON">Ton</option>
                                <option value="CERVANTES">Cervantes</option>
                                <option value="__custom__">+ Outra empresa...</option>
                            </select>
                        )}</div>
                        
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Safra Comercial {fcd && <span className="text-[9px] text-[#00A868] ml-1">(auto: {calcSafra(fcd)})</span>}</label>
                        <select value={fsafra} onChange={e => setFSafra(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50">
                            <option value="M0">M0 (Mês Inicial)</option>
                            <option value="M1">M1 (Mês Seguinte)</option>
                            <option value="M2">M2</option>
                            <option value="M3">M3</option>
                            <option value="BASE">Base Ativa</option>
                        </select></div>

                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Stone/Ton Code</label>
                        <input value={fsc} onChange={e => setFSC(e.target.value)} placeholder="123456" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">CNPJ/CPF</label>
                        <DocumentInput value={fcnpj} onChange={setFCNPJ} onCNPJData={handleCnpjFetch} allowBypass /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Telefone</label>
                        <PhoneInput value={fph} onChange={setFPH} /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">E-mail</label>
                        <input value={fem} onChange={e => setFEM(e.target.value)} placeholder="email@empresa.com" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Segmento</label>
                        <input value={fseg} onChange={e => setFSeg(e.target.value)} placeholder="Restaurante, Loja, etc." className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Categoria / Grupo</label>
                        <input value={fcategory} onChange={e => setFCategory(e.target.value)} placeholder="Ex: VIP, Parceiro, Indicação..." className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-[#00A868]/50" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground block mb-1">Data Credenciamento</label>
                        <input type="date" value={fcd} onChange={e => { setFCD(e.target.value); setFSafra(calcSafra(e.target.value)); }} className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none [color-scheme:dark]" /></div>
                </div>
            </div>
            <button onClick={() => {
                if (!fn.trim()) return;
                const actualBrand = fbrand === "__custom__" ? fBrandCustom.trim() || "STONE" : fbrand;
                onSave({ name: fn, stoneCode: fsc, cnpj: fcnpj, phone: fph, email: fem, segment: fseg, credentialDate: fcd, brand: actualBrand, safra: fsafra, category: fcategory });
            }} disabled={!fn.trim()} className="w-full py-3.5 rounded-xl bg-[#00A868] text-white font-bold hover:bg-[#008f58] disabled:opacity-50 shadow-lg shadow-[#00A868]/20 active:scale-[0.98] transition-all">Cadastrar Cliente</button>
        </div>
    );
}
