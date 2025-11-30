// js/login.js
import { ApiService } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('form');
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const errorMsgElement = document.getElementById('login-error-msg');
    const submitBtn = document.querySelector('.login-btn');
    const guestBtn = document.getElementById('guest-login-btn');

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            sessionStorage.setItem('arboria_guest_mode', 'true');
            window.location.replace('index.html?guest=true');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!emailInput || !passwordInput || !submitBtn) return;

            const email = emailInput.value;
            const password = passwordInput.value;
            const originalBtnText = submitBtn.innerHTML;

            // Clear previous errors
            if (errorMsgElement) errorMsgElement.textContent = '';
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Processando...';

            try {
                const { data, error } = await ApiService.login(email, password);

                if (error) {
                    throw new Error(error.message || 'Falha no login. Verifique suas credenciais.');
                }

                if (data.user) {
                    // Redirect to the main application on successful login
                    window.location.replace('index.html');
                } else {
                    throw new Error('Usuário não encontrado após o login.');
                }

            } catch (error) {
                console.error('Login failed:', error);
                if (errorMsgElement) {
                    errorMsgElement.textContent = `Erro: ${error.message}`;
                    errorMsgElement.style.display = 'block';
                }
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

    // Password visibility toggle
    const togglePassword = document.querySelector('#togglePassword');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Toggle the eye icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
});
