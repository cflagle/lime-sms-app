export const dynamic = 'force-dynamic';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Settings</h1>
                <p className="text-slate-400">System configuration and health.</p>
            </div>

            {/* Safety Controls */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-medium text-white mb-4">Safety & Controls</h3>
                <ConfigForm />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-medium text-white mb-4">API Configuration</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-500 uppercase mb-1">Lime Username</label>
                            <div className="bg-slate-950 p-2 rounded text-slate-300 font-mono">
                                {process.env.LIME_USER || 'Not Set'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 uppercase mb-1">Lime API ID</label>
                            <div className="bg-slate-950 p-2 rounded text-slate-300 font-mono">
                                {process.env.LIME_API_ID ? '••••••••' + process.env.LIME_API_ID.slice(-4) : 'Not Set'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-medium text-white mb-4">Sync Status</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        To force a synchronization with Lime Cellular, you can trigger the cron endpoint manually.
                    </p>
                    <a
                        href="/api/cron"
                        target="_blank"
                        className="inline-block bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700"
                    >
                        Trigger Sync Now
                    </a>
                </div>
            </div>
        </div>
    );
}

import { getAppConfig } from '@/lib/config-service';
import { saveSettings } from './actions';
import { TimeScheduler } from './TimeScheduler';

async function ConfigForm() {
    const config = await getAppConfig();

    return (
        <form action={saveSettings} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                    <h4 className="font-medium text-white">Master Sending Switch</h4>
                    <p className="text-sm text-slate-400">If disabled, the worker will NOT send any messages, even in test mode.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="sendingEnabled" defaultChecked={config.sendingEnabled} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-lime-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500"></div>
                </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                    <h4 className="font-medium text-white">Test Mode</h4>
                    <p className="text-sm text-slate-400">If enabled, messages are ONLY sent to numbers in the whitelist below.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="testMode" defaultChecked={config.testMode} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Test Numbers (Whitelist)</label>
                <textarea
                    name="testNumbers"
                    defaultValue={config.testNumbers}
                    placeholder="1234567890&#10;0987654321&#10;(One per line or comma separated)"
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-lime-500 outline-none font-mono text-sm"
                />
            </div>

            {/* WSWD Settings */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-6">
                <div>
                    <h4 className="font-medium text-white mb-4 text-lime-400">WSWD Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Daily Message Limit</label>
                            <input
                                type="number"
                                name="dailyLimitWSWD"
                                defaultValue={config.dailyLimitWSWD || 2}
                                min="1"
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-lime-500 outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">Max messages per day for WSWD.</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-medium text-white mb-4">Scheduled Times (WSWD)</h4>
                    <TimeScheduler
                        dailyLimit={config.dailyLimitWSWD || 2}
                        initialTimes={config.sendTimesWSWD}
                        prefix="wswd"
                    />
                    <p className="text-xs text-slate-500 mt-2">Time slots are approximate.</p>
                </div>
            </div>

            {/* TA Settings */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-6">
                <div>
                    <h4 className="font-medium text-white mb-4 text-blue-400">TA Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Daily Message Limit</label>
                            <input
                                type="number"
                                name="dailyLimitTA"
                                defaultValue={config.dailyLimitTA || 2}
                                min="1"
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">Max messages per day for TA.</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-medium text-white mb-4">Scheduled Times (TA)</h4>
                    <TimeScheduler
                        dailyLimit={config.dailyLimitTA || 2}
                        initialTimes={config.sendTimesTA}
                        prefix="ta"
                    />
                </div>
            </div>

            {/* General Compliance */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-6">
                <h4 className="font-medium text-white mb-4">General Compliance</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Interval (Minutes)</label>
                        <input
                            type="number"
                            name="minIntervalMinutes"
                            defaultValue={config.minIntervalMinutes || 0}
                            min="0"
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-lime-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">Global minimum gap between any messages.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div>
                        <h4 className="font-medium text-white">Enforce Engagement Window</h4>
                        <p className="text-sm text-slate-400">If enabled, requires recent engagement to send.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="engagementWindowEnabled" defaultChecked={config.engagementWindowEnabled} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button type="submit" className="bg-lime-500 hover:bg-lime-600 text-black font-semibold px-6 py-2 rounded-lg transition-colors">
                    Save Settings
                </button>
            </div>
        </form>
    );
}
