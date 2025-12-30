import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation Schema
const SubscriberUpsertSchema = z.object({
    phone: z.string().min(10), // Required
    email: z.string().email().optional().nullable(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    form_title: z.string().optional().nullable(),
    traits: z.record(z.any()).optional().nullable(), // Accepts JSON object

    // Acquisition Fields
    acq_source: z.string().optional().nullable(),
    acq_campaign: z.string().optional().nullable(),
    acq_medium: z.string().optional().nullable(),
    acq_content: z.string().optional().nullable(),
    acq_term: z.string().optional().nullable(),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. Authorization Check (Body api_key)
        // We accept either APP_PASSWORD (SpaceCamo123$) or CRON_SECRET as the token
        const { api_key } = body;
        const validSecrets = [process.env.APP_PASSWORD, process.env.CRON_SECRET].filter(Boolean);

        if (!api_key || !validSecrets.includes(api_key)) {
            if (api_key !== 'SpaceCamo123$') {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Parse Body (continue)
        const data = SubscriberUpsertSchema.parse(body);

        // 3. Upsert Subscriber
        // We strictly use PHONE as the unique identifier
        const traitsString = data.traits ? JSON.stringify(data.traits) : undefined;

        const subscriber = await prisma.subscriber.upsert({
            where: { phone: data.phone },
            update: {
                ...(data.email !== undefined && { email: data.email }),
                ...(data.firstName !== undefined && { firstName: data.firstName }),
                ...(data.lastName !== undefined && { lastName: data.lastName }),
                ...(data.form_title !== undefined && { form_title: data.form_title }),
                ...(traitsString !== undefined && { traits: traitsString }),

                ...(data.acq_source !== undefined && { acq_source: data.acq_source }),
                ...(data.acq_campaign !== undefined && { acq_campaign: data.acq_campaign }),
                ...(data.acq_medium !== undefined && { acq_medium: data.acq_medium }),
                ...(data.acq_content !== undefined && { acq_content: data.acq_content }),
                ...(data.acq_term !== undefined && { acq_term: data.acq_term }),
            },
            create: {
                phone: data.phone,
                status: 'ACTIVE', // Default to Active on creation
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                form_title: data.form_title,
                traits: traitsString,

                acq_source: data.acq_source,
                acq_campaign: data.acq_campaign,
                acq_medium: data.acq_medium,
                acq_content: data.acq_content,
                acq_term: data.acq_term,

                // Defaults for required/logic fields
                subscribe_wswd: false, // Don't auto-subscribe to brands without logic
                subscribe_ta: false,
                timezone: 'America/New_York' // Default
            }
        });

        const action = subscriber.createdAt.getTime() === subscriber.updatedAt.getTime() ? 'created' : 'updated';

        // 4. Log Tracking Event
        await prisma.trackingEvent.create({
            data: {
                eventType: action === 'created' ? 'SUBSCRIBE' : 'UPDATE',
                subscriberId: subscriber.id,
                // Log acquisition data if present
                trafficSource: data.acq_source,
                utmSource: data.acq_source,
                utmMedium: data.acq_medium,
                utmCampaign: data.acq_campaign,
                utmContent: data.acq_content,
                utmTerm: data.acq_term,
                email: data.email,
            }
        });

        return NextResponse.json({
            success: true,
            id: subscriber.id,
            action: action
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation Failed', details: error.errors }, { status: 400 });
        }
        console.error("Subscriber API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
