import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isSuperAdmin } from '@/lib/auth';

// GET /api/admin/products — List all products
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const products = await prisma.product.findMany({
            include: { _count: { select: { subscriptions: true } } },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json(products);
    } catch (error) {
        console.error('GET /api/admin/products error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST /api/admin/products — Create product
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, slug, monthlyPrice, description } = await request.json();

        if (!name?.trim() || !slug?.trim()) {
            return NextResponse.json({ error: 'Nome e slug são obrigatórios' }, { status: 400 });
        }

        const product = await prisma.product.create({
            data: {
                name: name.trim(),
                slug: slug.trim().toLowerCase(),
                monthlyPrice: monthlyPrice || 0,
                description: description || '',
            },
        });

        return NextResponse.json(product, { status: 201 });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Produto com este nome ou slug já existe' }, { status: 409 });
        }
        console.error('POST /api/admin/products error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
