"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, Loader2, Download, ArrowLeft } from "lucide-react";

interface ParsedClient {
    name: string; stoneCode: string; cnpj: string; phone: string; email: string;
    segment: string; brand: string; safra: string; credentialDate: string; category: string;
}

const FIELD_MAP: Record<string, keyof ParsedClient> = {
    "nome": "name", "name": "name", "razao_social": "name", "razão social": "name", "cliente": "name",
    "stone_code": "stoneCode", "stonecode": "stoneCode", "sc": "stoneCode", "código": "stoneCode", "codigo": "stoneCode",
    "cnpj": "cnpj", "cpf": "cnpj", "cnpj_cpf": "cnpj", "documento": "cnpj",
    "telefone": "phone", "phone": "phone", "cel": "phone", "celular": "phone", "whatsapp": "phone",
    "email": "email", "e-mail": "email",
    "segmento": "segment", "segment": "segment", "ramo": "segment", "atividade": "segment",
    "empresa": "brand", "brand": "brand", "bandeira": "brand", "adquirente": "brand",
    "safra": "safra",
    "credenciamento": "credentialDate", "data_credenciamento": "credentialDate", "credentialdate": "credentialDate", "dt_cred": "credentialDate",
    "categoria": "category", "category": "category", "grupo": "category",
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
    const rows = lines.slice(1).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, "")));
    return { headers, rows };
}

function mapRow(headers: string[], row: string[]): ParsedClient {
    const client: ParsedClient = { name: "", stoneCode: "", cnpj: "", phone: "", email: "", segment: "", brand: "STONE", safra: "M0", credentialDate: "", category: "" };
    headers.forEach((h, i) => {
        const field = FIELD_MAP[h];
        if (field && row[i]) {
            (client as any)[field] = row[i];
        }
    });
    return client;
}

export function ImportCSVModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
    const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
    const [parsed, setParsed] = useState<ParsedClient[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [fileName, setFileName] = useState("");
    const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    function handleFile(file: File) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const { headers: h, rows } = parseCSV(text);
            if (h.length === 0) return;

            const mapped = rows.map(r => mapRow(h, r)).filter(c => c.name.trim());
            setHeaders(h);
            setParsed(mapped);
            setFileName(file.name);
            setStep("preview");
        };
        reader.readAsText(file, "utf-8");
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }

    async function doImport() {
        setStep("importing");
        try {
            const res = await fetch("/api/clients/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clients: parsed }),
            });
            const data = await res.json();
            setResult(data);
            setStep("done");
            if (data.imported > 0) onImported();
        } catch {
            setResult({ imported: 0, skipped: parsed.length, errors: ["Erro de rede"] });
            setStep("done");
        }
    }

    function downloadTemplate() {
        const csv = "nome;stone_code;cnpj;telefone;email;segmento;empresa;safra;credenciamento;categoria\nJoão Restaurante;123456;12.345.678/0001-99;(11)99999-0000;joao@restaurante.com;Alimentação;STONE;M0;2026-01-15;VIP\n";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "modelo_clientes_bittask.csv"; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
            <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl sm:max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Importar Clientes (CSV)</h2>
                            <p className="text-[10px] text-muted-foreground">{step === "upload" ? "Carregue sua planilha" : step === "preview" ? `${parsed.length} clientes detectados` : step === "importing" ? "Importando..." : "Concluído"}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground touch-target"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {step === "upload" && (
                        <div className="space-y-4">
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-blue-500/30 rounded-2xl p-10 text-center cursor-pointer hover:bg-blue-500/5 hover:border-blue-500/50 transition-all group"
                            >
                                <Upload className="w-10 h-10 text-blue-500/50 mx-auto mb-3 group-hover:text-blue-500 transition-colors" />
                                <p className="text-sm font-semibold text-foreground">Arraste o arquivo CSV aqui</p>
                                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-3">Suporta .csv com separador vírgula ou ponto-e-vírgula</p>
                                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                            </div>

                            <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all touch-target">
                                <Download className="w-4 h-4" /> Baixar Modelo CSV
                            </button>

                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                                <p className="text-xs font-bold text-blue-500 mb-2">Colunas aceitas:</p>
                                <div className="flex flex-wrap gap-1">
                                    {["nome", "stone_code", "cnpj", "telefone", "email", "segmento", "empresa", "safra", "credenciamento", "categoria"].map(c => (
                                        <span key={c} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-mono font-bold">{c}</span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">A coluna "nome" é obrigatória. Duplicatas por Stone Code ou CNPJ são ignoradas automaticamente.</p>
                            </div>
                        </div>
                    )}

                    {step === "preview" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span className="font-medium">{fileName}</span>
                                <button onClick={() => { setStep("upload"); setParsed([]); }} className="text-blue-500 hover:text-blue-400 ml-auto flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Trocar arquivo</button>
                            </div>

                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00A868]/10 border border-[#00A868]/20">
                                <Check className="w-4 h-4 text-[#00A868] shrink-0" />
                                <span className="text-xs font-medium text-[#00A868]">{parsed.length} clientes prontos para importar</span>
                            </div>

                            <div className="overflow-x-auto -mx-5 px-5">
                                <table className="w-full text-xs border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-2 text-muted-foreground font-semibold">#</th>
                                            <th className="text-left py-2 text-muted-foreground font-semibold">Nome</th>
                                            <th className="text-left py-2 text-muted-foreground font-semibold">SC</th>
                                            <th className="text-left py-2 text-muted-foreground font-semibold">CNPJ</th>
                                            <th className="text-left py-2 text-muted-foreground font-semibold">Telefone</th>
                                            <th className="text-left py-2 text-muted-foreground font-semibold">Empresa</th>
                                            <th className="text-left py-2 text-muted-foreground font-semibold">Safra</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsed.slice(0, 20).map((c, i) => (
                                            <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                                                <td className="py-2 text-muted-foreground">{i + 1}</td>
                                                <td className="py-2 font-semibold truncate max-w-[200px]">{c.name}</td>
                                                <td className="py-2 text-muted-foreground">{c.stoneCode || "—"}</td>
                                                <td className="py-2 text-muted-foreground">{c.cnpj || "—"}</td>
                                                <td className="py-2 text-muted-foreground">{c.phone || "—"}</td>
                                                <td className="py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.brand === "TON" ? "bg-green-500/10 text-green-500" : "bg-green-600/10 text-green-600"}`}>{c.brand || "STONE"}</span></td>
                                                <td className="py-2 text-muted-foreground">{c.safra || "M0"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsed.length > 20 && <p className="text-[10px] text-muted-foreground text-center py-2">... e mais {parsed.length - 20} clientes</p>}
                            </div>
                        </div>
                    )}

                    {step === "importing" && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-[#00A868]" />
                            <p className="text-sm font-semibold text-foreground">Importando {parsed.length} clientes...</p>
                            <p className="text-xs text-muted-foreground">Verificando duplicatas e salvando</p>
                        </div>
                    )}

                    {step === "done" && result && (
                        <div className="space-y-4">
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${result.imported > 0 ? "bg-[#00A868]/10 border border-[#00A868]/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                                {result.imported > 0 ? <Check className="w-5 h-5 text-[#00A868]" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                                <div>
                                    <p className="text-sm font-bold text-foreground">{result.imported} cliente(s) importado(s)</p>
                                    {result.skipped > 0 && <p className="text-xs text-muted-foreground">{result.skipped} pulado(s) (duplicatas ou erros)</p>}
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div className="bg-muted/30 border border-border rounded-xl p-3 max-h-40 overflow-y-auto">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Detalhes</p>
                                    {result.errors.slice(0, 20).map((e, i) => (
                                        <p key={i} className="text-[11px] text-muted-foreground py-0.5 flex items-start gap-1.5">
                                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                            {e}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === "preview" && (
                    <div className="px-5 py-4 border-t border-border shrink-0">
                        <button onClick={doImport}
                            className="w-full py-3.5 rounded-xl bg-[#00A868] text-white font-bold text-sm hover:bg-[#008f58] shadow-lg shadow-[#00A868]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 touch-target">
                            <Upload className="w-4 h-4" /> Importar {parsed.length} Clientes
                        </button>
                    </div>
                )}
                {step === "done" && (
                    <div className="px-5 py-4 border-t border-border shrink-0">
                        <button onClick={onClose}
                            className="w-full py-3.5 rounded-xl bg-card border border-border text-foreground font-bold text-sm hover:bg-muted transition-all flex items-center justify-center gap-2 touch-target">
                            <Check className="w-4 h-4" /> Fechar
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
