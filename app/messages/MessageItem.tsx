'use client';

import { useState } from 'react';
import { Trash2, Edit2, Save, Send, MousePointer, CreditCard, DollarSign } from 'lucide-react';
import { updateMessage, deleteMessage } from './actions';

interface MessageStats {
    sends: number;
    clicks: number;
    purchases: number;
    revenue: number;
}

export default function MessageItem({ msg, stats }: { msg: any; stats: MessageStats }) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State (name is NOT editable - immutable after creation)
    const [content, setContent] = useState(msg.content);
    const [brand, setBrand] = useState(msg.brand);
    const [cooldown, setCooldown] = useState(msg.cooldownDays);

    const handleSave = async () => {
        setLoading(true);
        const formData = new FormData();
        // name is intentionally NOT included - it's immutable
        formData.append('content', content);
        formData.append('brand', brand);
        formData.append('cooldown', cooldown.toString());

        try {
            await updateMessage(msg.id, formData);
            setIsEditing(false);
        } catch (e: any) {
            alert(e.message || 'Failed to save');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            await deleteMessage(msg.id);
        } catch (e) {
            alert('Failed to delete');
        }
    };

    if (isEditing) {
        return (
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Message Name (Immutable)</label>
                        <div className="w-full bg-slate-950/50 border border-slate-800 rounded p-2 text-sm text-slate-400">
                            {msg.name}
                        </div>
                    </div>
                    <div className="w-1/4">
                        <label className="block text-xs text-slate-500 mb-1">Brand</label>
                        <select
                            value={brand}
                            onChange={e => setBrand(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-lime-500 outline-none"
                        >
                            <option value="WSWD">Wall Street Watchdogs</option>
                            <option value="TA">Trader's Alley</option>
                        </select>
                    </div>
                    <div className="w-1/4">
                        <label className="block text-xs text-slate-500 mb-1">Cooldown (Days)</label>
                        <input
                            type="number"
                            value={cooldown}
                            onChange={e => setCooldown(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-lime-500 outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Content</label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:border-lime-500 outline-none"
                        rows={3}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1 text-slate-400 hover:text-white text-sm"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-lime-500 hover:bg-lime-400 text-slate-900 px-4 py-1 rounded text-sm font-bold flex items-center gap-2"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save</>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex justify-between items-start group hover:border-slate-700 transition-colors">
            <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                    <span className="text-slate-500 font-mono text-xs mr-2">#{msg.id}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${msg.brand === 'WSWD' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {msg.brand}
                    </span>
                    {msg.name && (
                        <span className="text-white font-medium text-sm border-l border-slate-700 pl-2 ml-1">{msg.name}</span>
                    )}
                    <span className="text-slate-500 text-xs ml-2">Cooldown: {msg.cooldownDays} days</span>
                </div>
                <p className="text-slate-300 text-sm whitespace-pre-wrap mb-3">{msg.content}</p>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-slate-400" title="Total Sends">
                        <Send className="w-3.5 h-3.5" />
                        <span className="font-medium">{stats.sends.toLocaleString()}</span>
                        <span className="text-slate-600">sends</span>
                    </div>
                    <div className="flex items-center gap-1 text-sky-400" title="Total Clicks">
                        <MousePointer className="w-3.5 h-3.5" />
                        <span className="font-medium">{stats.clicks.toLocaleString()}</span>
                        <span className="text-slate-600">clicks</span>
                        {stats.sends > 0 && (
                            <span className="text-slate-500">({((stats.clicks / stats.sends) * 100).toFixed(1)}%)</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400" title="Total Purchases">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span className="font-medium">{stats.purchases.toLocaleString()}</span>
                        <span className="text-slate-600">purchases</span>
                        {stats.clicks > 0 && (
                            <span className="text-slate-500">({((stats.purchases / stats.clicks) * 100).toFixed(1)}%)</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-lime-400" title="Total Revenue">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span className="font-medium">${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    title="Edit Message"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={handleDelete}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                    title="Delete Message"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
