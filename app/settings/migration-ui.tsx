'use client';

import { useState } from 'react';
import { Download, Upload, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { importMessages } from './actions';

export function MigrationUI() {
    const [isImporting, setIsImporting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleExport = () => {
        // Trigger download via API
        window.location.href = '/api/migration/messages/export';
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setStatus(null);

        try {
            const text = await file.text();
            // Call server action
            const result = await importMessages(text);

            if (result.success) {
                setStatus({
                    type: 'success',
                    message: `Successfully imported ${result.count} messages!`
                });
            } else {
                setStatus({
                    type: 'error',
                    message: result.error || 'Import failed'
                });
            }
        } catch (err) {
            setStatus({
                type: 'error',
                message: 'Failed to read file'
            });
        } finally {
            setIsImporting(false);
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Export Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <h4 className="font-medium text-white mb-2">Export Messages</h4>
                    <p className="text-sm text-slate-400 mb-4">
                        Download all current messages as a JSON file. Use this to transfer data from Local to Production.
                    </p>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700 font-medium text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Download JSON
                    </button>
                </div>

                {/* Import Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <h4 className="font-medium text-white mb-2">Import Messages</h4>
                    <p className="text-sm text-slate-400 mb-4">
                        Upload a JSON file to add or update messages. Existing messages with the same name will be updated.
                    </p>

                    <div className="flex items-center gap-4">
                        <label className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border font-medium text-sm cursor-pointer
                            ${isImporting
                                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-lime-600 hover:bg-lime-500 border-transparent text-white'}
                        `}>
                            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isImporting ? 'Importing...' : 'Select File'}
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                disabled={isImporting}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {status && (
                        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                            {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {status.message}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
