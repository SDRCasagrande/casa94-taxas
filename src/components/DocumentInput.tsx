"use client";

import { useState, useEffect, useCallback } from "react";
import { formatarDocumento, validarDocumento, detectarTipo, isDocumentBypass } from "@/lib/documento";
import { User, Building2, Check, AlertCircle, Loader2 } from "lucide-react";

interface DocumentInputProps {
    value: string;
    onChange: (formatted: string) => void;
    onValidation?: (result: { valido: boolean; tipo: "cpf" | "cnpj" | null; mensagem: string }) => void;
    onCNPJData?: (data: { name?: string; fantasia?: string; telefone?: string; email?: string; endereco?: string; situacao?: string }) => void;
    allowBypass?: boolean;
    autoFetchCNPJ?: boolean;
    placeholder?: string;
    className?: string;
    compact?: boolean; // smaller variant for inline use
}

export function DocumentInput({
    value,
    onChange,
    onValidation,
    onCNPJData,
    allowBypass = true,
    autoFetchCNPJ = true,
    placeholder = "CPF ou CNPJ",
    className = "",
    compact = false,
}: DocumentInputProps) {
    const [validation, setValidation] = useState<{ valido: boolean; tipo: "cpf" | "cnpj" | null; mensagem: string } | null>(null);
    const [fetching, setFetching] = useState(false);
    const nums = value.replace(/\D/g, "");

    // Validate on value change
    useEffect(() => {
        if (nums.length === 0) {
            setValidation(null);
            onValidation?.({ valido: false, tipo: null, mensagem: "" });
            return;
        }
        if (nums.length === 11 || nums.length === 14) {
            const result = validarDocumento(value, allowBypass);
            setValidation(result);
            onValidation?.(result);
        } else {
            const partial = nums.length < 11 ? "cpf" : nums.length < 14 ? "cnpj" : null;
            setValidation({ valido: false, tipo: partial, mensagem: "" });
        }
    }, [nums]);

    // Auto-fetch CNPJ data
    const fetchCNPJ = useCallback(async (doc: string) => {
        const clean = doc.replace(/\D/g, "");
        if (clean.length !== 14 || !autoFetchCNPJ || !onCNPJData) return;
        const result = validarDocumento(doc, allowBypass);
        if (!result.valido) return;

        setFetching(true);
        try {
            const res = await fetch(`/api/cnpj?cnpj=${clean}`);
            if (res.ok) {
                const data = await res.json();
                onCNPJData({
                    name: data.razaoSocial || data.razao_social || data.name,
                    fantasia: data.nomeFantasia || data.nome_fantasia || data.fantasia,
                    telefone: data.telefone,
                    email: data.email,
                    endereco: data.endereco,
                    situacao: data.situacao,
                });
            }
        } catch { /* silent */ }
        setFetching(false);
    }, [autoFetchCNPJ, onCNPJData, allowBypass]);

    useEffect(() => {
        if (nums.length === 14) fetchCNPJ(value);
    }, [nums.length === 14]);

    function handleChange(raw: string) {
        const formatted = formatarDocumento(raw);
        onChange(formatted);
    }

    const tipo = detectarTipo(value) || (nums.length <= 11 ? "cpf" : "cnpj");
    const isBypass = isDocumentBypass(value);
    const showValidation = validation && (nums.length === 11 || nums.length === 14);
    const borderColor = !showValidation
        ? "border-border"
        : validation.valido
            ? "border-[#00A868]"
            : "border-red-500";

    if (compact) {
        return (
            <div className={`relative ${className}`}>
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
                    {fetching ? (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    ) : tipo === "cnpj" ? (
                        <Building2 className="w-3 h-3 text-blue-400" />
                    ) : (
                        <User className="w-3 h-3 text-muted-foreground" />
                    )}
                </div>
                <input
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={18}
                    className={`w-full pl-6 pr-6 py-1.5 rounded-md bg-secondary border ${borderColor} text-foreground text-[11px] placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-[#00A868]/50`}
                />
                {showValidation && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        {validation.valido ? (
                            <Check className="w-3 h-3 text-[#00A868]" />
                        ) : (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                        )}
                    </div>
                )}
                {showValidation && validation.mensagem && !validation.valido && (
                    <p className="absolute -bottom-4 left-0 text-[9px] text-red-400">{validation.mensagem}</p>
                )}
            </div>
        );
    }

    return (
        <div className={`space-y-1 ${className}`}>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    {fetching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    ) : tipo === "cnpj" ? (
                        <Building2 className="w-4 h-4 text-blue-400" />
                    ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
                <input
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={18}
                    className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-secondary border ${borderColor} text-foreground text-sm placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-[#00A868]/50`}
                />
                {showValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validation.valido ? (
                            <div className="flex items-center gap-1">
                                <Check className="w-4 h-4 text-[#00A868]" />
                                {isBypass && <span className="text-[9px] text-amber-400">bypass</span>}
                            </div>
                        ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                    </div>
                )}
            </div>
            {showValidation && validation.mensagem && (
                <p className={`text-[10px] px-1 ${validation.valido ? "text-[#00A868]" : "text-red-400"}`}>
                    {validation.mensagem}
                </p>
            )}
        </div>
    );
}
