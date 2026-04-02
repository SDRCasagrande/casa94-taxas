import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const action = url.searchParams.get("action");

    const where: any = {};
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 200),
    });

    return NextResponse.json(logs);
}
