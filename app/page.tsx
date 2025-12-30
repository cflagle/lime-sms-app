import { Users, MessageSquare, Activity, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

async function getStats() {
  const subscriberCount = await prisma.subscriber.count({ where: { status: 'ACTIVE' } });
  const messageCount = await prisma.message.count({ where: { active: true } });

  // Sent today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentToday = await prisma.sentLog.count({
    where: { sentAt: { gte: today } }
  });

  // Subscriber Growth (Last 7 Days)
  const oneWeekAgo = dayjs().subtract(7, 'day').toDate();
  const subCountLastWeek = await prisma.subscriber.count({
    where: {
      status: 'ACTIVE',
      createdAt: { lt: oneWeekAgo }
    }
  });

  // Avoid division by zero
  let growthPercent = 0;
  if (subCountLastWeek > 0) {
    growthPercent = ((subscriberCount - subCountLastWeek) / subCountLastWeek) * 100;
  } else if (subscriberCount > 0) {
    growthPercent = 100; // 100% growth if started from 0
  }

  // Configuration
  const config = await prisma.appConfig.findFirst();

  // Recent Activity
  const recentLogs = await prisma.sentLog.findMany({
    take: 5,
    orderBy: { sentAt: 'desc' },
    include: {
      subscriber: true,
      message: true
    }
  });

  // Business KPIs
  const revenueAgg = await prisma.trackingEvent.aggregate({
    _sum: { revenue: true }
  });
  const totalRevenue = revenueAgg._sum.revenue || 0;

  const totalClicks = await prisma.trackingEvent.count({
    where: { eventType: 'CLICK' }
  });

  return {
    subscriberCount,
    messageCount,
    sentToday,
    growthPercent: growthPercent.toFixed(1),
    dailyLimit: config?.dailyLimitPerUser || 2,
    recentLogs,
    totalRevenue,
    totalClicks
  };
}

export default async function Home() {
  const stats = await getStats().catch(e => {
    console.error("Dashboard Stats Error:", e);
    return {
      subscriberCount: 0,
      messageCount: 0,
      sentToday: 0,
      growthPercent: '0.0',
      dailyLimit: 2,
      recentLogs: [],
      totalRevenue: 0,
      totalClicks: 0
    };
  });

  const isGrowthPositive = Number(stats.growthPercent) >= 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">Overview of your SMS campaigns.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Stat Card 1: Subscribers */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Active Subscribers</p>
              <h3 className="text-2xl font-bold text-white mt-2">{stats.subscriberCount.toLocaleString()}</h3>
            </div>
            <div className="h-10 w-10 bg-lime-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-lime-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs">
            <span className={`${isGrowthPositive ? 'text-emerald-400' : 'text-red-400'} flex items-center`}>
              {isGrowthPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              {isGrowthPositive ? '+' : ''}{stats.growthPercent}%
            </span>
            <span className="text-slate-500 ml-2">vs last week</span>
          </div>
        </div>

        {/* Stat Card 2: Sent Today */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Messages Sent (Today)</p>
              <h3 className="text-2xl font-bold text-white mt-2">{stats.sentToday.toLocaleString()}</h3>
            </div>
            <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs">
            <span className="text-slate-500">Daily Limit: {stats.dailyLimit}</span>
          </div>
        </div>

        {/* Stat Card 3: Revenue */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Revenue</p>
              <h3 className="text-2xl font-bold text-white mt-2">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <span className="text-emerald-400 font-bold text-lg">$</span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs">
            <span className="text-slate-500">Lifetime verified revenue</span>
          </div>
        </div>

        {/* Stat Card 4: Clicks */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Clicks</p>
              <h3 className="text-2xl font-bold text-white mt-2">{stats.totalClicks.toLocaleString()}</h3>
            </div>
            <div className="h-10 w-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs">
            <span className="text-slate-500">Across all messages</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Send Activity</h2>

        {stats.recentLogs.length === 0 ? (
          <div className="text-slate-500 text-sm">
            No recent activity to display.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-slate-200 border-b border-slate-800">
                <tr>
                  <th className="pb-3 pl-2">Time</th>
                  <th className="pb-3">Subscriber</th>
                  <th className="pb-3">Message Brand</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pl-2 font-mono text-slate-500">
                      {dayjs(log.sentAt).format('MMM D, h:mm A')}
                    </td>
                    <td className="py-3 text-slate-300">
                      {log.subscriber.name || log.subscriber.phone} <span className="text-slate-600 text-xs">({log.subscriber.phone})</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${log.brand === 'WSWD' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {log.brand}
                      </span>
                    </td>
                    <td className="py-3 text-emerald-400">
                      Sent
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
