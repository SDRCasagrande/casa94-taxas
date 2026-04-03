import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/clients/import
 * Bulk import clients from CSV data (parsed on the frontend).
 * Body: { clients: Array<{ name, stoneCode?, cnpj?, phone?, email?, segment?, brand?, safra?, credentialDate?, category? }> }
 */
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { clients } = await request.json();
        if (!Array.isArray(clients) || clients.length === 0) {
            return NextResponse.json({ error: "No clients provided" }, { status: 400 });
        }

        if (clients.length > 500) {
            return NextResponse.json({ error: "Max 500 clients per import" }, { status: 400 });
        }

        const results = { imported: 0, skipped: 0, errors: [] as string[] };

        for (const c of clients) {
            if (!c.name?.trim()) {
                results.skipped++;
                results.errors.push(`Linha sem nome — pulada`);
                continue;
            }

            // Check for duplicate by stoneCode or cnpj
            if (c.stoneCode || c.cnpj) {
                const existing = await prisma.client.findFirst({
                    where: {
                        userId: session.userId,
                        OR: [
                            ...(c.stoneCode ? [{ stoneCode: c.stoneCode }] : []),
                            ...(c.cnpj ? [{ cnpj: c.cnpj }] : []),
                        ],
                    },
                });
                if (existing) {
                    results.skipped++;
                    results.errors.push(`"${c.name}" já existe (${c.stoneCode ? 'SC: ' + c.stoneCode : c.cnpj})`);
                    continue;
                }
            }

            try {
                await prisma.client.create({
                    data: {
                        userId: session.userId,
                        orgId: session.orgId || null,
                        name: c.name.trim(),
                        stoneCode: c.stoneCode?.trim() || "",
                        cnpj: c.cnpj?.trim() || "",
                        phone: c.phone?.trim() || "",
                        email: c.email?.trim() || "",
                        segment: c.segment?.trim() || "",
                        brand: c.brand?.trim()?.toUpperCase() || "STONE",
                        safra: c.safra?.trim() || "M0",
                        credentialDate: c.credentialDate?.trim() || "",
                        category: c.category?.trim() || "",
                    },
                });
                results.imported++;
            } catch (err: any) {
                results.skipped++;
                results.errors.push(`"${c.name}": ${err.message?.slice(0, 80)}`);
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("POST /api/clients/import error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
