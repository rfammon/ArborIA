import { UI } from './ui.js';
import { ApiService } from './supabase-client.js';
import { resetApplicationState } from './state.js';
import { clearImageDB } from './database.js'; // Adicionar este import

export const AuthUI = {
    elements: {
        loginBtn: null,
        logoutBtn: null,
        userDisplay: null,
        emailSpan: null,
        modal: null,
        form: null,
        emailInput: null,
        passwordInput: null,
        submitBtn: null,
        errorMsg: null,
        toggleModeBtn: null,
        modalTitle: null
    },

    state: {
        isLoginMode: true,
        currentUser: null
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.checkInitialSession();
    },

    cacheDOM() {
        this.elements.userDisplay = document.getElementById('user-status-display');
        this.elements.modal = document.getElementById('auth-modal');
        this.elements.form = document.getElementById('auth-form');
        this.elements.emailInput = document.getElementById('auth-email');
        this.elements.passwordInput = document.getElementById('auth-password');
        this.elements.submitBtn = document.getElementById('auth-submit-btn');
        this.elements.errorMsg = document.getElementById('auth-error-msg');
        this.elements.toggleModeBtn = document.getElementById('auth-toggle-mode');
        this.elements.modalTitle = document.getElementById('auth-modal-title');
    },

    bindEvents() {
        // Alternar modo Login/Cadastro
        if (this.elements.toggleModeBtn) {
            this.elements.toggleModeBtn.addEventListener('click', () => this.toggleMode());
        }

        // Submissão do Formulário
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', (e) => this.handleAuthSubmit(e));
        }

        // Fechar Modal
        const closeBtn = this.elements.modal?.querySelector('.close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Fechar ao clicar fora
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.closeModal();
            }
        });
    },

    async checkInitialSession() {
        const urlParams = new URLSearchParams(window.location.search);
        const isGuestFromUrl = urlParams.get('guest') === 'true';

        if (isGuestFromUrl) {
            sessionStorage.setItem('arboria_guest_mode', 'true');
            // Limpa o parâmetro da URL para uma aparência mais limpa
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const isGuest = sessionStorage.getItem('arboria_guest_mode') === 'true';

        if (isGuest) {
            this.handleLoginSuccess({ isGuest: true });
            return;
        }

        try {
            // Verifica sessão real
            const user = await ApiService.getUser();
            if (user) {
                this.handleLoginSuccess(user);
            } else {
                // Se não há usuário logado e não é visitante, forçar modo visitante
                this.handleLoginSuccess({ isGuest: true });
            }
        } catch (error) {
            console.warn("AuthUI: Falha ao verificar sessão inicial (Supabase pode estar offline).", error);
            // Em caso de erro, ainda garantir que ele caia no modo visitante
            this.handleLoginSuccess({ isGuest: true });
        }
    },

    renderUserControls(user) {
        if (!this.elements.userDisplay) return;

        if (user && !user.isGuest) {
            // Estado: LOGADO
            this.elements.userDisplay.innerHTML = `
                <div class="user-controls-group">
                    <button id="btn-sync-data" class="btn btn-primary btn-sm" title="Sincronizar Dados">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <span class="user-email-span"><i class="fas fa-user-circle"></i> ${user.email.split('@')[0]}</span>
                    <button id="btn-logout" class="btn-auth btn-sm" title="Sair">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;
            
            document.getElementById('btn-logout').addEventListener('click', () => this.handleLogout());
            document.dispatchEvent(new CustomEvent('auth-ui-updated', { detail: { user } }));

        } else { // Simplificado para cobrir tanto user.isGuest quanto null (nenhum usuário logado)
            // Estado: VISITANTE (ou nenhum usuário logado, que agora será tratado como visitante)
            this.elements.userDisplay.innerHTML = `
                <div class="user-controls-group">
                    <span class="user-email-span"><i class="fas fa-user-secret"></i> Modo Visitante</span>
                    <button id="btn-exit-guest" class="btn-auth btn-sm" title="Sair do Modo Visitante">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                </div>
            `;
            document.getElementById('btn-exit-guest').addEventListener('click', () => this.handleExitGuestMode());
            document.dispatchEvent(new CustomEvent('auth-ui-updated', { detail: { user: { isGuest: true } } }));
        }
    },

    openModal() {
        if (this.elements.modal) {
            this.elements.modal.classList.add('active');
            this.elements.modal.style.display = 'flex';
            this.resetForm();
            // Foca no email para usabilidade
            setTimeout(() => this.elements.emailInput.focus(), 100);
        }
    },

    closeModal() {
        if (this.elements.modal) {
            this.elements.modal.classList.remove('active');
            setTimeout(() => {
                this.elements.modal.style.display = 'none';
            }, 300);
        }
    },

    toggleMode() {
        this.state.isLoginMode = !this.state.isLoginMode;
        
        if (this.state.isLoginMode) {
            this.elements.modalTitle.textContent = "Acessar Conta";
            this.elements.submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
            this.elements.toggleModeBtn.textContent = "Não tem conta? Cadastre-se";
        } else {
            this.elements.modalTitle.textContent = "Criar Nova Conta";
            this.elements.submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Cadastrar';
            this.elements.toggleModeBtn.textContent = "Já tem conta? Faça Login";
        }
        this.elements.errorMsg.textContent = "";
    },

    async handleAuthSubmit(e) {
        e.preventDefault();
        const email = this.elements.emailInput.value;
        const password = this.elements.passwordInput.value;

        if (!email || !password) {
            this.elements.errorMsg.textContent = "Preencha todos os campos.";
            return;
        }

        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.textContent = "Processando...";

        try {
            let result;
            if (this.state.isLoginMode) {
                result = await ApiService.login(email, password);
            } else {
                result = await ApiService.register(email, password);
            }

            if (result.error) {
                throw new Error(result.error.message || "Erro na autenticação");
            }

            // Sucesso
            if (result.data.user) {
                const msg = this.state.isLoginMode ? "Login realizado!" : "Conta criada!";
                UI.showToast(msg, "success");
                
                this.handleLoginSuccess(result.data.user);
                this.closeModal();
            }

        } catch (error) {
            console.error(error);
            this.elements.errorMsg.textContent = "Erro: " + error.message;
        } finally {
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.innerHTML = this.state.isLoginMode ? '<i class="fas fa-sign-in-alt"></i> Entrar' : '<i class="fas fa-user-plus"></i> Cadastrar';
        }
    },

    handleLoginSuccess(user) {
        this.state.currentUser = user;
        this.renderUserControls(user);
    },

    async handleLogout() {
        sessionStorage.removeItem('arboria_guest_mode');

        // **NOVO**: Limpa o banco de dados local (IndexedDB de imagens)
        try {
            await clearImageDB();
            console.log("Banco de dados de imagens local limpo.");
        } catch (error) {
            console.error("Erro ao limpar o banco de dados de imagens local:", error);
        }

        // **NOVO**: Limpa dados salvos no LocalStorage
        localStorage.removeItem('manualPodaData'); // STORAGE_KEY do js/state.js
        localStorage.removeItem('manualPodaActiveTab'); // ACTIVE_TAB_KEY do js/state.js
        // Adicione outras chaves de localStorage se houver dados sensíveis do usuário aqui.

        await ApiService.logout();
        
        // Limpa o estado da aplicação em memória
        resetApplicationState();

        this.state.currentUser = null;
        this.renderUserControls(null);
        UI.showToast("Você saiu da conta.", "info");
        window.location.replace('login.html');
    },

    handleExitGuestMode() {
        sessionStorage.removeItem('arboria_guest_mode');
        
        // Limpa o estado da aplicação em memória
        resetApplicationState();

        this.state.currentUser = null;
        this.renderUserControls(null);
        UI.showToast("Você saiu do modo visitante.", "info");
        window.location.replace('login.html');
    },

    resetForm() {
        this.elements.form.reset();
        this.elements.errorMsg.textContent = "";
        this.state.isLoginMode = true;
        this.elements.modalTitle.textContent = "Acessar Conta";
        this.elements.submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        this.elements.toggleModeBtn.textContent = "Não tem conta? Cadastre-se";
    }
};