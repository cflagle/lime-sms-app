import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. Check Authentication (Extra safety, though middleware handles it)
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTH_COOKIE_NAME);

    if (!authCookie) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 2. Fetch Messages
        const messages = await prisma.message.findMany({
            orderBy: { createdAt: 'asc' },
            select: {
                name: true,
                content: true,
                brand: true,
                active: true,
                cooldownDays: true,
                // We exclude ID to let the target system generate new ones
                // We exclude campaignId for now as campaigns might not exist
            }
        });

        // 3. Return JSON with a nice filename for browser download
        const json = JSON.stringify(messages, null, 2);

        return new NextResponse(json, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="messages_export_${new Date().toISOString().split('T')[0]}.json"`
            }
        });

    } catch (error: any) {
        console.error("Export Error:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
