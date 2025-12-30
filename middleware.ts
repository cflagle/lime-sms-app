import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from './lib/auth-constants';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Define exemptions (Routes that don't need auth)
    // - /login (obvious)
    // - /api/cron (so Cloud Scheduler can hit it)
    // - /_next (static assets)
    // - /favicon.ico, etc.
    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/cron') ||
        pathname.startsWith('/api/webhooks') ||
        pathname.startsWith('/api/shorten') ||
        pathname.startsWith('/api/send-direct') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.') // file extension
    ) {
        return NextResponse.next();
    }

    // 2. Check for auth cookie
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

    if (!authCookie) {
        // Redirect to login
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes) -> wait, we WANT to protect API routes except cron
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
