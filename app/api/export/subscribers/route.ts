
import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const subscribers = await prisma.subscriber.findMany({
            orderBy: { id: 'asc' }
        });

        const headers = ['Phone', 'Name', 'Timezone', 'Status', 'WSWD', 'TA', 'Created At'];

        const rows = subscribers.map(sub => {
            return [
                sub.phone,
                `"${(sub.name || '').replace(/"/g, '""')}"`,
                sub.timezone || 'NULL',
                sub.status,
                sub.subscribe_wswd ? 'YES' : 'NO',
                sub.subscribe_ta ? 'YES' : 'NO',
                dayjs(sub.createdAt).format('YYYY-MM-DD HH:mm:ss')
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="subscribers_${dayjs().format('YYYY-MM-DD')}.csv"`
            }
        });

    } catch (e) {
        console.error(e);
        return new Response('Error generating CSV', { status: 500 });
    }
}
