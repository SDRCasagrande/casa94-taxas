import jsPDF from "jspdf";
import "jspdf-autotable";

export interface MonthVolume { id: string; month: string; tpvDebit: number; tpvCredit: number; tpvPix: number; rateDebit: number; rateCredit: number; ratePix: number; notes: string }
interface RateSnapshot { debit: number; credit1x: number; credit2to6: number; credit7to12: number; pix: number; rav: number; ravRate?: number }
export interface Client { name: string; stoneCode: string; cnpj: string; brand: string; status: string; monthlyVolumes: MonthVolume[]; negotiations: { rates: RateSnapshot }[] }

function fmtMoney(v: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function calcCommission(vol: MonthVolume) {
    const revDebit = vol.tpvDebit * (vol.rateDebit / 100);
    const revCredit = vol.tpvCredit * (vol.rateCredit / 100);
    const revPix = vol.tpvPix * (vol.ratePix / 100);
    const totalRevenue = revDebit + revCredit + revPix;
    const franchise = totalRevenue * 0.30;
    const agent = franchise * 0.10;
    return { totalRevenue, franchise, agent, tpvTotal: vol.tpvDebit + vol.tpvCredit + vol.tpvPix };
}

export function generateExecutiveReportPDF(clients: Client[], currentMonth: string, userName: string) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const green = [0, 168, 104] as const;
    const darkGray = [26, 26, 46] as const;
    const medGray = [107, 114, 128] as const;
    let y = 15;

    // ═══ HEADER BAND ═══
    doc.setFillColor(...green);
    doc.rect(0, 0, pageW, 35, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BitTask — Relatório Executivo Mensal", 15, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Mês de Referência: ${currentMonth}`, 15, 23);

    // Date
    doc.setFontSize(9);
    doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, pageW - 15, 16, { align: "right" });
    doc.text(`Agente: ${userName}`, pageW - 15, 23, { align: "right" });

    y = 45;

    // ═══ Metrics summary ═══
    const activeClients = clients.filter(c => c.status === "ativo");
    const allVolumes = activeClients.flatMap(c => c.monthlyVolumes.filter(v => v.month === currentMonth));
    const summary = allVolumes.reduce((a, v) => {
        const c = calcCommission(v);
        return { tpv: a.tpv + c.tpvTotal, rev: a.rev + c.totalRevenue, comm: a.comm + c.agent };
    }, { tpv: 0, rev: 0, comm: 0 });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text("RESUMO DA CARTEIRA ATIVA", 15, y);
    
    y += 8;
    
    const summaryData = [
        ["Total de Clientes Ativos", "TPV Total do Mês", "Receita Gerada (Est.)", "Comissão Agente (Est.)"],
        [activeClients.length.toString(), fmtMoney(summary.tpv), fmtMoney(summary.rev), fmtMoney(summary.comm)]
    ];

    (doc as any).autoTable({
        startY: y,
        body: [summaryData[1]],
        head: [summaryData[0]],
        theme: "plain",
        headStyles: { fillColor: [248, 250, 249], textColor: medGray, fontStyle: "bold", fontSize: 9, halign: "center" },
        bodyStyles: { fontSize: 12, halign: "center", textColor: green, fontStyle: "bold" },
        margin: { left: 15, right: 15 },
        styles: { lineWidth: 0.1, lineColor: [229, 231, 235] }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // ═══ CLIENT DETAILS TABLE ═══
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text("DETALHAMENTO POR CLIENTE", 15, y);
    y += 8;

    const tableHeaders = ["Cliente", "CNPJ", "Stone Code", "Bandeira", "Status", `TPV (${currentMonth})`, "Receita", "Sua Comissão"];
    const tableBody = clients.map(c => {
        const vol = c.monthlyVolumes.find(v => v.month === currentMonth) || {
            id: "", month: currentMonth,
            tpvDebit: 0, tpvCredit: 0, tpvPix: 0,
            rateDebit: 0, rateCredit: 0, ratePix: 0, notes: ""
        };
        const comm = calcCommission(vol);
        return [
            c.name,
            c.cnpj || "-",
            c.stoneCode || "-",
            c.brand || "STONE",
            c.status.toUpperCase(),
            fmtMoney(comm.tpvTotal),
            fmtMoney(comm.totalRevenue),
            fmtMoney(comm.agent)
        ];
    });

    // sort tableBody by TPV descending
    tableBody.sort((a, b) => {
        const valA = parseFloat(a[5].replace("R$", "").replace(".", "").replace(",", ".").trim()) || 0;
        const valB = parseFloat(b[5].replace("R$", "").replace(".", "").replace(",", ".").trim()) || 0;
        return valB - valA;
    });

    (doc as any).autoTable({
        startY: y,
        head: [tableHeaders],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
        bodyStyles: { fontSize: 8, halign: "center", textColor: darkGray },
        alternateRowStyles: { fillColor: [248, 250, 249] },
        margin: { left: 15, right: 15 },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    });

    // ═══ FOOTER ═══
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    doc.text("BitTask — Gerado automaticamente", pageW / 2, footerY, { align: "center" });

    doc.save(`Relatorio_Executivo_${currentMonth}.pdf`);
}
