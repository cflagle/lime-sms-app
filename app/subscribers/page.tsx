import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

async function getSubscribers() {
    return await prisma.subscriber.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100 // Limit for now
    });
}

export default async function SubscribersPage() {
    const subscribers = await getSubscribers();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Subscribers</h1>
                    <p className="text-slate-400">View and manage your opted-in users.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-slate-500 text-sm">
                        Total: {subscribers.length}
                    </div>
                    <a
                        href="/api/export/subscribers"
                        target="_blank"
                        className="bg-lime-600 hover:bg-lime-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                        Export CSV
                    </a>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="p-4">Phone</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Brands</th>
                            <th className="p-4">Last Engagement</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {subscribers.map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4 font-mono text-lime-400">{sub.phone}</td>
                                <td className="p-4">{sub.name || '-'}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${sub.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {sub.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-1">
                                        {sub.subscribe_wswd && <span className="bg-blue-500/20 text-blue-400 px-1 rounded text-xs">WSWD</span>}
                                        {sub.subscribe_ta && <span className="bg-purple-500/20 text-purple-400 px-1 rounded text-xs">TA</span>}
                                    </div>
                                </td>
                                <td className="p-4 text-slate-500 text-sm">
                                    {sub.last_engagement ? dayjs(sub.last_engagement).format('MMM D, YYYY') : 'Never'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {subscribers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">No subscribers found in database.</div>
                )}
            </div>
        </div>
    );
}
