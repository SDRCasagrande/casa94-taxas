import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isSuperAdmin } from '@/lib/auth';

// GET /api/admin/orgs — List all organizations
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const orgs = await prisma.organization.findMany({
            include: {
                _count: { select: { users: true, clients: true, billings: true } },
                subscriptions: {
                    include: { product: { select: { name: true, slug: true, monthlyPrice: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(orgs);
    } catch (error) {
        console.error('GET /api/admin/orgs error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST /api/admin/orgs — Create new organization + admin user
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, slug, cnpj, email, phone, city, state, adminEmail, adminName } = body;

        if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        if (!adminEmail?.trim()) return NextResponse.json({ error: 'Email do admin é obrigatório' }, { status: 400 });

        // Generate slug if not provided
        const orgSlug = slug?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check for duplicate slug
        const existingSlug = await prisma.organization.findUnique({ where: { slug: orgSlug } });
        if (existingSlug) return NextResponse.json({ error: 'Slug já em uso' }, { status: 409 });

        // Check if admin email already exists
        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail.trim().toLowerCase() } });
        if (existingUser) return NextResponse.json({ error: 'Email do admin já cadastrado' }, { status: 409 });

        // Create org
        const org = await prisma.organization.create({
            data: {
                name: name.trim(),
                slug: orgSlug,
                cnpj: cnpj || '',
                email: email || '',
                phone: phone || '',
                city: city || '',
                state: state || '',
            },
        });

        // Create admin invite (7 days to accept)
        const invite = await prisma.invite.create({
            data: {
                orgId: org.id,
                email: adminEmail.trim().toLowerCase(),
                role: 'admin',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // Activate all active products for the new org
        const activeProducts = await prisma.product.findMany({ where: { isActive: true } });
        for (const p of activeProducts) {
            await prisma.orgSubscription.create({
                data: { orgId: org.id, productId: p.id },
            });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bittask.com.br';
        const inviteLink = `${baseUrl}/convite/${invite.token}`;

        // TODO: Send email via Resend

        return NextResponse.json({
            ...org,
            inviteLink,
            adminEmail: adminEmail.trim().toLowerCase(),
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/admin/orgs error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
