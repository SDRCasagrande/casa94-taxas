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
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        const client = await prisma.client.findUnique({ where: { id } });
        if (!client || client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const { month, tpvDebit, tpvCredit, tpvPix, rateDebit, rateCredit, ratePix, rateRav, notes } = body;

        if (!month) return NextResponse.json({ error: "Month is required (YYYY-MM)" }, { status: 400 });

        const record = await prisma.clientMonth.upsert({
            where: { clientId_month: { clientId: id, month } },
            create: {
                clientId: id,
                month,
                tpvDebit: tpvDebit || 0,
                tpvCredit: tpvCredit || 0,
                tpvPix: tpvPix || 0,
                rateDebit: rateDebit || 0,
                rateCredit: rateCredit || 0,
                ratePix: ratePix || 0,
                // @ts-ignore
                rateRav: rateRav || 0,
                notes: notes || "",
            },
            update: {
                tpvDebit: tpvDebit ?? undefined,
                tpvCredit: tpvCredit ?? undefined,
                tpvPix: tpvPix ?? undefined,
                rateDebit: rateDebit ?? undefined,
                rateCredit: rateCredit ?? undefined,
                ratePix: ratePix ?? undefined,
                // @ts-ignore
                rateRav: rateRav ?? undefined,
                notes: notes !== undefined ? notes : undefined,
            },
        });

        return NextResponse.json(record);
    } catch (error) {
        console.error("POST months error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
