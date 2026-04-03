import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron endpoint that auto-updates each client's "safra" based on credentialDate.
 * M0 → M1 → M2 → M3 → BASE (automatically based on months since credential).
 * 
 * Should be called monthly (e.g., via Coolify cron or external scheduler).
 * POST /api/cron/update-safra
 */
export async function POST(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date();
        const clients = await prisma.client.findMany({
            where: {
                status: "ativo",
                credentialDate: { not: "" },
            },
            select: { id: true, credentialDate: true, safra: true },
        });

        let updated = 0;

        for (const client of clients) {
            if (!client.credentialDate) continue;

            const cd = new Date(client.credentialDate + "T00:00:00");
            const diff = (now.getFullYear() - cd.getFullYear()) * 12 + (now.getMonth() - cd.getMonth());

            let newSafra: string;
            if (diff <= 0) newSafra = "M0";
            else if (diff === 1) newSafra = "M1";
            else if (diff === 2) newSafra = "M2";
            else if (diff === 3) newSafra = "M3";
            else newSafra = "BASE";

            if (client.safra !== newSafra) {
                await prisma.client.update({
                    where: { id: client.id },
                    data: { safra: newSafra },
                });
                updated++;
            }
        }

        return NextResponse.json({
            ok: true,
            checked: clients.length,
            updated,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error("Safra cron error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
