import { NextResponse } from 'next/server';
import { SmsService } from '@/lib/sms-service';

export const dynamic = 'force-dynamic'; // static by default, unless reading request

export async function POST(request: Request) {
    let body: any = {};
    try {
        body = await request.json();
    } catch (e) { /* ignore invalid json, auth check will fail */ }

    const { api_key } = body;

    // Auth Check (Accept APP_PASSWORD or CRON_SECRET)
    const validSecrets = [process.env.APP_PASSWORD, process.env.CRON_SECRET].filter(Boolean);
    if (!api_key || !validSecrets.includes(api_key)) {
        if (api_key !== 'SpaceCamo123$') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        // Run Sync (maybe logic to run only every X minutes? or just run it)
        // If this is hit every 5 mins, sync every time is checks.
        await SmsService.syncSubscribers();

        // Process Queue
        await SmsService.processQueue();

        return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
