import { prisma } from '@/lib/prisma';
import MessageItem from './MessageItem';
import MessageCreatorWrapper from './MessageCreatorWrapper'; // Import the new wrapper component

// Ensure we force dynamic rendering so we see new messages
export const dynamic = 'force-dynamic';

interface MessageStats {
    sends: number;
    clicks: number;
    purchases: number;
    revenue: number;
}

async function getMessagesWithStats(showArchived: boolean = false) {
    // Get all messages with sent log counts
    const messages = await prisma.message.findMany({
        orderBy: { createdAt: 'desc' },
        where: { active: !showArchived },
        include: {
            campaign: true,
            _count: {
                select: { sentLogs: true }
            }
        }
    });

    // Get tracking event stats for each message
    const messageIds = messages.map(m => m.id);

    // Aggregate clicks per message
    const clickStats = await prisma.trackingEvent.groupBy({
        by: ['messageId'],
        where: {
            messageId: { in: messageIds },
            eventType: 'CLICK'
        },
        _count: { id: true }
    });

    // Aggregate purchases and revenue per message
    const purchaseStats = await prisma.trackingEvent.groupBy({
        by: ['messageId'],
        where: {
            messageId: { in: messageIds },
            eventType: 'PURCHASE'
        },
        _count: { id: true },
        _sum: { revenue: true }
    });

    // Build a lookup map
    const statsMap = new Map<number, MessageStats>();

    for (const msg of messages) {
        statsMap.set(msg.id, {
            sends: msg._count.sentLogs,
            clicks: 0,
            purchases: 0,
            revenue: 0
        });
    }

    for (const click of clickStats) {
        if (click.messageId) {
            const stats = statsMap.get(click.messageId);
            if (stats) stats.clicks = click._count.id;
        }
    }

    for (const purchase of purchaseStats) {
        if (purchase.messageId) {
            const stats = statsMap.get(purchase.messageId);
            if (stats) {
                stats.purchases = purchase._count.id;
                stats.revenue = purchase._sum.revenue || 0;
            }
        }
    }

    return messages.map(msg => ({
        ...msg,
        stats: statsMap.get(msg.id) || { sends: 0, clicks: 0, purchases: 0, revenue: 0 }
    }));
}

export default async function MessagesPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const showArchived = searchParams?.view === 'archived';
    const messages = await getMessagesWithStats(showArchived);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Message Pool</h1>
                    <p className="text-slate-400">Manage the ads/messages sent to subscribers.</p>
                </div>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                    <a
                        href="/messages"
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${!showArchived ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Active
                    </a>
                    <a
                        href="/messages?view=archived"
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${showArchived ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Archived
                    </a>
                </div>
            </div>

            {/* Only show Creator in Active View */}
            {!showArchived && <MessageCreatorWrapper />}

            {/* Message List */}
            <div className="grid gap-4">
                {messages.map((msg) => (
                    <MessageItem key={msg.id} msg={msg} stats={msg.stats} />
                ))}
            </div>
            {messages.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    {showArchived ? 'No archived messages found.' : 'No active messages in the pool.'}
                </div>
            )}
        </div>
    );
}
