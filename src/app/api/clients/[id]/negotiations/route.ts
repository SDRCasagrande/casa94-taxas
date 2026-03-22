import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// POST add negotiation to a client
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        // Verify ownership
        const client = await prisma.client.findFirst({ where: { id, userId: session.userId } });
        if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const body = await request.json();
        const negotiation = await prisma.negotiation.create({
            data: {
                clientId: id,
                dateNeg: body.dateNeg || new Date().toISOString().split("T")[0],
                dateAccept: body.dateAccept || "",
                status: body.dateAccept ? "aceita" : "pendente",
                rates: body.rates || {},
                notes: body.notes || "",
                alertDate: body.alertDate || "",
            },
        });

        return NextResponse.json(negotiation, { status: 201 });
    } catch (error) {
        console.error("POST negotiations error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
