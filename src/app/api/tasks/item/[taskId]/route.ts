import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { updateCalendarEvent, deleteCalendarEvent, createCalendarEvent } from '@/lib/google-calendar';

// PUT update a task (toggle complete, star, reschedule, reassign)
export async function PUT(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { taskId } = await params;
        const body = await request.json();

        const existingTask = await prisma.task.findUnique({
            where: { id: taskId },
            select: { googleCalendarEventId: true, title: true, date: true, time: true, description: true, completed: true, assigneeId: true, dueDate: true, list: { select: { userId: true } }, createdById: true },
        });
        if (!existingTask) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        // Ownership: must be creator, assignee, or list owner
        if (existingTask.list.userId !== session.userId && existingTask.createdById !== session.userId && existingTask.assigneeId !== session.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.completed !== undefined) data.completed = body.completed;
        if (body.starred !== undefined) data.starred = body.starred;
        if (body.scheduled !== undefined) data.scheduled = body.scheduled;
        if (body.title !== undefined) data.title = body.title.trim();
        if (body.description !== undefined) data.description = body.description;
        if (body.priority !== undefined) data.priority = body.priority;
        if (body.date !== undefined) data.date = body.date;
        if (body.time !== undefined) data.time = body.time;
        if (body.dueDate !== undefined) data.dueDate = body.dueDate;
        if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;
        if (body.recurrence !== undefined) data.recurrence = body.recurrence;
        if (body.recurrenceEnd !== undefined) data.recurrenceEnd = body.recurrenceEnd;
        if (body.negotiationId !== undefined) data.negotiationId = body.negotiationId || null;
        if (body.listId !== undefined) data.listId = body.listId;

        const task = await prisma.task.update({
            where: { id: taskId },
            data,
            include: {
                assignee: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });

        // Google Calendar sync
        try {
            if (existingTask) {
                const eventId = existingTask.googleCalendarEventId;

                if (body.completed === true && eventId) {
                    // Task completed → delete calendar event
                    await deleteCalendarEvent(session.userId, eventId);
                    await prisma.task.update({
                        where: { id: taskId },
                        data: { googleCalendarEventId: '' },
                    });
                } else if (body.completed === false && !eventId && task.date) {
                    // Task un-completed → re-create calendar event
                    const newEventId = await createCalendarEvent(session.userId, {
                        title: task.title,
                        description: task.description,
                        date: task.date,
                        time: task.time || undefined,
                    });
                    if (newEventId) {
                        await prisma.task.update({
                            where: { id: taskId },
                            data: { googleCalendarEventId: newEventId, scheduled: true },
                        });
                    }
                } else if (eventId && (body.title || body.date || body.time || body.description)) {
                    // Task updated → update calendar event
                    await updateCalendarEvent(session.userId, eventId, {
                        title: task.title,
                        description: task.description,
                        date: task.date,
                        time: task.time || undefined,
                    });
                } else if (!eventId && task.date && !task.completed) {
                    // Task now has a date but no event → create one
                    const newEventId = await createCalendarEvent(session.userId, {
                        title: task.title,
                        description: task.description,
                        date: task.date,
                        time: task.time || undefined,
                    });
                    if (newEventId) {
                        await prisma.task.update({
                            where: { id: taskId },
                            data: { googleCalendarEventId: newEventId, scheduled: true },
                        });
                    }
                }
            }
        } catch (gcalError) {
            console.error('[GCal] Sync error (non-blocking):', gcalError);
        }

        // Auto-log activity comments
        try {
            if (body.assigneeId !== undefined && body.assigneeId !== existingTask?.assigneeId) {
                const assigneeName = task.assignee?.name || 'Ninguém';
                await prisma.taskComment.create({
                    data: {
                        taskId,
                        userId: session.userId,
                        userName: session.name || 'Sistema',
                        text: `📌 Atribuiu para ${assigneeName}`,
                    },
                });
            }
            if (body.dueDate && body.dueDate !== existingTask?.dueDate) {
                const prazoFormatted = new Date(body.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                await prisma.taskComment.create({
                    data: {
                        taskId,
                        userId: session.userId,
                        userName: session.name || 'Sistema',
                        text: `⏰ Definiu prazo: ${prazoFormatted}`,
                    },
                });
            }
            if (body.completed === true) {
                await prisma.taskComment.create({
                    data: {
                        taskId,
                        userId: session.userId,
                        userName: session.name || 'Sistema',
                        text: `✅ Marcou como concluída`,
                    },
                });
            }
        } catch { /* non-blocking */ }

        return NextResponse.json(task);
    } catch (error) {
        console.error('PUT /api/tasks/item/[taskId] error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// DELETE a task
export async function DELETE(_: Request, { params }: { params: Promise<{ taskId: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { taskId } = await params;

        // Get task before deleting (for calendar sync + ownership check)
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { googleCalendarEventId: true, list: { select: { userId: true } }, createdById: true },
        });
        if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (task.list.userId !== session.userId && task.createdById !== session.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete calendar event if exists
        if (task?.googleCalendarEventId) {
            try {
                await deleteCalendarEvent(session.userId, task.googleCalendarEventId);
            } catch (gcalError) {
                console.error('[GCal] Delete sync error (non-blocking):', gcalError);
            }
        }

        await prisma.task.delete({ where: { id: taskId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/tasks/item/[taskId] error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
