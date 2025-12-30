'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_DURATION } from '@/lib/auth-constants';

export async function login(prevState: any, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const APP_USERNAME = process.env.APP_USERNAME || 'cflagle';
    const APP_PASSWORD = process.env.APP_PASSWORD || 'SpaceCamo123$';

    if (username === APP_USERNAME && password === APP_PASSWORD) {
        (await cookies()).set(AUTH_COOKIE_NAME, 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: AUTH_COOKIE_DURATION,
            path: '/',
        });
        redirect('/');
    }

    return { error: 'Invalid username or password' };
}

export async function logout() {
    (await cookies()).delete(AUTH_COOKIE_NAME);
    redirect('/login');
}
