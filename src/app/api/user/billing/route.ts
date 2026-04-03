import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only super_admin or admin roles should access billing
        // If a user has no orgId (e.g. super admin), we can either deny or let them see all, but here this endpoint is for the tenant org
        if (session.userRole !== 'super_admin' && session.userRole !== 'admin') {
            return NextResponse.json({ error: 'Forbidden. Apenas administradores podem acessar o faturamento.' }, { status: 403 });
        }

        if (!session.orgId) {
            return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 400 });
        }

        // Fetch subscriptions linked to this org
        const subscriptions = await prisma.orgSubscription.findMany({
            where: { orgId: session.orgId, isActive: true },
            include: { product: true }
        });

        // Fetch billing history linked to this org
        const billings = await prisma.billing.findMany({
            where: { orgId: session.orgId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            subscriptions,
            billings
        });

    } catch (error) {
        console.error('GET /api/user/billing error:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
