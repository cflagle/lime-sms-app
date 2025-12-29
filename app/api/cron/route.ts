import { NextResponse } from 'next/server';
import { SmsService } from '@/lib/sms-service';

export const dynamic = 'force-dynamic'; // static by default, unless reading request

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Optional security: check for a secret
        // For now, allow public access or maybe just checking query param?
        // Let's assume open for this draft or check env.
        // return new NextResponse('Unauthorized', { status: 401 });
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
