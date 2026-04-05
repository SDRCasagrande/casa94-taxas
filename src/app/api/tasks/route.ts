import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET all task lists with tasks for current user
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Show task lists: personal lists + shared org lists
        const listConditions: any[] = [{ userId: session.userId }];
        if (session.orgId) {
            listConditions.push({ orgId: session.orgId, shared: true });
        }

        const taskInclude = {
            tasks: {
                include: {
                    assignee: { select: { id: true, name: true, email: true } },
                    createdBy: { select: { id: true, name: true } },
                    client: { select: { id: true, name: true, userId: true } },
                    subtasks: { orderBy: { order: 'asc' as const } },
                },
                orderBy: { createdAt: 'asc' as const },
            },
            user: { select: { id: true, name: true } },
        };

        let lists = await prisma.taskList.findMany({
            where: { OR: listConditions },
            include: taskInclude,
            orderBy: { createdAt: 'asc' },
        });

        // Auto-create default list on first visit
        if (lists.length === 0) {
            const newList = await prisma.taskList.create({
                data: { name: 'Minhas Tarefas', userId: session.userId, orgId: session.orgId || null },
                include: taskInclude,
            });
            lists = [newList];
        }

        // ═══ PARALLEL QUERIES — run independent fetches simultaneously ═══
        const teamWhere: any = {};
        if (session.orgId) teamWhere.orgId = session.orgId;

        const [assignedTasks, userGroups, teams] = await Promise.all([
            // Tasks assigned TO this user (from any list)
            prisma.task.findMany({
                where: { assigneeId: session.userId },
                include: {
                    assignee: { select: { id: true, name: true, email: true } },
                    createdBy: { select: { id: true, name: true } },
                    list: { select: { name: true } },
                    group: { select: { id: true, name: true } },
                    client: { select: { id: true, name: true, userId: true } },
                    subtasks: { orderBy: { order: 'asc' } },
                },
            }),
            // Groups the user belongs to
            prisma.teamGroupMember.findMany({
                where: { userId: session.userId },
                select: { groupId: true },
            }),
            // Teams for UI
            prisma.teamGroup.findMany({
                where: teamWhere,
                include: {
                    members: { include: { user: { select: { id: true, name: true } } } },
                    _count: { select: { tasks: true } },
                },
                orderBy: { name: "asc" },
            }),
        ]);

        // Conditional group tasks query (only if user belongs to groups)
        const groupIds = userGroups.map(g => g.groupId);
        let groupTasks: any[] = [];
        if (groupIds.length > 0) {
            groupTasks = await prisma.task.findMany({
                where: {
                    groupId: { in: groupIds },
                    createdById: { not: session.userId },
                    assigneeId: { not: session.userId },
                },
                include: {
                    assignee: { select: { id: true, name: true, email: true } },
                    createdBy: { select: { id: true, name: true } },
                    list: { select: { name: true } },
                    group: { select: { id: true, name: true } },
                    client: { select: { id: true, name: true, userId: true } },
                    subtasks: { orderBy: { order: 'asc' } },
                },
            });
        }

        return NextResponse.json({ lists, assignedTasks, groupTasks, teams });
    } catch (error) {
        console.error('GET /api/tasks error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST create new task list
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { name, shared } = await request.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

        const list = await prisma.taskList.create({
            data: {
                name: name.trim(),
                userId: session.userId,
                orgId: session.orgId || null,
                shared: shared === true,
            },
            include: { tasks: true },
        });

        return NextResponse.json(list, { status: 201 });
    } catch (error) {
        console.error('POST /api/tasks error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
