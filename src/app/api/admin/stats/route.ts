import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isSuperAdmin } from '@/lib/auth';

// GET /api/admin/stats — Dashboard stats for super admin
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !isSuperAdmin(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [totalOrgs, activeOrgs, totalUsers, totalProducts] = await Promise.all([
            prisma.organization.count(),
            prisma.organization.count({ where: { isActive: true } }),
            prisma.user.count({ where: { userRole: { not: 'super_admin' } } }),
            prisma.product.count({ where: { isActive: true } }),
        ]);

        // Calculate MRR from active subscriptions
        const activeSubs = await prisma.orgSubscription.findMany({
            where: { isActive: true, org: { isActive: true } },
            include: { product: { select: { monthlyPrice: true } } },
        });
        const mrr = activeSubs.reduce((sum, s) => sum + s.product.monthlyPrice, 0);

        return NextResponse.json({ totalOrgs, activeOrgs, totalUsers, totalProducts, mrr });
    } catch (error) {
        console.error('GET /api/admin/stats error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
