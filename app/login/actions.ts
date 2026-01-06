'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_DURATION } from '@/lib/auth-constants';

export async function login(prevState: any, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    // Define allowed users
    const validUsers = [
        // Default/Env user
        {
            username: process.env.APP_USERNAME || 'cflagle',
            password: process.env.APP_PASSWORD || 'SpaceCamo123$'
        },
        // Fallback/Explicit original user (in case env vars are different)
        {
            username: 'cflagle',
            password: 'SpaceCamo123$'
        },
        // New user
        {
            username: 'cflagle1',
            password: 'Saratov13$13_'
        }
    ];

    const isValid = validUsers.some(user => user.username === username && user.password === password);

    if (isValid) {
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
