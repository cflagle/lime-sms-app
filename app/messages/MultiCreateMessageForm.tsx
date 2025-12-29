'use client';

import { useState, useEffect } from 'react';
import { Plus, Info, Repeat, Calendar } from 'lucide-react';
import { createMessage } from './actions';
import dayjs from 'dayjs';

export default function MultiCreateMessageForm() {
    // Shared State
    const [creativeId, setCreativeId] = useState('');
    const [urlToShorten, setUrlToShorten] = useState('');
    const [sharedContent, setSharedContent] = useState('');
    const [cooldown, setCooldown] = useState(14);
    const [includeStop, setIncludeStop] = useState(false);

    // Derived/Specific State
    const [wswdName, setWswdName] = useState('');
    const [taName, setTaName] = useState('');

    const [wswdContent, setWswdContent] = useState('');
    const [taContent, setTaContent] = useState('');

    const [shortening, setShortening] = useState(false);
    const [linksGenerated, setLinksGenerated] = useState(false);

    // Auto-Naming Effect
    useEffect(() => {
        const today = dayjs().format('YYYYMMDD');
        if (creativeId) {
            setWswdName(`${today}_W_${creativeId}`);
            setTaName(`${today}_T_${creativeId}`);
        } else {
            setWswdName('');
            setTaName('');
        }
    }, [creativeId]);

    // Auto-Content Effect (Syncs shared content + signatures)
    useEffect(() => {
        if (linksGenerated) return; // Don't overwrite if links injected manually (though this is simplistic)

        const stopText = includeStop ? '\n\nText STOP 2 End.' : '';
        const wswdSig = '\n\nWall St Watchdogs';
        const taSig = '\n\nTrader\'s Alley';

        setWswdContent(sharedContent + stopText + wswdSig);
        setTaContent(sharedContent + stopText + taSig);
    }, [sharedContent, includeStop, linksGenerated]);


    const handleGenerateLinks = async () => {
        if (!urlToShorten || !wswdName || !taName) return;
        setShortening(true);

        try {
            // 1. WSWD Link
            const processedUrlW = urlToShorten.replace(/{B}/g, 'W');
            const wswdUrl = `${processedUrlW}${processedUrlW.includes('?') ? '&' : '?'}t202kw=${encodeURIComponent(wswdName)}`;
            const resW = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: wswdUrl, name: wswdName })
            });
            const dataW = await resW.json();

            // 2. TA Link
            const processedUrlT = urlToShorten.replace(/{B}/g, 'T');
            const taUrl = `${processedUrlT}${processedUrlT.includes('?') ? '&' : '?'}t202kw=${encodeURIComponent(taName)}`;
            const resT = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: taUrl, name: taName })
            });
            const dataT = await resT.json();

            if (dataW.success && dataT.success) {
                // Insert links
                // We append to the SHARED body part, effectively determining insertion point for both?
                // Or just append to existing specific content?
                // Let's just append appropriately to the specific bodies before the signatures.

                // Helper to insert link before signature
                const insertLink = (content: string, link: string) => {
                    // Primitive splice: find signature start or just append
                    // If we used the effect, content is (Shared + Stop + Sig).
                    // We want (Shared + Link + Stop + Sig).
                    // This is tricky if user edited manually. 
                    // Let's just APPEND to end (before signature if possible) or just Append.
                    return content + ` ${link}`;
                };

                // Better: Just update the SHARED content state with the link placeholder? No, links are different.
                // We must update specific states.

                setWswdContent(prev => prev + ` ${dataW.shortLink}`);
                setTaContent(prev => prev + ` ${dataT.shortLink}`);

                setLinksGenerated(true);
            } else {
                alert('Error generating links');
            }

        } catch (e) {
            console.error(e);
            alert('Error generating links');
        } finally {
            setShortening(false);
        }
    };

    const handleDualSubmit = async () => {
        try {
            const fdW = new FormData();
            fdW.append('name', wswdName);
            fdW.append('content', wswdContent);
            fdW.append('brand', 'WSWD');
            fdW.append('cooldown', cooldown.toString());

            const fdT = new FormData();
            fdT.append('name', taName);
            fdT.append('content', taContent);
            fdT.append('brand', 'TA');
            fdT.append('cooldown', cooldown.toString());

            // Parallel submit
            await Promise.all([
                createMessage(fdW),
                createMessage(fdT)
            ]);

            alert('Both messages created successfully!');
            // Reset
            setCreativeId('');
            setSharedContent('');
            setUrlToShorten('');
            setLinksGenerated(false);
            // Default cooldown remains

        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-white font-medium text-lg flex items-center gap-2">
                        <Repeat className="w-5 h-5 text-lime-400" />
                        Brand Agnostic Creator
                    </h3>
                    <p className="text-slate-400 text-sm">Auto-generate paired messages for WSWD and TA.</p>
                </div>
                <div className="bg-lime-500/10 text-lime-400 px-3 py-1 rounded-full text-xs font-bold border border-lime-500/20">
                    Dual Mode Active
                </div>
            </div>

            {/* Step 1: Shared Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-slate-800 pb-8">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Creative Identifier</label>
                        <div className="flex items-center gap-2">
                            <div className="bg-slate-800 text-slate-500 px-3 py-3 rounded-xl border border-slate-700 font-mono text-sm whitespace-nowrap">
                                {dayjs().format('YYYYMMDD')}_{'{B}'}_
                            </div>
                            <input
                                type="text"
                                placeholder="e.g. NextE_TickerSTP"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500 font-mono text-sm"
                                value={creativeId}
                                onChange={e => setCreativeId(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Generates unique tracking links for each brand and inserts them. Use <code>{'{B}'}</code> to insert "W" or "T" dynamically.</p>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Cooldown (Days)</label>
                        <input
                            type="number"
                            value={cooldown}
                            onChange={e => setCooldown(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500"
                        />
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Shared URL to Shorten</label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                placeholder="https://..."
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500"
                                value={urlToShorten}
                                onChange={e => setUrlToShorten(e.target.value)}
                            />
                            <button
                                onClick={handleGenerateLinks}
                                disabled={shortening || !creativeId || linksGenerated}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {shortening ? '...' : (linksGenerated ? 'Links Added' : 'Generate & Add')}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Shared Body Content</label>
                        <textarea
                            rows={3}
                            placeholder="Enter body text..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-lime-500"
                            value={sharedContent}
                            onChange={e => setSharedContent(e.target.value)}
                        />
                        <div className="flex items-center mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded bg-slate-800 border-slate-700 text-lime-500 focus:ring-lime-500"
                                    checked={includeStop}
                                    onChange={e => setIncludeStop(e.target.checked)}
                                />
                                <span className="text-xs text-slate-400">Include "Text STOP 2 End"</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 2: Specific Editors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* WSWD Editor */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-blue-400 font-bold text-sm">Wall Street Watchdogs</span>
                        <span className="text-xs text-slate-500 font-mono text-right truncate ml-2" title={wswdName}>{wswdName}</span>
                    </div>
                    <textarea
                        rows={6}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 mb-2"
                        value={wswdContent}
                        onChange={e => setWswdContent(e.target.value)}
                    />
                    <div className="text-right text-xs text-slate-500">
                        {wswdContent.length} chars
                    </div>
                </div>

                {/* TA Editor */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-purple-400 font-bold text-sm">Trader's Alley</span>
                        <span className="text-xs text-slate-500 font-mono text-right truncate ml-2" title={taName}>{taName}</span>
                    </div>
                    <textarea
                        rows={6}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500 mb-2"
                        value={taContent}
                        onChange={e => setTaContent(e.target.value)}
                    />
                    <div className="text-right text-xs text-slate-500">
                        {taContent.length} chars
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleDualSubmit}
                    className="bg-lime-500 hover:bg-lime-400 text-black font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-lime-500/20 flex items-center"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Both Messages
                </button>
            </div>
        </div>
    );
}
