import { NextResponse } from 'next/server';
import { LimeClient } from '@/lib/lime-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, name } = body;

        if (!url) {
            return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }

        // Call Lime API
        // We use a default name if not provided (e.g. "Message Link [Date]")
        const linkName = name || `Link ${new Date().toISOString()}`;

        // Note: We might need to handle the listId if we want segment tracking, 
        // but for now we'll do a generic tracking link.
        const response = await LimeClient.createTrackingLink(url, linkName);

        // Parse response. 
        // Docs say success response has `trackedUrl`.
        const shortLink = response.trackedUrl || response.short_url || response.url;

        if (!shortLink) {
            console.error("Lime Link Response:", response);
            throw new Error("Could not retrieve short link from Lime response");
        }

        return NextResponse.json({ success: true, shortLink });
    } catch (error: any) {
        console.error("Shorten Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
