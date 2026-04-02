import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/teams - List all groups + members
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const where: any = {};
    if (session.orgId) where.orgId = session.orgId;

    const groups = await (prisma as any).teamGroup.findMany({
        where,
        include: {
            members: {
                include: { user: { select: { id: true, name: true, email: true } } }
            },
            _count: { select: { tasks: true } }
        },
        orderBy: { name: "asc" }
    });

    return NextResponse.json(groups);
}

// POST /api/teams - Create group or add member
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();

    // Create new group
    if (body.action === "createGroup") {
        const group = await (prisma as any).teamGroup.create({
            data: { name: body.name, orgId: session.orgId || null },
            include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } }
        });
        return NextResponse.json(group);
    }

    // Add member to group
    if (body.action === "addMember") {
        const member = await (prisma as any).teamGroupMember.create({
            data: { groupId: body.groupId, userId: body.userId },
            include: { user: { select: { id: true, name: true, email: true } } }
        });
        return NextResponse.json(member);
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

// DELETE /api/teams - Delete group or remove member
export async function DELETE(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const memberId = searchParams.get("memberId");

    if (memberId) {
        await (prisma as any).teamGroupMember.delete({ where: { id: memberId } });
        return NextResponse.json({ ok: true });
    }

    if (groupId) {
        await (prisma as any).teamGroup.delete({ where: { id: groupId } });
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Parâmetro inválido" }, { status: 400 });
}
