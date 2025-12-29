'use client';

import { useState } from 'react';
import CreateMessageForm from './CreateMessageForm';
import MultiCreateMessageForm from './MultiCreateMessageForm';

export default function MessageCreatorWrapper() {
    const [mode, setMode] = useState<'single' | 'dual'>('dual');

    return (
        <div className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex justify-end">
                <div className="bg-slate-900 border border-slate-800 p-1 rounded-lg flex space-x-1">
                    <button
                        onClick={() => setMode('single')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'single'
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                            }`}
                    >
                        Single Message
                    </button>
                    <button
                        onClick={() => setMode('dual')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'dual'
                                ? 'bg-lime-500/10 text-lime-400 border border-lime-500/20 shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                            }`}
                    >
                        Brand Agnostic
                    </button>
                </div>
            </div>

            {/* Creator Components */}
            {mode === 'single' ? (
                <CreateMessageForm />
            ) : (
                <MultiCreateMessageForm />
            )}
        </div>
    );
}
