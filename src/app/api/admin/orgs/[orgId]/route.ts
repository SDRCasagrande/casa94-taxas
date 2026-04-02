import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isSuperAdmin } from '@/lib/auth';

// GET /api/admin/orgs/[orgId] — Get org details
export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                users: { select: { id: true, name: true, email: true, userRole: true, position: true, isActive: true, createdAt: true } },
                _count: { select: { clients: true, billings: true } },
                subscriptions: { include: { product: true } },
            },
        });

        if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(org);
    } catch (error) {
        console.error('GET org detail error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// PUT /api/admin/orgs/[orgId] — Update org
export async function PUT(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { orgId } = await params;

        const body = await req.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};

        if (body.name !== undefined) data.name = body.name.trim();
        if (body.cnpj !== undefined) data.cnpj = body.cnpj;
        if (body.email !== undefined) data.email = body.email;
        if (body.phone !== undefined) data.phone = body.phone;
        if (body.city !== undefined) data.city = body.city;
        if (body.state !== undefined) data.state = body.state;
        if (body.isActive !== undefined) data.isActive = body.isActive;

        const org = await prisma.organization.update({
            where: { id: orgId },
            data,
        });

        return NextResponse.json(org);
    } catch (error) {
        console.error('PUT org error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// DELETE /api/admin/orgs/[orgId] — Delete org (danger!)
export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { orgId } = await params;

        // Safety: don't delete orgs with active users
        const userCount = await prisma.user.count({ where: { orgId } });
        if (userCount > 0) {
            return NextResponse.json({ error: `Não é possível excluir — ${userCount} usuários vinculados. Desative a org primeiro.` }, { status: 409 });
        }

        await prisma.organization.delete({ where: { id: orgId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE org error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
