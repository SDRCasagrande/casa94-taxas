import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET all clients for the current user (with monthly volumes + negotiations)
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        let where: any = { userId: session.userId };
        // If user has orgId, show all org clients (team visibility)
        if (session.orgId) where = { orgId: session.orgId };

        const clients = await prisma.client.findMany({
            where,
            include: {
                negotiations: { include: { assignee: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
                monthlyVolumes: { orderBy: { month: "desc" }, take: 12 },
            },
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
        const { name, stoneCode, cnpj, phone, email, segment, credentialDate, negotiation, brand, safra, category } = body;

        if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const client = await prisma.client.create({
            data: {
                userId: session.userId,
                orgId: session.orgId || null,
                name: name.trim(),
                brand: brand || "STONE",
                safra: safra || "M0",
                stoneCode: stoneCode || "",
                cnpj: cnpj || "",
                phone: phone || "",
                email: email || "",
                segment: segment || "",
                category: category || "",
                credentialDate: credentialDate || "",
                negotiations: negotiation ? {
                    create: {
                        dateNeg: negotiation.dateNeg || new Date().toISOString().split("T")[0],
                        dateAccept: negotiation.dateAccept || "",
                        status: negotiation.status || "prospeccao",
                        rates: negotiation.rates || {},
                        notes: negotiation.notes || "",
                        alertDate: negotiation.alertDate || "",
                        assigneeId: negotiation.assigneeId || null,
                        stageHistory: [{ from: "", to: negotiation.status || "prospeccao", timestamp: new Date().toISOString(), userName: "Sistema" }],
                    },
                } : undefined,
            },
            include: { negotiations: true, monthlyVolumes: true },
        });

        return NextResponse.json(client, { status: 201 });
    } catch (error) {
        console.error("POST /api/clients error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
