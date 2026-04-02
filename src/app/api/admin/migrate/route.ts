import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// POST /api/admin/migrate — One-time migration to multi-tenant
// Run once to associate existing data with Organization
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.userRole !== 'super_admin') {
            // Also allow seed key for first run
            const { seedKey } = await request.json().catch(() => ({}));
            if (seedKey !== process.env.SEED_KEY) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const results: string[] = [];

        // 1. Create Organization for Casa94 if not exists
        let org = await prisma.organization.findFirst({ where: { slug: 'casa94-stone' } });
        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Casa94 Stone Xinguará',
                    slug: 'casa94-stone',
                    city: 'Xinguará',
                    state: 'PA',
                    email: 'contato@casa94.com.br',
                },
            });
            results.push(`✅ Organization created: ${org.name} (${org.id})`);
        } else {
            results.push(`⏭️ Organization already exists: ${org.name}`);
        }

        // 2. Create products
        const products = [
            { name: 'BitTask App', slug: 'app', monthlyPrice: 49.90, description: 'Gestão de tarefas em equipe' },
            { name: 'BitTask AI', slug: 'ai', monthlyPrice: 29.90, description: 'Assistente IA com 500 requisições/mês' },
        ];

        for (const p of products) {
            const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
            if (!existing) {
                await prisma.product.create({ data: p });
                results.push(`✅ Product created: ${p.name}`);
            } else {
                results.push(`⏭️ Product already exists: ${p.name}`);
            }
        }

        // 3. Associate all existing users with org
        const usersWithoutOrg = await prisma.user.findMany({ where: { orgId: null } });
        if (usersWithoutOrg.length > 0) {
            // Set super admin
            const superAdminEmail = 'casagrandesdr@gmail.com';
            await prisma.user.updateMany({
                where: { email: { not: superAdminEmail }, orgId: null },
                data: { orgId: org.id, userRole: 'agent' },
            });
            results.push(`✅ Associated ${usersWithoutOrg.length - 1} users with ${org.name}`);

            // Set the main admin of Casa94
            await prisma.user.updateMany({
                where: { orgId: org.id, email: { in: ['casagrandesdr@gmail.com'] } },
                data: { userRole: 'admin' },
            });

            // Create super admin if not exists  
            const superAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
            if (superAdmin) {
                await prisma.user.update({
                    where: { id: superAdmin.id },
                    data: { userRole: 'super_admin', orgId: null },
                });
                results.push(`✅ Super admin set: ${superAdminEmail}`);
            }
        } else {
            results.push(`⏭️ All users already have org`);
        }

        // 4. Associate clients
        const clientsUpdated = await prisma.client.updateMany({
            where: { orgId: null },
            data: { orgId: org.id },
        });
        results.push(clientsUpdated.count > 0 
            ? `✅ Associated ${clientsUpdated.count} clients with ${org.name}`
            : `⏭️ All clients already have org`);

        // 5. Associate task lists
        const listsUpdated = await prisma.taskList.updateMany({
            where: { orgId: null },
            data: { orgId: org.id },
        });
        results.push(listsUpdated.count > 0
            ? `✅ Associated ${listsUpdated.count} task lists with ${org.name}`
            : `⏭️ All task lists already have org`);

        // 6. Associate team groups
        const groupsUpdated = await prisma.teamGroup.updateMany({
            where: { orgId: null },
            data: { orgId: org.id },
        });
        results.push(groupsUpdated.count > 0
            ? `✅ Associated ${groupsUpdated.count} team groups with ${org.name}`
            : `⏭️ All team groups already have org`);

        // 7. Activate products for Casa94
        const productRecords = await prisma.product.findMany();
        for (const p of productRecords) {
            const existing = await prisma.orgSubscription.findFirst({
                where: { orgId: org.id, productId: p.id },
            });
            if (!existing) {
                await prisma.orgSubscription.create({
                    data: { orgId: org.id, productId: p.id },
                });
                results.push(`✅ Activated ${p.name} for ${org.name}`);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
    }
}
