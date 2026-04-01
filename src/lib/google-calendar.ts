import { google } from 'googleapis';
import { prisma } from './prisma';
import { encrypt, decrypt, isEncrypted } from './encryption';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export function getOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-calendar/callback'
    );
}

export function getAuthUrl(userId: string) {
    const client = getOAuthClient();
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: userId,
    });
}

export async function exchangeCode(code: string) {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    return tokens;
}

/**
 * Get authenticated calendar client for a user.
 * Automatically refreshes expired tokens.
 */
export async function getCalendarClient(userId: string) {
    const tokenRecord = await prisma.googleCalendarToken.findUnique({
        where: { userId },
    });

    if (!tokenRecord) return null;

    const client = getOAuthClient();
    client.setCredentials({
        access_token: isEncrypted(tokenRecord.accessToken) ? decrypt(tokenRecord.accessToken) : tokenRecord.accessToken,
        refresh_token: isEncrypted(tokenRecord.refreshToken) ? decrypt(tokenRecord.refreshToken) : tokenRecord.refreshToken,
        expiry_date: tokenRecord.expiresAt.getTime(),
    });

    // Auto-refresh if expired
    if (tokenRecord.expiresAt.getTime() < Date.now()) {
        try {
            const { credentials } = await client.refreshAccessToken();
            await prisma.googleCalendarToken.update({
                where: { userId },
                data: {
                    accessToken: encrypt(credentials.access_token || (isEncrypted(tokenRecord.accessToken) ? decrypt(tokenRecord.accessToken) : tokenRecord.accessToken)),
                    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : tokenRecord.expiresAt,
                },
            });
            client.setCredentials(credentials);
        } catch (error) {
            console.error('[GCal] Token refresh failed for user:', userId, error);
            // Delete invalid token
            await prisma.googleCalendarToken.delete({ where: { userId } }).catch(() => {});
            return null;
        }
    }

    return google.calendar({ version: 'v3', auth: client });
}

/**
 * Create a Google Calendar event for a task.
 */
export async function createCalendarEvent(userId: string, task: {
    title: string;
    description?: string;
    date?: string;
    time?: string;
}) {
    const calendar = await getCalendarClient(userId);
    if (!calendar || !task.date) return null;

    try {
        const startDate = task.date;
        let event: any;

        if (task.time) {
            // Timed event
            const startDateTime = `${startDate}T${task.time}:00`;
            const endHour = parseInt(task.time.split(':')[0]) + 1;
            const endTime = `${String(endHour).padStart(2, '0')}:${task.time.split(':')[1]}`;
            const endDateTime = `${startDate}T${endTime}:00`;

            event = {
                summary: `📋 ${task.title}`,
                description: `${task.description || ''}\n\n— BitTask (auto-sync)`.trim(),
                start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
                reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
            };
        } else {
            // All-day event
            event = {
                summary: `📋 ${task.title}`,
                description: `${task.description || ''}\n\n— BitTask (auto-sync)`.trim(),
                start: { date: startDate },
                end: { date: startDate },
                reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
            };
        }

        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });

        return res.data.id || null;
    } catch (error) {
        console.error('[GCal] Create event failed:', error);
        return null;
    }
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateCalendarEvent(userId: string, eventId: string, task: {
    title: string;
    description?: string;
    date?: string;
    time?: string;
    completed?: boolean;
}) {
    const calendar = await getCalendarClient(userId);
    if (!calendar || !eventId) return false;

    try {
        if (task.completed) {
            // If completed, delete the event
            await calendar.events.delete({ calendarId: 'primary', eventId });
            return true;
        }

        if (!task.date) return false;

        const update: any = {
            summary: `📋 ${task.title}`,
            description: `${task.description || ''}\n\n— BitTask (auto-sync)`.trim(),
        };

        if (task.time) {
            const startDateTime = `${task.date}T${task.time}:00`;
            const endHour = parseInt(task.time.split(':')[0]) + 1;
            const endTime = `${String(endHour).padStart(2, '0')}:${task.time.split(':')[1]}`;
            const endDateTime = `${task.date}T${endTime}:00`;
            update.start = { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' };
            update.end = { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' };
        } else {
            update.start = { date: task.date };
            update.end = { date: task.date };
        }

        await calendar.events.update({
            calendarId: 'primary',
            eventId,
            requestBody: update,
        });

        return true;
    } catch (error) {
        console.error('[GCal] Update event failed:', error);
        return false;
    }
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(userId: string, eventId: string) {
    const calendar = await getCalendarClient(userId);
    if (!calendar || !eventId) return false;

    try {
        await calendar.events.delete({ calendarId: 'primary', eventId });
        return true;
    } catch (error) {
        console.error('[GCal] Delete event failed:', error);
        return false;
    }
}

/**
 * Check if a user has Google Calendar connected.
 */
export async function isCalendarConnected(userId: string) {
    const token = await prisma.googleCalendarToken.findUnique({
        where: { userId },
        select: { id: true, expiresAt: true },
    });
    return !!token;
}
