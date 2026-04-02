import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/promote — Promote specific users to admin
// Protected by seedKey
export async function POST(request: Request) {
    try {
        const { seedKey, emails, role } = await request.json();

        if (seedKey !== 'bitkaiser-seed-2026') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const validRoles = ['admin', 'agent', 'super_admin'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        if (!Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
        }

        const results: string[] = [];

        for (const email of emails) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                results.push(`❌ Usuário não encontrado: ${email}`);
                continue;
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { userRole: role },
            });
            results.push(`✅ ${user.name} (${email}) → ${role}`);
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Promote error:', error);
        return NextResponse.json({ error: 'Failed', details: String(error) }, { status: 500 });
    }
}
