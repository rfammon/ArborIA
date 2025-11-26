/**
 * ARBORIA 2.0 - UI CONTROLLER
 * Gerencia a navegação, responsividade e feedback visual.
 * Correção: Adicionado fallback para abrir 'manual-view' quando o ID específico não existe.
 */

import * as State from './state.js';

export const UI = {
    // Cache de Elementos do DOM para performance
    elements: {
        navPanel: null,
        backBtnContainer: null,
        backBtn: null,
        sections: null,
        navButtons: null,
        subTabButtons: null,
        mainContent: null,
        toast: null,
        actionModal: null
    },

    /**
     * Inicialização Principal
     */
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.bindSubTabs();
        
        // Ajuste inicial de layout
        this.handleResize();
    },

    /**
     * Armazena referências aos elementos HTML
     */
    cacheDOM() {
        this.elements.navPanel = document.getElementById('main-navigation');
        this.elements.backBtnContainer = document.getElementById('back-btn-container');
        this.elements.backBtn = document.getElementById('btn-back-dashboard');
        this.elements.headerMain = document.getElementById('page-top'); // Add header
        this.elements.appContent = document.getElementById('app-content'); // Add app-content

        // Seleciona todas as seções que funcionam como "páginas"
        this.elements.sections = document.querySelectorAll('.content-section');
        
        this.elements.navButtons = document.querySelectorAll('.topico-btn');
        this.elements.subTabButtons = document.querySelectorAll('.sub-nav-btn');
        
        this.elements.toast = document.getElementById('toast-notification');
        this.elements.actionModal = document.getElementById('action-modal');
    },

    /**
     * Vincula eventos de navegação principal
     */
    bindEvents() {
        // 1. Cliques no Menu Principal
        // A lógica de clique agora é gerenciada pelo handleMainNavigation no main.js
        // para permitir o gerenciamento do ciclo de vida dos componentes (câmera, etc).

        // 2. Botão Voltar (Apenas Mobile)
        if (this.elements.backBtn) {
            this.elements.backBtn.addEventListener('click', () => {
                this.returnToDashboard();
            });
        }

        // 3. Resize da Janela (Responsividade)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.handleResize(), 100);
        });
    },

    /**
     * Lógica de Navegação Central (SPA)
     * @param {string} targetId - ID da seção a ser exibida OU chave do conteúdo.
     */
    navigateTo(targetId) {
        // Tenta achar a seção pelo ID exato (ex: 'calculadora-view')
        let targetSection = document.getElementById(targetId);
        
        // [CORREÇÃO DE FALLBACK]
        // Se não existir uma seção com esse ID (ex: 'sobre-autor'), 
        // assume que é um conteúdo de texto e abre o container genérico '#manual-view'.
        if (!targetSection) {
            targetSection = document.getElementById('manual-view');
        }

        // Se mesmo assim não achar nada (nem o manual-view), erro.
        if (!targetSection) {
            console.warn(`⚠️ Seção nem fallback encontrados para: ${targetId}`);
            return;
        }

        // 1. Esconde todas as seções
        this.elements.sections.forEach(sec => {
            sec.style.display = 'none';
            sec.classList.remove('active');
        });

        // 2. Comportamento Mobile vs Desktop
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Mobile: Menu some, Conteúdo aparece, Botão Voltar aparece
            if (this.elements.navPanel) this.elements.navPanel.style.display = 'none';
            if (this.elements.backBtnContainer) this.elements.backBtnContainer.style.display = 'flex';
            // Scroll suave para o topo
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Desktop: Menu continua visível (Sidebar)
            if (this.elements.navPanel) this.elements.navPanel.style.display = 'block';
            if (this.elements.backBtnContainer) this.elements.backBtnContainer.style.display = 'none';
        }

        // 3. Mostra a seção alvo
        // Se for App Fullscreen (Câmera), usa flexbox. Senão, block.
        if (targetSection.classList.contains('fullscreen-app')) {
            targetSection.style.display = 'flex';
        } else {
            targetSection.style.display = 'block';
        }
        
        // Pequeno delay para permitir animação CSS (slideUp)
        requestAnimationFrame(() => {
            targetSection.classList.add('active');
        });

        // 4. Se for Mapa, dispara resize para evitar área cinza
        if (targetId.includes('map') || targetId === 'calculadora-view') {
            this.triggerMapResize();
        }
    },

    /**
     * Retorna ao Menu Principal (Grid) - Mobile Only
     */
    returnToDashboard() {
        // Esconde seções
        this.elements.sections.forEach(sec => {
            sec.style.display = 'none';
            sec.classList.remove('active');
        });

        // Restaura Menu
        if (this.elements.navPanel) {
            // Garante visibilidade do container pai
            this.elements.navPanel.style.display = 'block'; 
            // No CSS, .topicos-container cuidará do display grid/flex
        }

        // Esconde botão voltar
        if (this.elements.backBtnContainer) {
            this.elements.backBtnContainer.style.display = 'none';
        }

        // Limpa seleção ativa visual
        this.elements.navButtons.forEach(b => b.classList.remove('active'));
    },

    /**
     * Gerencia Sub-Abas (ex: Calculadora > Registrar | Mapa)
     */
    bindSubTabs() {
        if (!this.elements.subTabButtons) return;

        this.elements.subTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTabId = btn.getAttribute('data-target');
                const parentSection = btn.closest('.content-section');

                if (!parentSection) return;

                // 1. Atualiza botões (Pílulas)
                const siblings = parentSection.querySelectorAll('.sub-nav-btn');
                siblings.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 2. Atualiza Conteúdo
                const tabContents = parentSection.querySelectorAll('.sub-tab-content');
                tabContents.forEach(content => content.style.display = 'none');

                const targetContent = document.getElementById(targetTabId);
                if (targetContent) {
                    targetContent.style.display = 'block';
                }

                // 3. Fix Específico para Mapa (Leaflet)
                if (targetTabId && targetTabId.includes('mapa')) {
                   this.triggerMapResize();
                }
            });
        });
    },

    /**
     * Corrige layout ao redimensionar a janela
     */
    handleResize() {
        const isMobile = window.innerWidth <= 768;
        const hasActiveSection = document.querySelector('.content-section.active');

        if (!isMobile) {
            // Desktop: Menu sempre visível
            if (this.elements.navPanel) this.elements.navPanel.style.display = 'block';
            if (this.elements.backBtnContainer) this.elements.backBtnContainer.style.display = 'none';
        } else {
            // Mobile
            if (hasActiveSection) {
                // Se tem seção aberta, esconde menu
                if (this.elements.navPanel) this.elements.navPanel.style.display = 'none';
                if (this.elements.backBtnContainer) this.elements.backBtnContainer.style.display = 'flex';
            } else {
                // Se estamos na home, mostra menu
                if (this.elements.navPanel) this.elements.navPanel.style.display = 'block';
                if (this.elements.backBtnContainer) this.elements.backBtnContainer.style.display = 'none';
            }
        }
    },

    /**
     * Helper: Dispara evento de resize para corrigir mapas Leaflet
     */
    triggerMapResize() {
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 200);
    },

    /**
     * Exibe Toast de Feedback
     * @param {string} message - Texto
     * @param {string} type - 'success', 'error', 'info'
     */
    showToast(message, type = 'info') {
        if (!this.elements.toast) return;

        this.elements.toast.textContent = message;
        // Remove classes antigas antes de adicionar novas
        this.elements.toast.className = 'toast'; 
        // Força reflow para reiniciar animação se necessário
        void this.elements.toast.offsetWidth;
        
        this.elements.toast.classList.add(`toast-${type}`, 'show');

        // Auto-hide
        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3500);
    },

    /**
     * Atualiza Badge de contagem na interface
     */
    updateSummaryBadge(count) {
        const badge = document.getElementById('summary-badge');
        if (badge) {
            badge.textContent = count;
            // Adiciona cor se tiver itens
            if (count > 0) badge.classList.add('badge-medium');
            else badge.classList.remove('badge-medium');
        }
    }
};
