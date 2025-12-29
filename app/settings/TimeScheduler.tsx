'use client';

import { useState } from 'react';

export function TimeScheduler({ dailyLimit, initialTimes, prefix }: { dailyLimit: number, initialTimes?: string, prefix: string }) {
    const times = (initialTimes || '').split(',').map(t => t.trim());

    const inputs = [];
    for (let i = 0; i < dailyLimit; i++) {
        inputs.push(
            <div key={i}>
                <label className="block text-xs text-slate-500 mb-1">Time Slot {i + 1}</label>
                <input
                    type="time"
                    name={`${prefix}-time-${i}`}
                    defaultValue={times[i] || ''}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-lime-500 outline-none"
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {inputs}
        </div>
    );
}
