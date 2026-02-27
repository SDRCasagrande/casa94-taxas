import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// PUT update user (toggle active, reset password)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        const body = await request.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.notificationEmail !== undefined) updateData.notificationEmail = body.notificationEmail.trim();
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.newPassword) updateData.password = await bcrypt.hash(body.newPassword, 12);

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true, email: true, notificationEmail: true, isAdmin: true, isActive: true, createdAt: true },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error('PUT /api/admin/users/[id] error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// DELETE user
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        // Can't delete yourself
        if (id === session.userId) {
            return NextResponse.json({ error: 'Não pode excluir seu próprio usuário' }, { status: 400 });
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/admin/users/[id] error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
