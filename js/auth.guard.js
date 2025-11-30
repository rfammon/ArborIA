// js/auth.guard.js
import { ApiService } from './supabase-client.js';

(async () => {
    try {
        const session = await ApiService.getSession();
        const isAuthenticated = session && session.user;
        const isGuest = sessionStorage.getItem('arboria_guest_mode') === 'true';
        const isAllowed = isAuthenticated || isGuest;

        const currentPath = window.location.pathname;
        const isLoginPage = currentPath.endsWith('login.html');

        // If not allowed and not on the login page, redirect to login.
        if (!isAllowed && !isLoginPage) {
            console.log('Auth Guard: User not allowed. Redirecting to login.');
            window.location.replace('login.html');
            return;
        }

        // If allowed and on the login page, redirect to the main app.
        if (isAllowed && isLoginPage) {
            console.log('Auth Guard: User already allowed. Redirecting to app.');
            window.location.replace('index.html');
            return;
        }
        
    } catch (error) {
        console.error('Auth Guard Error:', error);
        // Fallback: If Supabase is down or there's a network error,
        // we should probably prevent access. Redirect to login as a safe default.
        const isLoginPage = window.location.pathname.endsWith('login.html');
        if (!isLoginPage) {
            window.location.replace('login.html');
        }
    }
})();
