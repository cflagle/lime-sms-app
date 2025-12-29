'use client';

import { useState } from 'react';

type ReportRow = {
    id: number;
    name: string;
    brand: string;
    active: boolean;
    sent: number;
    clicks: number;
    purchases: number;
    revenue: number;
    ctr: number;
    rpm: number;
};

type SortField = 'sent' | 'clicks' | 'purchases' | 'revenue' | 'ctr' | 'rpm';

export default function ReportingTable({ data }: { data: ReportRow[] }) {
    const [sortField, setSortField] = useState<SortField>('sent');
    const [sortDesc, setSortDesc] = useState(true);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortField(field);
            setSortDesc(true);
        }
    };

    const sortedData = [...data].sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        return sortDesc ? valB - valA : valA - valB;
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const formatPercent = (val: number) => val.toFixed(2) + '%';
    const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

    const Th = ({ field, label, right = false }: { field?: SortField, label: string, right?: boolean }) => (
        <th
            className={`px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${right ? 'text-right' : 'text-left'}`}
            onClick={() => field && handleSort(field)}
        >
            <div className={`flex items-center gap-1 ${right ? 'justify-end' : ''}`}>
                {label}
                {field && sortField === field && (
                    <span className="text-lime-500">{sortDesc ? '↓' : '↑'}</span>
                )}
            </div>
        </th>
    );

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-950">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Message Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Brand</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                            <Th field="sent" label="Sent" right />
                            <Th field="clicks" label="Clicks" right />
                            <Th field="ctr" label="CTR" right />
                            <Th field="purchases" label="Sales" right />
                            <Th field="revenue" label="Revenue" right />
                            <Th field="rpm" label="RPM" right />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                        {sortedData.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{row.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.brand === 'WSWD' ? 'bg-lime-900 text-lime-400' : 'bg-blue-900 text-blue-400'}`}>
                                        {row.brand}
                                    </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.active ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                        {row.active ? 'Active' : 'Archived'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 text-right font-mono">{formatNumber(row.sent)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 text-right font-mono">{formatNumber(row.clicks)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-blue-400">{formatPercent(row.ctr)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 text-right font-mono">{formatNumber(row.purchases)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-green-400">{formatCurrency(row.revenue)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-purple-400">{formatCurrency(row.rpm)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {data.length === 0 && (
                <div className="p-8 text-center text-slate-500">No data available.</div>
            )}
        </div>
    );
}
