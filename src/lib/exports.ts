import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCurrency, formatPercent, calculateCET, getMDRForInstallment, type BrandRates } from "./calculator";

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

export interface ProposalData {
    cliente: { nome: string; cnpj: string; telefone: string; email: string };
    tpv: number;
    volDebit: number;
    volCredit: number;
    volPix: number;
    shareDebit: number;
    shareCredit: number;
    sharePix: number;
    stoneRates: BrandRates;
    rav: number;
    pixRate: number;
    competitorName: string;
    compRates: { debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number };
    stoneFee: number;
    compFee: number;
    stoneRental: number;
    compRental: number;
    stoneTotal: number;
    compTotal: number;
    economy: number;
    agreementType: string;
    machines: number;
    isExempt: boolean;
}

// ─── PDF — PRINT-FRIENDLY, WHITE BACKGROUND, A4 LANDSCAPE ───
export function exportPDF(data: ProposalData) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth(); // 297
    const h = doc.internal.pageSize.getHeight(); // 210
    const m = 10; // margin
    let y = m;
    const colW = (w - m * 3) / 2; // two-column layout

    // Colors (text only — no background fills!)
    const emerald: [number, number, number] = [0, 136, 80];
    const black: [number, number, number] = [30, 30, 30];
    const gray: [number, number, number] = [100, 100, 100];
    const white: [number, number, number] = [255, 255, 255];

    // Header bar (thin green line at top)
    doc.setFillColor(...emerald);
    doc.rect(0, 0, w, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`PROPOSTA COMERCIAL STONE — ${data.cliente.nome || "Cliente"}`, m, 9);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR"), w - m, 9, { align: "right" });
    y = 20;

    // === LEFT COLUMN ===
    const lx = m;

    // Client info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...emerald);
    doc.text("CLIENTE", lx, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.text(`${data.cliente.nome || "—"}  |  ${data.cliente.cnpj || "—"}  |  ${data.cliente.telefone || "—"}`, lx, y + 6);
    y += 14;

    // Volume
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...emerald);
    doc.text("VOLUME (TPV)", lx, y);
    doc.setTextColor(...black);
    doc.text(formatCurrency(data.tpv) + "/mês", lx + 50, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text(`Déb: ${formatCurrency(data.volDebit)} (${data.shareDebit.toFixed(0)}%) | Créd: ${formatCurrency(data.volCredit)} (${data.shareCredit.toFixed(0)}%) | PIX: ${formatCurrency(data.volPix)} (${data.sharePix.toFixed(0)}%)`, lx, y);
    y += 8;

    // Rates comparison table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...emerald);
    doc.text("COMPARATIVO DE TAXAS", lx, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        margin: { left: lx, right: w - lx - colW },
        head: [["", "Déb", "1x", "2-6x", "7-12x", "PIX", "RAV"]],
        body: [
            ["Stone", formatPercent(data.stoneRates.debit), formatPercent(data.stoneRates.credit1x), formatPercent(data.stoneRates.credit2to6), formatPercent(data.stoneRates.credit7to12), formatPercent(data.pixRate), formatPercent(data.rav)],
            [data.competitorName, formatPercent(data.compRates.debit), formatPercent(data.compRates.credit1x), formatPercent(data.compRates.credit2to6), formatPercent(data.compRates.credit7to12), formatPercent(data.compRates.pix), formatPercent(data.compRates.rav)],
        ],
        theme: "grid",
        styles: { fontSize: 10, halign: "center", cellPadding: 3, textColor: black, lineColor: [200, 200, 200], lineWidth: 0.3 },
        headStyles: { fillColor: emerald, textColor: white, fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fillColor: white },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        tableWidth: colW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;

    // Costs summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...emerald);
    doc.text("CUSTOS MENSAIS", lx, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        margin: { left: lx, right: w - lx - colW },
        head: [["", "Taxas", "Aluguel", "TOTAL"]],
        body: [
            ["Stone", formatCurrency(data.stoneFee), data.isExempt ? "ISENTO" : formatCurrency(data.stoneRental), formatCurrency(data.stoneTotal)],
            [data.competitorName, formatCurrency(data.compFee), formatCurrency(data.compRental), formatCurrency(data.compTotal)],
        ],
        theme: "grid",
        styles: { fontSize: 10, halign: "center", cellPadding: 3, textColor: black, lineColor: [200, 200, 200], lineWidth: 0.3 },
        headStyles: { fillColor: [70, 70, 70], textColor: white, fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fillColor: white },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        tableWidth: colW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;

    // Agreement
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...emerald);
    doc.text("ACORDO", lx, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...black);
    doc.text(`${data.agreementType === "fidelidade" ? "Fidelidade" : "Adesão"} | ${data.machines} máquina(s) ${data.isExempt ? "(ISENTO)" : ""}`, lx + 25, y);
    y += 8;

    // Economy block (green border, no fill)
    doc.setDrawColor(...emerald);
    doc.setLineWidth(1);
    doc.roundedRect(lx, y, colW, 24, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...emerald);
    doc.text(data.economy > 0 ? ">> ECONOMIA COM STONE" : ">> CUSTO ADICIONAL", lx + 4, y + 8);
    doc.setFontSize(18);
    doc.text(`${formatCurrency(Math.abs(data.economy))}/mês`, lx + 4, y + 18);
    doc.setFontSize(12);
    doc.setTextColor(...gray);
    doc.text(`${formatCurrency(Math.abs(data.economy) * 12)}/ano`, lx + 70, y + 18);

    // === RIGHT COLUMN ===
    const rx = m * 2 + colW;
    let ry = 18;

    // CET table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...emerald);
    doc.text("TABELA CET STONE (1x-12x)", rx, ry);
    ry += 2;

    const cetH = Array.from({ length: 12 }, (_, i) => `${i + 1}x`);
    const cetV = Array.from({ length: 12 }, (_, i) => {
        const mdr = getMDRForInstallment(data.stoneRates, i + 1);
        return formatPercent(calculateCET(mdr, data.rav, i + 1));
    });

    // 2 rows of 6
    autoTable(doc, {
        startY: ry,
        margin: { left: rx, right: m },
        head: [cetH.slice(0, 6)],
        body: [cetV.slice(0, 6)],
        theme: "grid",
        styles: { fontSize: 10, halign: "center", cellPadding: 3, textColor: black, lineColor: [200, 200, 200], lineWidth: 0.3 },
        headStyles: { fillColor: emerald, textColor: white, fontSize: 10 },
        bodyStyles: { fillColor: white },
        tableWidth: colW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ry = (doc as any).lastAutoTable.finalY + 1;

    autoTable(doc, {
        startY: ry,
        margin: { left: rx, right: m },
        head: [cetH.slice(6)],
        body: [cetV.slice(6)],
        theme: "grid",
        styles: { fontSize: 10, halign: "center", cellPadding: 3, textColor: black, lineColor: [200, 200, 200], lineWidth: 0.3 },
        headStyles: { fillColor: emerald, textColor: white, fontSize: 10 },
        bodyStyles: { fillColor: white },
        tableWidth: colW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ry = (doc as any).lastAutoTable.finalY + 8;

    // Financial summary (bordered box, no dark fill)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.roundedRect(rx, ry, colW, 35, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...emerald);
    doc.text("RESUMO FINANCEIRO", rx + 4, ry + 7);

    doc.setFontSize(10);
    const items = [
        { l: "Custo Stone (taxas + aluguel):", v: formatCurrency(data.stoneTotal) },
        { l: `Custo ${data.competitorName}:`, v: formatCurrency(data.compTotal) },
        { l: "Diferença mensal:", v: (data.economy > 0 ? "+" : "") + formatCurrency(data.economy) },
        { l: "Diferença anual:", v: (data.economy > 0 ? "+" : "") + formatCurrency(data.economy * 12) },
    ];
    items.forEach((item, i) => {
        doc.setTextColor(...gray);
        doc.setFont("helvetica", "normal");
        doc.text(item.l, rx + 4, ry + 13 + i * 6);
        doc.setTextColor(...black);
        doc.setFont("helvetica", "bold");
        doc.text(item.v, rx + colW - 4, ry + 13 + i * 6, { align: "right" });
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Proposta gerada em ${new Date().toLocaleDateString("pt-BR")} — BitTask`, w / 2, h - 5, { align: "center" });

    const filename = `Proposta_${(data.cliente.nome || "Stone").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
    const blob = doc.output("blob");
    downloadBlob(blob, filename);
}

// ─── EXCEL EXPORT ───
export function exportExcel(data: ProposalData) {
    const wb = XLSX.utils.book_new();

    const resumoData = [
        [`PROPOSTA COMERCIAL — ${data.cliente.nome || "Cliente"}`],
        [""], ["DADOS DO CLIENTE"],
        ["Razão Social", data.cliente.nome], ["CNPJ/CPF", data.cliente.cnpj],
        ["Telefone", data.cliente.telefone], ["E-mail", data.cliente.email],
        [""], ["VOLUME (TPV)"],
        ["TPV Total", formatCurrency(data.tpv)],
        ["Débito", formatCurrency(data.volDebit), `${data.shareDebit.toFixed(1)}%`],
        ["Crédito", formatCurrency(data.volCredit), `${data.shareCredit.toFixed(1)}%`],
        ["PIX", formatCurrency(data.volPix), `${data.sharePix.toFixed(1)}%`],
        [""], ["ACORDO COMERCIAL"],
        ["Tipo", data.agreementType === "fidelidade" ? "Fidelidade" : "Adesão"],
        ["Máquinas", data.machines],
        ["Aluguel", data.isExempt ? "ISENTO" : formatCurrency(data.stoneRental)],
        [""], ["ECONOMIA"],
        ["Mensal", formatCurrency(data.economy)],
        ["Anual", formatCurrency(data.economy * 12)],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    wsResumo["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const taxasData = [
        ["COMPARATIVO DE TAXAS"], [""],
        ["", "Débito", "Créd. 1x", "2-6x", "7-12x", "PIX", "RAV", "Custo Taxas", "Aluguel", "TOTAL"],
        ["Stone", formatPercent(data.stoneRates.debit), formatPercent(data.stoneRates.credit1x), formatPercent(data.stoneRates.credit2to6), formatPercent(data.stoneRates.credit7to12), formatPercent(data.pixRate), formatPercent(data.rav), formatCurrency(data.stoneFee), data.isExempt ? "ISENTO" : formatCurrency(data.stoneRental), formatCurrency(data.stoneTotal)],
        [data.competitorName, formatPercent(data.compRates.debit), formatPercent(data.compRates.credit1x), formatPercent(data.compRates.credit2to6), formatPercent(data.compRates.credit7to12), formatPercent(data.compRates.pix), formatPercent(data.compRates.rav), formatCurrency(data.compFee), formatCurrency(data.compRental), formatCurrency(data.compTotal)],
    ];
    const wsTaxas = XLSX.utils.aoa_to_sheet(taxasData);
    wsTaxas["!cols"] = Array(10).fill({ wch: 14 });
    XLSX.utils.book_append_sheet(wb, wsTaxas, "Taxas");

    const cetHeaderRow = ["Parcela", ...Array.from({ length: 12 }, (_, i) => `${i + 1}x`)];
    const cetValueRow = ["CET", ...Array.from({ length: 12 }, (_, i) => {
        const mdr = getMDRForInstallment(data.stoneRates, i + 1);
        return formatPercent(calculateCET(mdr, data.rav, i + 1));
    })];
    const wsCET = XLSX.utils.aoa_to_sheet([["TABELA CET STONE"], [""], cetHeaderRow, cetValueRow]);
    wsCET["!cols"] = Array(13).fill({ wch: 10 });
    XLSX.utils.book_append_sheet(wb, wsCET, "CET");

    const filename = `Proposta_${(data.cliente.nome || "Stone").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, filename);
}
