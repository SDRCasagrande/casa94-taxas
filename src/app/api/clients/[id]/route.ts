import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET single client
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        const where: any = { id };
        if (session.orgId) where.orgId = session.orgId;
        else where.userId = session.userId;

        const client = await prisma.client.findFirst({
            where,
            include: { negotiations: { orderBy: { createdAt: "desc" } } },
        });
        if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(client);
    } catch (error) {
        console.error("GET /api/clients/[id] error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// PUT update client info
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;
        const body = await request.json();

        const existWhere: any = { id };
        if (session.orgId) existWhere.orgId = session.orgId;
        else existWhere.userId = session.userId;

        const existing = await prisma.client.findFirst({ where: existWhere });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const client = await prisma.client.update({
            where: { id },
            data: {
                name: body.name ?? existing.name,
                stoneCode: body.stoneCode ?? existing.stoneCode,
                cnpj: body.cnpj ?? existing.cnpj,
                phone: body.phone ?? existing.phone,
                email: body.email ?? existing.email,
                status: body.status ?? existing.status,
                credentialDate: body.credentialDate !== undefined ? body.credentialDate : existing.credentialDate,
                cancelDate: body.cancelDate !== undefined ? body.cancelDate : existing.cancelDate,
                segment: body.segment !== undefined ? body.segment : existing.segment,
            },
            include: { negotiations: { orderBy: { createdAt: "desc" } }, monthlyVolumes: { orderBy: { month: "desc" } } },
        });
        return NextResponse.json(client);
    } catch (error) {
        console.error("PUT /api/clients/[id] error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// DELETE client
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        const delWhere: any = { id };
        if (session.orgId) delWhere.orgId = session.orgId;
        else delWhere.userId = session.userId;

        const existing = await prisma.client.findFirst({ where: delWhere });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await prisma.client.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("DELETE /api/clients/[id] error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
