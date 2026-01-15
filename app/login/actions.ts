'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_DURATION } from '@/lib/auth-constants';

export async function login(prevState: any, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    // Debug logging (TEMPORARY - remove after debugging)
    console.log('[Login Debug] Attempting login for:', username);
    console.log('[Login Debug] APP_USERNAME configured:', !!process.env.APP_USERNAME);
    console.log('[Login Debug] APP_PASSWORD configured:', !!process.env.APP_PASSWORD);
    if (process.env.APP_USERNAME) {
        console.log('[Login Debug] Expected username:', process.env.APP_USERNAME);
        console.log('[Login Debug] Username match:', process.env.APP_USERNAME === username);
    }

    // Define allowed users from environment variables
    // Users are defined as: APP_USER_1=username:password, APP_USER_2=username:password, etc.
    const validUsers: { username: string; password: string }[] = [];

    // Primary user from APP_USERNAME/APP_PASSWORD
    if (process.env.APP_USERNAME && process.env.APP_PASSWORD) {
        validUsers.push({
            username: process.env.APP_USERNAME,
            password: process.env.APP_PASSWORD
        });
    }

    // Secondary user from APP_USERNAME_2/APP_PASSWORD_2
    if (process.env.APP_USERNAME_2 && process.env.APP_PASSWORD_2) {
        validUsers.push({
            username: process.env.APP_USERNAME_2,
            password: process.env.APP_PASSWORD_2
        });
    }

    console.log('[Login Debug] Number of valid users:', validUsers.length);

    const isValid = validUsers.length > 0 && validUsers.some(user => user.username === username && user.password === password);

    console.log('[Login Debug] Authentication result:', isValid);

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
