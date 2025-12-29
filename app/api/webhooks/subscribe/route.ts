
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// @ts-ignore
import { parsePhoneNumber } from 'libphonenumber-js';
import { AREA_CODE_TIMEZONES } from '@/lib/area-codes';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, name, email, keywords } = body;

        if (!phone) {
            return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 });
        }

        // Normalize Phone
        // Remove all non-digits
        const cleanPhone = String(phone).replace(/\D/g, '');
        // Ensure 10+ digits. If 10, assume US/Canada +1.
        let finalPhone = cleanPhone;
        if (cleanPhone.length === 10) {
            finalPhone = '1' + cleanPhone;
        }

        // Use + prefix if not present? Our DB seems to use just digits or whatever comes from Lime.
        // Lime XML sync seemed to use raw digits. 
        // Let's stick to simple cleaning unless we see strict format in DB.

        // JIT Timezone Logic
        let tz = 'America/New_York'; // Default
        try {
            // Re-use logic from SmsService (or refactor shared helper later)
            // Adding + for library parsing if needed, but it handles US local well usually
            const phoneNumber = parsePhoneNumber(finalPhone, 'US');
            if (phoneNumber && (phoneNumber.country === 'US' || phoneNumber.country === 'CA')) {
                const national = phoneNumber.nationalNumber as string;
                const areaCode = national.substring(0, 3);
                if (AREA_CODE_TIMEZONES[areaCode]) {
                    tz = AREA_CODE_TIMEZONES[areaCode];
                }
            }
        } catch (e) {
            console.error("Webhook TZ Error:", e);
        }

        // Determine Subscriptions from Keywords (if provided)
        // e.g. "STOCK", "TRADE"
        let subscribe_wswd = false;
        let subscribe_ta = false;

        if (keywords) {
            const k = String(keywords).toUpperCase();
            if (k.includes('STOCK')) subscribe_wswd = true;
            if (k.includes('TRADE')) subscribe_ta = true;
        } else {
            // Default to ONE or BOTH?
            // "subscribe endpoint... make it so we don't have to sync"
            // Usually landing pages imply a specific list. 
            // Let's default to FALSE unless specified, OR enable default list?
            // User didn't specify. Let's assume generic opt-in means something.
            // Safe bet: Enable WSWD as default? Or just leave false and let them manage?
            // Let's enable WSWD by default if nothing specified, to ensure they get something.
            subscribe_wswd = true;
        }

        // Upsert
        const result = await prisma.subscriber.upsert({
            where: { phone: finalPhone },
            update: {
                status: 'ACTIVE',
                // Only update keys if provided? Or force enable?
                // Let's force enable what they asked for.
                ...(keywords ? { subscribe_wswd, subscribe_ta } : {})
            },
            create: {
                phone: finalPhone,
                name: name || 'Subscriber',
                email: email || null,
                status: 'ACTIVE',
                subscribe_wswd: subscribe_wswd,
                subscribe_ta: subscribe_ta,
                timezone: tz,
                createdAt: new Date(),
                last_engagement: new Date() // Mark as engaged on signup
            }
        });

        return NextResponse.json({ success: true, id: result.id });
    } catch (error: any) {
        console.error("Subscribe Webhook Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
