// CPF validation (Brazilian individual taxpayer ID)
export function validarCPF(cpf: string): boolean {
    const nums = cpf.replace(/\D/g, "");
    if (nums.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(nums)) return false; // all same digits

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(nums[9]) !== d1) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    return parseInt(nums[10]) === d2;
}

// CNPJ validation (Brazilian company taxpayer ID)
export function validarCNPJ(cnpj: string): boolean {
    const nums = cnpj.replace(/\D/g, "");
    if (nums.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(nums)) return false;

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(nums[i]) * weights1[i];
    let d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(nums[12]) !== d1) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(nums[i]) * weights2[i];
    let d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return parseInt(nums[13]) === d2;
}

// Detect if it's CPF or CNPJ based on digit count
export function detectarTipo(doc: string): "cpf" | "cnpj" | null {
    const nums = doc.replace(/\D/g, "");
    if (nums.length === 11) return "cpf";
    if (nums.length === 14) return "cnpj";
    return null;
}

// Format CPF: 000.000.000-00
export function formatarCPF(cpf: string): string {
    const nums = cpf.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

// Format CNPJ: 00.000.000/0000-00
export function formatarCNPJ(cnpj: string): string {
    const nums = cnpj.replace(/\D/g, "").slice(0, 14);
    if (nums.length <= 2) return nums;
    if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
    if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
    if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
}

// Auto-format based on length
export function formatarDocumento(doc: string): string {
    const nums = doc.replace(/\D/g, "");
    if (nums.length <= 11) return formatarCPF(nums);
    return formatarCNPJ(nums);
}

// Validate either CPF or CNPJ
export function validarDocumento(doc: string, allowBypass = true): { valido: boolean; tipo: "cpf" | "cnpj" | null; mensagem: string } {
    if (allowBypass && isDocumentBypass(doc)) {
        return { valido: true, tipo: "cpf", mensagem: "CPF genérico aceito" };
    }
    const tipo = detectarTipo(doc);
    if (!tipo) return { valido: false, tipo: null, mensagem: "Digite 11 (CPF) ou 14 (CNPJ) digitos" };
    if (tipo === "cpf") {
        return validarCPF(doc)
            ? { valido: true, tipo: "cpf", mensagem: "CPF válido ✓" }
            : { valido: false, tipo: "cpf", mensagem: "CPF inválido" };
    }
    return validarCNPJ(doc)
        ? { valido: true, tipo: "cnpj", mensagem: "CNPJ válido ✓" }
        : { valido: false, tipo: "cnpj", mensagem: "CNPJ inválido" };
}

// Check if document is a bypass (000.000.000-00)
export function isDocumentBypass(doc: string): boolean {
    const nums = doc.replace(/\D/g, "");
    return nums === "00000000000";
}
