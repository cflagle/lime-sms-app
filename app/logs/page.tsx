import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const dynamic = 'force-dynamic';

async function getLogs() {
    return await prisma.sentLog.findMany({
        orderBy: { sentAt: 'desc' },
        take: 100,
        include: { subscriber: true, message: true }
    });
}

import { LogsExport } from './LogsExport';

export default async function LogsPage() {
    const logs = await getLogs();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Delivery Logs</h1>
                    <p className="text-slate-400">History of all messages sent.</p>
                </div>
                <LogsExport logs={logs} />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="p-4">Time</th>
                            <th className="p-4">To</th>
                            <th className="p-4">Timezone</th>
                            <th className="p-4">Brand</th>
                            <th className="p-4">Content</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4 text-slate-500 text-sm">
                                    {dayjs(log.sentAt).tz('America/New_York').format('MMM D, h:mm A')}
                                </td>
                                <td className="p-4 font-mono">{log.subscriber?.phone || log.subscriberId}</td>
                                <td className="p-4 text-xs text-slate-400">
                                    {log.subscriber?.timezone || <span className="text-slate-600">no timezone</span>}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.brand === 'WSWD' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                        {log.brand}
                                    </span>
                                </td>
                                <td className="p-4 text-sm truncate max-w-xs">{log.message?.content || 'Deleted Message'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && (
                    <div className="p-8 text-center text-slate-500">No logs yet.</div>
                )}
            </div>
        </div>
    );
}
