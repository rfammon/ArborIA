// js/login.js
import { ApiService } from './supabase-client.js';
import { clearImageDB } from './database.js';

document.addEventListener('DOMContentLoaded', () => {

    // Utility function for throttling
    const throttle = (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // Login Elements
    const loginForm = document.querySelector('.login-form-container form');
    const loginEmailInput = document.querySelector('input[type="email"]');
    const loginPasswordInput = document.querySelector('input[type="password"]');
    const loginErrorMsgElement = document.getElementById('login-error-msg');
    const loginSubmitBtn = document.querySelector('.login-form-container .login-btn');
    const guestBtn = document.getElementById('guest-login-btn');
    const toggleLoginPassword = document.getElementById('togglePassword'); // For login password

    // Register Elements
    const registerFormContainer = document.querySelector('.register-form-container');
    const loginFormContainer = document.querySelector('.login-form-container');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const registerForm = document.getElementById('register-form');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
    const registerErrorMsgElement = document.getElementById('register-error-msg');
    const registerSubmitBtn = document.getElementById('register-btn');
    const toggleRegisterPassword = document.getElementById('toggleRegisterPassword'); // For register password
    const toggleRegisterConfirmPassword = document.getElementById('toggleRegisterConfirmPassword'); // For register confirm password

    // --- Form Toggling Logic ---
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', () => {
            loginFormContainer.style.display = 'none';
            registerFormContainer.style.display = 'block';
            if (registerErrorMsgElement) registerErrorMsgElement.style.display = 'none';
            if (loginErrorMsgElement) loginErrorMsgElement.style.display = 'none';
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            registerFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            if (registerErrorMsgElement) registerErrorMsgElement.style.display = 'none';
            if (loginErrorMsgElement) loginErrorMsgElement.style.display = 'none';
        });
    }

    // --- Guest Login ---
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            sessionStorage.setItem('arboria_guest_mode', 'true');
            window.location.replace('index.html?guest=true');
        });
    }

    // --- Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!loginEmailInput || !loginPasswordInput || !loginSubmitBtn) return;

            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            const originalBtnText = loginSubmitBtn.innerHTML;

            if (loginErrorMsgElement) loginErrorMsgElement.textContent = '';
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.innerHTML = 'Processando...';
            if (loginErrorMsgElement) loginErrorMsgElement.style.display = 'none'; // Hide error on new attempt

            try {
                const { data, error } = await ApiService.login(email, password);

                if (error) {
                    throw new Error(error.message || 'Falha no login. Verifique suas credenciais.');
                }

                if (data.user) {
                    await clearImageDB(); // Clear IndexedDB before redirect
                    window.location.replace('index.html');
                } else {
                    throw new Error('Usuário não encontrado após o login.');
                }

            } catch (error) {
                console.error('Login ou processo de limpeza falhou:', error);
                if (loginErrorMsgElement) {
                    loginErrorMsgElement.textContent = `Erro: ${error.message}`;
                    loginErrorMsgElement.style.display = 'block';
                }
            } finally {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.innerHTML = originalBtnText;
            }
        });
    }

    // --- Register Form Submission ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!registerEmailInput || !registerPasswordInput || !registerConfirmPasswordInput || !registerSubmitBtn) return;

            const email = registerEmailInput.value;
            const password = registerPasswordInput.value;
            const confirmPassword = registerConfirmPasswordInput.value;
            const originalBtnText = registerSubmitBtn.innerHTML;

            if (registerErrorMsgElement) registerErrorMsgElement.textContent = '';
            if (registerErrorMsgElement) registerErrorMsgElement.style.display = 'none'; // Hide error on new attempt
            
            // Password Validation
            if (password !== confirmPassword) {
                if (registerErrorMsgElement) {
                    registerErrorMsgElement.textContent = 'As senhas não coincidem.';
                    registerErrorMsgElement.style.display = 'block';
                }
                return;
            }

            if (password.length < 6) { // Basic password length check
                if (registerErrorMsgElement) {
                    registerErrorMsgElement.textContent = 'A senha deve ter pelo menos 6 caracteres.';
                    registerErrorMsgElement.style.display = 'block';
                }
                return;
            }

            registerSubmitBtn.disabled = true;
            registerSubmitBtn.innerHTML = 'Registrando...';

            try {
                const { data, error } = await ApiService.register(email, password);

                if (error) {
                    throw new Error(error.message || 'Falha no registro. Tente novamente.');
                }

                if (data.user) {
                    alert('Conta criada com sucesso! Por favor, verifique seu e-mail para confirmar a conta.');
                    // Optionally, switch back to login form or redirect
                    registerFormContainer.style.display = 'none';
                    loginFormContainer.style.display = 'block';
                    loginEmailInput.value = email; // Pre-fill login email
                } else {
                    throw new Error('Erro desconhecido ao registrar usuário.');
                }

            } catch (error) {
                console.error('Registro falhou:', error);
                if (registerErrorMsgElement) {
                    registerErrorMsgElement.textContent = `Erro: ${error.message}`;
                    registerErrorMsgElement.style.display = 'block';
                }
            } finally {
                registerSubmitBtn.disabled = false;
                registerSubmitBtn.innerHTML = originalBtnText;
            }
        });
    }


    // --- Password visibility toggle for Login ---
    if (toggleLoginPassword && loginPasswordInput) {
        toggleLoginPassword.addEventListener('click', function () {
            const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPasswordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // --- Password visibility toggle for Register ---
    if (toggleRegisterPassword && registerPasswordInput) {
        toggleRegisterPassword.addEventListener('click', function () {
            const type = registerPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            registerPasswordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    if (toggleRegisterConfirmPassword && registerConfirmPasswordInput) {
        toggleRegisterConfirmPassword.addEventListener('click', function () {
            const type = registerConfirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            registerConfirmPasswordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // --- Mobile Scroll Animation (white panel over gradient) ---
    const isMobile = window.matchMedia('(max-width: 900px)');
    const loginPanelRight = document.querySelector('.login-panel-right');
    const loginPanelLeft = document.querySelector('.login-panel-left');
    const loginContainer = document.querySelector('.login-container');

    // Declare handleScroll and initialTranslateOffset in a scope accessible by both branches
    let initialTranslateOffset = 0; 
    let handleScroll = () => {}; // Default empty function
    let throttledHandleScroll; // Declare variable for the throttled function

    function applyMobileScrollAnimation() {
        if (isMobile.matches && loginPanelRight && loginPanelLeft && loginContainer) {
            // Calculate initialTranslateOffset only when mobile
            initialTranslateOffset = loginPanelRight.clientHeight * 0.20; 

            handleScroll = () => { // Assign the actual function when mobile
                const scrollY = window.scrollY;
                let newTranslateY = initialTranslateOffset - scrollY; 

                newTranslateY = Math.max(0, newTranslateY);
                newTranslateY = Math.min(initialTranslateOffset, newTranslateY);

                loginPanelRight.style.transform = `translateY(${newTranslateY}px)`;

                const parallaxY = scrollY * -0.3; 
                const clampedParallaxY = Math.max(-50, Math.min(0, parallaxY)); 
                loginPanelLeft.style.transform = `translateY(${clampedParallaxY}px)`;
            };

            // Assign the throttled version for the event listener
            throttledHandleScroll = throttle(handleScroll, 100); 
            window.addEventListener('scroll', throttledHandleScroll);
            handleScroll(); // Initial call to set position immediately

        } else {
            // Remove event listener if not mobile (ensuring throttledHandleScroll is defined)
            if (throttledHandleScroll) { // Only attempt to remove if it was added
                window.removeEventListener('scroll', throttledHandleScroll);
            }

            // Reset styles
            if (loginPanelRight) {
                loginPanelRight.style.transform = ''; // Reset transform
                loginPanelRight.style.position = ''; // Reset position
                loginPanelRight.style.bottom = '';
                loginPanelRight.style.left = '';
                loginPanelRight.style.right = '';
                loginPanelRight.style.width = '';
                loginPanelRight.style.minHeight = '';
                loginPanelRight.style.boxShadow = '';
                loginPanelRight.style.zIndex = '';
                loginPanelRight.style.padding = '';
                loginPanelRight.style.overflowY = '';
                loginPanelRight.style.maxHeight = '';
            }
            if (loginPanelLeft) {
                loginPanelLeft.style.position = ''; // Reset position
                loginPanelLeft.style.top = '';
                loginPanelLeft.style.zIndex = '';
                loginPanelLeft.style.height = ''; // Reset height
                loginPanelLeft.style.minHeight = ''; // Reset minHeight
                loginPanelLeft.style.transform = ''; // Reset parallax transform
            }
            if (loginContainer) {
                loginContainer.style.height = ''; // Reset height
                loginContainer.style.minHeight = ''; // Reset minHeight
                loginContainer.style.position = ''; // Reset position
            }
        }
    }

    // Run on load and whenever media query status changes
    isMobile.addEventListener('change', applyMobileScrollAnimation);
    applyMobileScrollAnimation(); // Initial call
});

