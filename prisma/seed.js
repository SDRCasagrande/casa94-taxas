const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const DEFAULT_ROLES = [
    {
        name: "Admin",
        description: "Acesso total ao sistema",
        permissions: [
            "dashboard.view", "cet.use", "simulator.use", "comparator.use",
            "clients.view", "clients.manage", "negotiations.view", "negotiations.manage",
            "users.view", "users.manage", "roles.manage", "settings.view", "reports.export", "tasks.use",
        ],
    },
    {
        name: "Consultor",
        description: "Acesso a ferramentas de simulação e clientes",
        permissions: [
            "dashboard.view", "cet.use", "simulator.use", "comparator.use",
            "clients.view", "clients.manage", "negotiations.view", "negotiations.manage",
            "settings.view", "reports.export", "tasks.use",
        ],
    },
    {
        name: "Visualizador",
        description: "Apenas visualização",
        permissions: [
            "dashboard.view", "cet.use", "simulator.use", "comparator.use",
            "clients.view", "negotiations.view", "tasks.use",
        ],
    },
];

async function main() {
    const prisma = new PrismaClient();
    const pw = await bcrypt.hash("Stone-001", 12);

    // ── Seed Roles ──
    for (const role of DEFAULT_ROLES) {
        const upserted = await prisma.role.upsert({
            where: { name: role.name },
            update: { description: role.description },
            create: { name: role.name, description: role.description },
        });

        // Sync permissions: remove old, add missing
        await prisma.rolePermission.deleteMany({ where: { roleId: upserted.id } });
        for (const perm of role.permissions) {
            await prisma.rolePermission.create({
                data: { roleId: upserted.id, permission: perm },
            });
        }
        console.log(`  ✓ Cargo: ${role.name} (${role.permissions.length} permissões)`);
    }

    // ── Seed Users ──
    const users = [
        { name: "Eliel", email: "eliel@casa94.com" },
        { name: "Mateus", email: "mateus@casa94.com" },
        { name: "Luciana", email: "luciana@casa94.com" },
        { name: "Nayane", email: "nayane@casa94.com" },
        { name: "José", email: "jose@casa94.com" },
        { name: "Wilson", email: "wilson@casa94.com" },
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { name: u.name, email: u.email, password: pw },
        });
        console.log(`  ✓ ${u.name} (${u.email})`);
    }

    console.log(`\nSeeded ${DEFAULT_ROLES.length} roles + ${users.length} users! Password: Stone-001`);
    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

