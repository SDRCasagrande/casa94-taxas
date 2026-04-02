import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET all users in current org
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const where: any = {};
        if (session.orgId) where.orgId = session.orgId;

        const users = await prisma.user.findMany({
            where,
            select: { id: true, name: true, email: true, phone: true, notificationEmail: true, userRole: true, isActive: true, orgId: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json(users);
    } catch (error) {
        console.error('GET /api/admin/users error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST create new user (admin only — invite flow in production, direct create for super_admin)
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { name, email, password, notificationEmail, userRole } = body;

        if (!name?.trim() || !email?.trim() || !password) {
            return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (existing) {
            return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password: hashedPassword,
                notificationEmail: notificationEmail?.trim() || '',
                orgId: session.orgId || null,
                userRole: userRole || 'agent',
            },
            select: { id: true, name: true, email: true, phone: true, notificationEmail: true, userRole: true, isActive: true, createdAt: true },
        });

        return NextResponse.json(user, { status: 201 });
    } catch (error) {
        console.error('POST /api/admin/users error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
