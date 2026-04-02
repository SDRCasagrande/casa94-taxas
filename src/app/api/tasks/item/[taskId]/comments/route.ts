import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET comments for a task
export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { taskId } = await params;

        const comments = await prisma.taskComment.findMany({
            where: { taskId },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(comments);
    } catch (error) {
        console.error("GET task comments error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

// POST a new comment
export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { taskId } = await params;
        const body = await req.json();

        const comment = await prisma.taskComment.create({
            data: {
                taskId,
                userId: session.userId,
                userName: session.name || "Sistema",
                text: body.text,
            },
        });

        return NextResponse.json(comment);
    } catch (error) {
        console.error("POST task comment error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
