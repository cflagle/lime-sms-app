'use client';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export function LogsExport({ logs }: { logs: any[] }) {

    const handleExport = () => {
        if (!logs || logs.length === 0) return;

        // CSV Header
        const headers = ['Time (EST)', 'To', 'Brand', 'Content'];

        // Map data
        const rows = logs.map(log => {
            // Format time to EST
            const time = dayjs(log.sentAt).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
            const to = log.subscriber?.phone || log.subscriberId;
            const brand = log.brand;
            // Escape quotes in content
            const content = `"${(log.message?.content || 'Deleted Message').replace(/"/g, '""')}"`;

            return [time, to, brand, content].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `delivery_logs_${dayjs().format('YYYY-MM-DD')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <button
            onClick={handleExport}
            className="bg-lime-600 hover:bg-lime-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
            Export to CSV
        </button>
    );
}
