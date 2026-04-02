import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// PUT update user (toggle active, reset password, change role)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id } = await params;

        const body = await request.json();

        // Security: verify target user is in same org
        const target = await prisma.user.findUnique({ where: { id }, select: { orgId: true, userRole: true } });
        if (!target || (session.orgId && target.orgId !== session.orgId)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Prevent admin from modifying super_admin
        if (target.userRole === 'super_admin' && session.userRole !== 'super_admin') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.notificationEmail !== undefined) updateData.notificationEmail = body.notificationEmail.trim();
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.userRole !== undefined) updateData.userRole = body.userRole;
        if (body.newPassword) updateData.password = await bcrypt.hash(body.newPassword, 12);

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true, email: true, notificationEmail: true, userRole: true, isActive: true, createdAt: true },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error('PUT /api/admin/users/[id] error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// DELETE user (admin only, can't delete yourself)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id } = await params;

        if (id === session.userId) {
            return NextResponse.json({ error: 'Não pode excluir seu próprio usuário' }, { status: 400 });
        }

        // Ensure user is in same org
        const target = await prisma.user.findUnique({ where: { id }, select: { orgId: true } });
        if (!target || (session.orgId && target.orgId !== session.orgId)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/admin/users/[id] error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
