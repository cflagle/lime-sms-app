'use client';

import { useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { createMessage } from './actions';

export default function CreateMessageForm() {
    const [urlToShorten, setUrlToShorten] = useState('');
    const [messageName, setMessageName] = useState('');
    const [nameLocked, setNameLocked] = useState(false);
    const [shortening, setShortening] = useState(false);
    const [content, setContent] = useState('');

    const handleShorten = async () => {
        if (!urlToShorten) return;

        if (!messageName || !messageName.trim()) {
            // Should be handled by UI state (button disabled), but safety check
            alert('Please enter a message name first.');
            return;
        }

        setShortening(true);
        try {
            // Append tracking parameter
            let finalUrl = urlToShorten;
            if (messageName.trim()) {
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl = `${finalUrl}${separator}t202kw=${encodeURIComponent(messageName.trim())}`;
            }

            const res = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: finalUrl, name: messageName })
            });
            const data = await res.json();

            if (data.success && data.shortLink) {
                // Append properly
                setContent(prev => prev + (prev ? ' ' : '') + data.shortLink);
                setUrlToShorten('');
                // Lock the name
                setNameLocked(true);
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Error creating link');
        } finally {
            setShortening(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-white font-medium mb-4">Add New Message</h3>

            <form action={async (formData) => {
                try {
                    await createMessage(formData);
                    // Reset form
                    setContent('');
                    setMessageName('');
                    setNameLocked(false);
                    // Reset other fields if they were controlled? They are native inputs mostly.
                } catch (e: any) {
                    alert(e.message);
                }
            }} className="space-y-4">

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Message Name (Internal & Tracking)</label>
                    <div className="relative">
                        <input
                            type="text"
                            name="name"
                            placeholder="e.g. Promo 123"
                            className={`w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none transition-colors mb-4 ${nameLocked ? 'opacity-50 cursor-not-allowed text-slate-400' : 'focus:border-lime-500'}`}
                            value={messageName}
                            onChange={(e) => setMessageName(e.target.value)}
                            readOnly={nameLocked}
                            required
                        />
                        {nameLocked && (
                            <div className="absolute right-3 top-3 text-xs text-slate-500 flex items-center">
                                <Info className="w-3 h-3 mr-1" />
                                Locked (Used in Link)
                            </div>
                        )}
                    </div>
                </div>

                {/* URL Shortener UI */}
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 mb-4">
                    <label className="block text-xs font-semibold text-lime-400 uppercase tracking-wider mb-2">
                        Insert Tracking Link helper
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            placeholder="Paste your long URL here..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-lime-500"
                            value={urlToShorten}
                            onChange={(e) => setUrlToShorten(e.target.value)}
                        />

                        {/* Tooltip Wrapper for disabled state */}
                        <div className="relative group">
                            <button
                                type="button"
                                onClick={handleShorten}
                                disabled={shortening || !urlToShorten || !messageName.trim()}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm transition-colors border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {shortening ? '...' : 'Insert'}
                            </button>
                            {(!messageName.trim() && urlToShorten) && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center border border-slate-700">
                                    Please enter a message name to generate links.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Message Content</label>
                    <textarea
                        name="content"
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500 transition-colors"
                        placeholder="Enter your ad copy here..."
                        required
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Brand</label>
                        <select name="brand" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500">
                            <option value="WSWD">Wall Street Watchdogs</option>
                            <option value="TA">Trader's Alley</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Cooldown (Days)</label>
                        <input
                            type="number"
                            name="cooldown"
                            defaultValue={14}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500"
                        />
                    </div>
                </div>
                <button type="submit" className="bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-3 px-6 rounded-xl transition-colors flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Message
                </button>
            </form>
        </div>
    );
}
