import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET monthly volumes for a client
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        const client = await prisma.client.findUnique({ where: { id } });
        if (!client || client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const months = await prisma.clientMonth.findMany({
            where: { clientId: id },
            orderBy: { month: "desc" },
        });
        return NextResponse.json(months);
    } catch (error) {
        console.error("GET months error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// POST — create or update a month record (upsert by clientId + month)
// Rates are auto-pulled from last negotiation when not provided
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        const client = await prisma.client.findUnique({ where: { id } });
        if (!client || client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const { month, tpvDebit, tpvCredit, tpvPix, rateDebit, rateCredit, ratePix, rateRav, brandBreakdown, notes } = body;

        if (!month) return NextResponse.json({ error: "Month is required (YYYY-MM)" }, { status: 400 });

        // Auto-pull rates from the most recent negotiation if not provided
        let effectiveRateDebit = rateDebit;
        let effectiveRateCredit = rateCredit;
        let effectiveRatePix = ratePix;
        let effectiveRateRav = rateRav;

        if (effectiveRateDebit == null || effectiveRateCredit == null || effectiveRatePix == null) {
            const lastNeg = await prisma.negotiation.findFirst({
                where: { clientId: id },
                orderBy: { createdAt: "desc" },
            });
            if (lastNeg) {
                const rates = lastNeg.rates as any;
                if (effectiveRateDebit == null) effectiveRateDebit = rates?.debit || 0;
                if (effectiveRateCredit == null) effectiveRateCredit = rates?.credit1x || 0;
                if (effectiveRatePix == null) effectiveRatePix = rates?.pix || 0;
                if (effectiveRateRav == null) effectiveRateRav = rates?.rav || 0;
            }
        }

        const totalTpv = (tpvDebit || 0) + (tpvCredit || 0) + (tpvPix || 0);

        const record = await prisma.clientMonth.upsert({
            where: { clientId_month: { clientId: id, month } },
            create: {
                clientId: id,
                month,
                tpvDebit: tpvDebit || 0,
                tpvCredit: tpvCredit || 0,
                tpvPix: tpvPix || 0,
                rateDebit: effectiveRateDebit || 0,
                rateCredit: effectiveRateCredit || 0,
                ratePix: effectiveRatePix || 0,
                rateRav: effectiveRateRav || 0,
                brandBreakdown: brandBreakdown || undefined,
                notes: notes || "",
            },
            update: {
                tpvDebit: tpvDebit ?? undefined,
                tpvCredit: tpvCredit ?? undefined,
                tpvPix: tpvPix ?? undefined,
                rateDebit: effectiveRateDebit ?? undefined,
                rateCredit: effectiveRateCredit ?? undefined,
                ratePix: effectiveRatePix ?? undefined,
                rateRav: effectiveRateRav ?? undefined,
                brandBreakdown: brandBreakdown !== undefined ? brandBreakdown : undefined,
                notes: notes !== undefined ? notes : undefined,
            },
        });

        const clientData: any = client;
        const isBelowTarget = clientData.targetTpv && clientData.targetTpv > 0 && totalTpv < clientData.targetTpv;

        return NextResponse.json({ ...record, tpvWarning: isBelowTarget, fallbackRates: clientData.fallbackRates });
    } catch (error) {
        console.error("POST months error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
