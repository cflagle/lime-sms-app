import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const ANALYTICS_LOG = path.join(LOG_DIR, 'analytics.log');

// Ensure logs directory exists
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

export function logAnalytics(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: object) {
    ensureLogDir();

    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data })
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Append to log file
    fs.appendFileSync(ANALYTICS_LOG, logLine);

    // Also log to console
    const consoleMsg = `[Analytics] ${timestamp} [${level}] ${message}`;
    if (level === 'ERROR') {
        console.error(consoleMsg, data || '');
    } else if (level === 'WARN') {
        console.warn(consoleMsg, data || '');
    } else {
        console.log(consoleMsg, data ? JSON.stringify(data) : '');
    }
}

export function getAnalyticsLogPath() {
    return ANALYTICS_LOG;
}
