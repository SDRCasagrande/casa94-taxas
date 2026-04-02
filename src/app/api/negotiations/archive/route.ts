import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Auto-archive negotiations that have been in "fechado" or "recusada" status
 * for more than 30 days. Sets status to "arquivado".
 * Can be triggered by cron or on dashboard load.
 */
export async function POST() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await prisma.negotiation.updateMany({
            where: {
                status: { in: ["fechado", "recusada"] },
                updatedAt: { lt: thirtyDaysAgo },
            },
            data: {
                status: "arquivado",
            },
        });

        return NextResponse.json({ archived: result.count });
    } catch (error) {
        console.error("[Archive] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// GET to check stats
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const count = await prisma.negotiation.count({
            where: {
                status: { in: ["fechado", "recusada"] },
                updatedAt: { lt: thirtyDaysAgo },
            },
        });

        return NextResponse.json({ pendingArchive: count });
    } catch (error) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
