/**
 * BitTask — CET Calculation Engine
 * 
 * CET = 1 - (((100 * (1 - MDR)) * (1 - (RAV * mediaMeses))) / 100)
 * mediaMeses = (parcelas + 1) / 2
 */

export function calculateCET(mdr: number, rav: number, installments: number): number {
    const mdrDecimal = mdr / 100;
    const ravDecimal = rav / 100;
    const mediaMeses = (installments + 1) / 2;
    const cet = 1 - (((100 * (1 - mdrDecimal)) * (1 - (ravDecimal * mediaMeses))) / 100);
    return cet * 100; // Returns as percentage
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

export function formatPercent(value: number): string {
    return value.toFixed(2) + '%';
}

// Default brand rates (Stone baseline)
export const BRAND_PRESETS: Record<string, BrandRates> = {
    'VISA/MASTER': { debit: 0.84, credit1x: 1.86, credit2to6: 2.18, credit7to12: 2.41, credit13to18: 2.41 },
    'ELO': { debit: 1.83, credit1x: 2.82, credit2to6: 3.28, credit7to12: 3.76, credit13to18: 3.76 },
    'AMEX': { debit: 2.50, credit1x: 3.50, credit2to6: 4.00, credit7to12: 4.50, credit13to18: 4.50 },
    'HIPERCARD': { debit: 1.90, credit1x: 2.90, credit2to6: 3.40, credit7to12: 3.90, credit13to18: 3.90 },
    'CABAL': { debit: 1.80, credit1x: 2.80, credit2to6: 3.30, credit7to12: 3.80, credit13to18: 3.80 },
};

export interface BrandRates {
    debit: number;
    credit1x: number;
    credit2to6: number;
    credit7to12: number;
    credit13to18: number;
}

export interface BrandContainer {
    name: string;
    rates: BrandRates;
    enabled: boolean;
}

// Volume exemption tiers
export function calculateExemptMachines(tpv: number): number {
    if (tpv < 10000) return 0;
    if (tpv < 30000) return 1;
    if (tpv < 50000) return 2;
    if (tpv < 100000) return 4;
    return 4 + (Math.floor((tpv - 50000) / 50000) * 2);
}

// Get MDR for a specific installment count
export function getMDRForInstallment(rates: BrandRates, installments: number): number {
    if (installments <= 1) return rates.credit1x;
    if (installments <= 6) return rates.credit2to6;
    if (installments <= 12) return rates.credit7to12;
    return rates.credit13to18;
}

// Competitor list
export const COMPETITORS = [
    { id: 'cielo', name: 'Cielo', color: '#0066CC' },
    { id: 'rede', name: 'Rede', color: '#E30613' },
    { id: 'getnet', name: 'Getnet', color: '#E30014' },
    { id: 'pagseguro', name: 'PagSeguro', color: '#41BF6E' },
    { id: 'safrapay', name: 'SafraPay', color: '#F7941D' },
    { id: 'sumup', name: 'SumUp', color: '#1A4CDB' },
    { id: 'mercadopago', name: 'Mercado Pago', color: '#009EE3' },
    { id: 'other', name: 'Outro', color: '#64748b' },
];
