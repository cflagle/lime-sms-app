import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, email, name, form_title, traits } = body;

        if (!phone) {
            return NextResponse.json(
                { success: false, error: 'Phone number is required' },
                { status: 400 }
            );
        }

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            );
        }

        // Normalize phone number (remove non-digits)
        let cleanPhone = String(phone).replace(/\D/g, '');

        // If 10 digits, assume US/Canada and prepend 1
        if (cleanPhone.length === 10) {
            cleanPhone = '1' + cleanPhone;
        }

        // Try to find the subscriber
        let subscriber = await prisma.subscriber.findFirst({
            where: {
                OR: [
                    { phone: cleanPhone },
                    { phone: phone }, // Also try the original format
                ]
            }
        });

        if (!subscriber) {
            return NextResponse.json(
                { success: false, error: 'Subscriber not found' },
                { status: 404 }
            );
        }

        // Update the subscriber with the enrichment data
        // Define type to match Prisma interface closer or use any/partial
        const updateData: any = { email };

        if (name) updateData.name = name;
        if (form_title) updateData.form_title = form_title;

        if (traits) {
            // Ensure traits is a string for storage
            if (typeof traits === 'object') {
                updateData.traits = JSON.stringify(traits);
            } else {
                updateData.traits = String(traits);
            }
        }

        const updated = await prisma.subscriber.update({
            where: { id: subscriber.id },
            data: updateData
        });

        console.log(`[Enrich] Updated subscriber ${subscriber.id} with email: ${email}`);

        return NextResponse.json({
            success: true,
            id: updated.id,
            message: 'Subscriber enriched successfully'
        });

    } catch (error: any) {
        console.error('[Enrich] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
