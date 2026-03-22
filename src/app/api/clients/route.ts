import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET all clients for the current user
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const clients = await prisma.client.findMany({
            where: { userId: session.userId },
            include: { negotiations: { orderBy: { createdAt: "desc" } } },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(clients);
    } catch (error) {
        console.error("GET /api/clients error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// POST create new client with optional first negotiation
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { name, stoneCode, cnpj, phone, email, negotiation } = body;

        if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const client = await prisma.client.create({
            data: {
                userId: session.userId,
                name: name.trim(),
                stoneCode: stoneCode || "",
                cnpj: cnpj || "",
                phone: phone || "",
                email: email || "",
                negotiations: negotiation ? {
                    create: {
                        dateNeg: negotiation.dateNeg || new Date().toISOString().split("T")[0],
                        dateAccept: negotiation.dateAccept || "",
                        status: negotiation.dateAccept ? "aceita" : "pendente",
                        rates: negotiation.rates || {},
                        notes: negotiation.notes || "",
                        alertDate: negotiation.alertDate || "",
                    },
                } : undefined,
            },
            include: { negotiations: true },
        });

        return NextResponse.json(client, { status: 201 });
    } catch (error) {
        console.error("POST /api/clients error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
