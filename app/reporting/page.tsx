import { prisma } from '@/lib/prisma';
import ReportingTable from './ReportingTable';

export const dynamic = 'force-dynamic';

export default async function ReportingPage() {
    // 1. Fetch all messages (Active & Archived)
    const messages = await prisma.message.findMany({
        orderBy: { createdAt: 'desc' }
    });

    // 2. Aggregate Sent Logs by Message
    const sentCounts = await prisma.sentLog.groupBy({
        by: ['messageId'],
        _count: { id: true }
    });

    // 3. Aggregate Tracking Events by Message
    const trackingStats = await prisma.trackingEvent.groupBy({
        by: ['messageId', 'eventType'],
        _count: { id: true },
        _sum: { revenue: true }
    });

    // 4. Build Lookup Maps
    const sentMap = new Map<number, number>();
    sentCounts.forEach(s => sentMap.set(s.messageId, s._count.id));

    const statsMap = new Map<number, { clicks: number, purchases: number, revenue: number }>();

    trackingStats.forEach(t => {
        if (!t.messageId) return;
        const current = statsMap.get(t.messageId) || { clicks: 0, purchases: 0, revenue: 0 };
        if (t.eventType === 'CLICK') {
            current.clicks += t._count.id;
        } else if (t.eventType === 'PURCHASE') {
            current.purchases += t._count.id;
            current.revenue += t._sum.revenue || 0;
        }
        statsMap.set(t.messageId, current);
    });

    // 5. Merge Data
    const reportData = messages.map(msg => {
        const sent = sentMap.get(msg.id) || 0;
        const stats = statsMap.get(msg.id) || { clicks: 0, purchases: 0, revenue: 0 };

        // Calculate Metrics
        // CTR = (Clicks / Sent) * 100
        const ctr = sent > 0 ? (stats.clicks / sent) * 100 : 0;

        // RPM = (Revenue / Sent) * 1000
        const rpm = sent > 0 ? (stats.revenue / sent) * 1000 : 0;

        return {
            id: msg.id,
            name: msg.name,
            brand: msg.brand,
            active: msg.active,
            sent,
            clicks: stats.clicks,
            purchases: stats.purchases,
            revenue: stats.revenue,
            ctr,
            rpm
        };
    });

    // Initial Sort: Most Sent desc
    reportData.sort((a, b) => b.sent - a.sent);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Performance Reporting</h1>
                <p className="text-slate-400">Detailed analytics by message.</p>
            </div>

            <ReportingTable data={reportData} />
        </div>
    );
}
