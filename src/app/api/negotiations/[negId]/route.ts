import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// PUT update a negotiation (edit rates, dates, status, notes)
export async function PUT(request: Request, { params }: { params: Promise<{ negId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { negId } = await params;

        // Verify ownership through client → user
        const neg = await prisma.negotiation.findUnique({ where: { id: negId }, include: { client: true } });
        if (!neg || neg.client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const updated = await prisma.negotiation.update({
            where: { id: negId },
            data: {
                dateNeg: body.dateNeg ?? neg.dateNeg,
                dateAccept: body.dateAccept ?? neg.dateAccept,
                status: body.status ?? neg.status,
                rates: body.rates ?? neg.rates,
                notes: body.notes ?? neg.notes,
                alertDate: body.alertDate !== undefined ? body.alertDate : neg.alertDate,
                alertSent: body.alertDate !== undefined ? false : neg.alertSent, // reset alertSent when date changes
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PUT negotiations error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// DELETE a negotiation
export async function DELETE(_request: Request, { params }: { params: Promise<{ negId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { negId } = await params;

        const neg = await prisma.negotiation.findUnique({ where: { id: negId }, include: { client: true } });
        if (!neg || neg.client.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await prisma.negotiation.delete({ where: { id: negId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("DELETE negotiations error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
