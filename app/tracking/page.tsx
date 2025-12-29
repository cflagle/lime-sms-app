import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';
import { MousePointer, CreditCard, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getTrackingEvents() {
    return await prisma.trackingEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
            subscriber: true,
            message: true
        }
    });
}

export default async function TrackingPage() {
    const events = await getTrackingEvents();

    // Calculate summary stats
    const clicks = events.filter(e => e.eventType === 'CLICK').length;
    const purchases = events.filter(e => e.eventType === 'PURCHASE').length;
    const totalRevenue = events
        .filter(e => e.eventType === 'PURCHASE')
        .reduce((sum, e) => sum + (e.revenue || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Tracking Events</h1>
                    <p className="text-slate-400">Click and purchase events from analytics webhook.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/20 rounded-lg">
                            <MousePointer className="w-5 h-5 text-sky-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{clicks.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Total Clicks</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <CreditCard className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{purchases.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Total Purchases</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-lime-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-lime-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-slate-500">Total Revenue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Events Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="p-4">Time</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Message</th>
                            <th className="p-4">Subscriber</th>
                            <th className="p-4">Revenue</th>
                            <th className="p-4">Keyword</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {events.map(event => (
                            <tr key={event.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4 text-slate-500 text-sm whitespace-nowrap">
                                    {dayjs(event.createdAt).format('MMM D, h:mm A')}
                                </td>
                                <td className="p-4">
                                    {event.eventType === 'CLICK' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-sky-500/20 text-sky-400">
                                            <MousePointer className="w-3 h-3" />
                                            CLICK
                                        </span>
                                    ) : event.eventType === 'PURCHASE' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">
                                            <CreditCard className="w-3 h-3" />
                                            PURCHASE
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 rounded text-xs font-bold bg-slate-700 text-slate-400">
                                            {event.eventType}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm">
                                    {event.message ? (
                                        <span className="text-white">{event.message.name}</span>
                                    ) : (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="p-4 text-sm">
                                    {event.subscriber ? (
                                        <span className="font-mono text-slate-300">{event.subscriber.phone}</span>
                                    ) : event.email ? (
                                        <span className="text-slate-400">{event.email}</span>
                                    ) : (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="p-4 text-sm">
                                    {event.revenue ? (
                                        <span className="text-lime-400 font-medium">${event.revenue.toFixed(2)}</span>
                                    ) : (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="p-4 text-xs text-slate-500 font-mono">
                                    {event.keyword || '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {events.length === 0 && (
                    <div className="p-8 text-center text-slate-500">No tracking events yet.</div>
                )}
            </div>
        </div>
    );
}
