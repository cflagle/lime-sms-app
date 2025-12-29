
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAnalytics } from '@/lib/analytics-logger';

export async function POST(request: Request) {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    let rawBody = '';

    try {
        // Get raw body for logging
        rawBody = await request.text();

        // Try to parse as JSON
        let body;
        try {
            body = JSON.parse(rawBody);
        } catch (parseError) {
            logAnalytics('ERROR', 'Invalid JSON body', {
                requestId,
                error: 'PARSE_ERROR',
                rawBody: rawBody.substring(0, 500),
                hint: 'Ensure Content-Type is application/json and body is valid JSON'
            });
            return NextResponse.json({
                success: false,
                error: 'Invalid JSON body',
                hint: 'Ensure Content-Type is application/json and body is valid JSON'
            }, { status: 400 });
        }

        // Log incoming request
        logAnalytics('INFO', 'Incoming request', {
            requestId,
            event: body.event,
            email: body.email,
            phone: body.phone,
            t202kw: body.t202kw,
            revenue: body.revenue
        });

        // Destructure all expected fields
        const {
            event,
            email,
            phone,
            publisher,
            offer,
            traffic_source,
            landing_page,
            traffic_source_account,
            utm_source,
            utm_medium,
            utm_term,
            utm_content,
            utm_campaign,
            t202kw,
            gclid,
            revenue,
            timestamp
        } = body;

        // Normalize Event Type
        const eventType = (event || 'UNKNOWN').toUpperCase();

        // 1. Try to find Subscriber
        let subscriberId: number | null = null;
        let subscriber = null;

        if (email) {
            subscriber = await prisma.subscriber.findFirst({
                where: { email: email }
            });
            if (subscriber) {
                logAnalytics('INFO', 'Matched subscriber by email', {
                    requestId,
                    subscriberId: subscriber.id,
                    email
                });
            }
        }

        if (!subscriber && phone) {
            const cleanPhone = String(phone).replace(/\D/g, '');
            subscriber = await prisma.subscriber.findFirst({
                where: { phone: { contains: cleanPhone } }
            });
            if (subscriber) {
                logAnalytics('INFO', 'Matched subscriber by phone', {
                    requestId,
                    subscriberId: subscriber.id,
                    phone: cleanPhone
                });
            }
        }

        if (!subscriber && (email || phone)) {
            logAnalytics('WARN', 'No subscriber found', {
                requestId,
                email,
                phone
            });
        }

        if (subscriber) {
            subscriberId = subscriber.id;
        }

        // 2. Try to resolve message from keyword (t202kw)
        let messageId: number | null = null;
        if (t202kw) {
            const message = await prisma.message.findUnique({
                where: { name: t202kw }
            });
            if (message) {
                messageId = message.id;
                logAnalytics('INFO', 'Resolved message from keyword', {
                    requestId,
                    keyword: t202kw,
                    messageId
                });
            } else {
                logAnalytics('WARN', 'No message found for keyword', {
                    requestId,
                    keyword: t202kw
                });
            }
        } else {
            logAnalytics('WARN', 'No t202kw provided', { requestId });
        }

        // 3. Create Tracking Event
        const trackingEvent = await prisma.trackingEvent.create({
            data: {
                eventType,
                publisher: publisher || null,
                offer: offer || null,
                trafficSource: traffic_source || null,
                landingPage: landing_page || null,
                trafficSourceAccount: traffic_source_account || null,
                utmSource: utm_source || null,
                utmMedium: utm_medium || null,
                utmTerm: utm_term || null,
                utmContent: utm_content || null,
                utmCampaign: utm_campaign || null,
                keyword: t202kw || null,
                gclid: gclid || null,
                email: email || null,
                revenue: revenue ? Number(revenue) : null,
                subscriberId: subscriberId,
                messageId: messageId
            }
        });

        logAnalytics('INFO', 'Created TrackingEvent', {
            requestId,
            eventId: trackingEvent.id,
            eventType,
            messageId,
            subscriberId
        });

        // 4. Update Engagement and Behavioral Tracking (if subscriber matched)
        if (subscriberId && subscriber) {
            const now = new Date();

            const updateData: Record<string, unknown> = {
                last_engagement: now
            };

            if (eventType === 'CLICK') {
                updateData.hasClicked = true;
                updateData.totalClicks = { increment: 1 };
                if (!subscriber.firstClickAt) {
                    updateData.firstClickAt = now;
                }
                logAnalytics('INFO', 'Updated subscriber click stats', {
                    requestId,
                    subscriberId
                });
            }

            if (eventType === 'PURCHASE') {
                updateData.hasPurchased = true;
                updateData.totalPurchases = { increment: 1 };
                if (revenue && Number(revenue) > 0) {
                    updateData.totalRevenue = { increment: Number(revenue) };
                }
                if (!subscriber.firstPurchaseAt) {
                    updateData.firstPurchaseAt = now;
                }
                logAnalytics('INFO', 'Updated subscriber purchase stats', {
                    requestId,
                    subscriberId,
                    revenue
                });
            }

            await prisma.subscriber.update({
                where: { id: subscriberId },
                data: updateData
            });
        }

        return NextResponse.json({
            success: true,
            matched: !!subscriberId,
            eventId: trackingEvent.id,
            messageId: messageId,
            subscriberId: subscriberId
        });
    } catch (error: any) {
        logAnalytics('ERROR', 'Request failed', {
            requestId,
            error: error.message,
            stack: error.stack,
            rawBody: rawBody.substring(0, 500)
        });
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
