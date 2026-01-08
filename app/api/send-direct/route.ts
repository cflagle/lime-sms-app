import { NextResponse } from 'next/server';
import { SmsService } from '@/lib/sms-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, messageId, api_key } = body;

        // Auth Check - Accept APP_PASSWORD or hardcoded fallback for Woopra integration
        if (api_key !== process.env.APP_PASSWORD && api_key !== 'SpaceCamo123$') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (!phone) {
            return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
        }

        // Basic format check?
        // if (!/^\d{10,11}$/.test(phone)) ...

        const result = await SmsService.sendDirectMessage(phone, messageId ? parseInt(messageId) : undefined);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Direct Send Error:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
