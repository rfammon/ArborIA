/* js/tooltip.ui.js (vFinal)
   Gerenciador Híbrido: Hover (Desktop) / Click (Mobile)
*/

import { glossaryData } from './data-content.js';

const TooltipUI = {
    activeTooltip: null,
    backdrop: null,
    isMobile: false,
    hideTimeout: null, // Para evitar que o tooltip feche rápido demais no hover

    init() {
        // 1. Detecção de Mobile (Baseado em toque ou largura)
        this.isMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
        
        // Atualiza se a tela for redimensionada
        window.addEventListener('resize', () => {
            this.isMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
        });

        this.createTooltipElement();
        this.setupEventListeners();
    },

    createTooltipElement() {
        if (document.getElementById('arboria-tooltip')) return;

        // Estrutura do Card
        const tooltipDiv = document.createElement('div');
        tooltipDiv.className = 'tooltip-card';
        tooltipDiv.id = 'arboria-tooltip';
        tooltipDiv.innerHTML = `
            <div class="tooltip-header">
                <h4 class="tooltip-title">Definição</h4>
                <button class="tooltip-close" aria-label="Fechar">&times;</button>
            </div>
            <div class="tooltip-content" id="tooltip-body"></div>
            <div class="tooltip-arrow"></div>
        `;
        document.body.appendChild(tooltipDiv);
        this.activeTooltip = tooltipDiv;

        // Estrutura do Fundo Escuro (Mobile)
        const backdropDiv = document.createElement('div');
        backdropDiv.className = 'tooltip-backdrop';
        document.body.appendChild(backdropDiv);
        this.backdrop = backdropDiv;
    },

    setupEventListeners() {
        // Delegação de eventos no DOCUMENTO inteiro (para pegar elementos injetados via JS)
        
        // A) COMPORTAMENTO DE CLICK (Mobile e Desktop Click)
        document.addEventListener('click', (e) => {
            const termElement = e.target.closest('.glossary-term, [data-term-key]');
            
            // No mobile, o click é o gatilho principal
            if (this.isMobile && termElement) {
                e.preventDefault();
                e.stopPropagation();
                const termKey = termElement.getAttribute('data-term-key');
                this.show(termElement, termKey);
                return;
            }

            // Fechar ao clicar no X
            if (e.target.closest('.tooltip-close')) {
                e.preventDefault();
                this.hide();
                return;
            }

            // Fechar ao clicar fora (Mobile ou Desktop fixo)
            if (this.activeTooltip.classList.contains('active') && !e.target.closest('.tooltip-card')) {
                // Se foi um clique num termo (no desktop), não fecha, pois o hover cuida
                if (!termElement) {
                    this.hide();
                }
            }
        });

        // B) COMPORTAMENTO DE HOVER (Apenas Desktop)
        document.addEventListener('mouseover', (e) => {
            if (this.isMobile) return; // Ignora hover no celular

            const termElement = e.target.closest('.glossary-term, [data-term-key]');
            
            if (termElement) {
                // Limpa timer de esconder se o mouse voltou pro termo
                if (this.hideTimeout) clearTimeout(this.hideTimeout);
                
                const termKey = termElement.getAttribute('data-term-key');
                this.show(termElement, termKey);
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (this.isMobile) return;

            const termElement = e.target.closest('.glossary-term, [data-term-key]');
            if (termElement) {
                // Dá um pequeno delay antes de fechar para o mouse poder ir até o tooltip se necessário
                this.hideTimeout = setTimeout(() => {
                    // Verifica se o mouse não está EM CIMA do próprio tooltip
                    if (!this.activeTooltip.matches(':hover')) {
                        this.hide();
                    }
                }, 300); // 300ms de tolerância
            }
        });
        
        // Garante que o tooltip não feche se o mouse estiver sobre ELE (Desktop)
        if (this.activeTooltip) {
            this.activeTooltip.addEventListener('mouseleave', () => {
                if (!this.isMobile) this.hide();
            });
        }

        // Tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    },

    show(targetElement, termKey) {
        console.log('Tentando abrir tooltip:', termKey); // DEBUG
        
        if (!glossaryData) {
            console.error('ERRO FATAL: glossaryData não foi carregado!');
            return;
        }

        const body = this.activeTooltip.querySelector('#tooltip-body');
        const title = this.activeTooltip.querySelector('.tooltip-title');
        
        title.textContent = content.title || 'Definição';
        body.innerHTML = content.description;

        // requestAnimationFrame para evitar "layout thrashing"
        requestAnimationFrame(() => {
            this.activeTooltip.classList.add('active');
            if (this.isMobile) this.backdrop.classList.add('active');
            this.updatePosition(targetElement);
        });
    },

    hide() {
        if (this.activeTooltip) {
            this.activeTooltip.classList.remove('active');
            if (this.backdrop) this.backdrop.classList.remove('active');
        }
    },

    updatePosition(targetElement) {
        if (this.isMobile) {
            // Mobile: Centralizado via CSS (classe .active + media query)
            // Limpa estilos inline para não conflitar
            this.activeTooltip.style.left = '';
            this.activeTooltip.style.top = '';
            return;
        }

        // Desktop: Posicionamento inteligente
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.activeTooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 10; // Acima do termo

        // Correção lateral (não sair da tela)
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Se não couber em cima, joga para baixo
        if (top < 0) {
            top = rect.bottom + 10;
            this.activeTooltip.classList.add('bottom');
        } else {
            this.activeTooltip.classList.remove('bottom');
        }

        this.activeTooltip.style.left = `${left}px`;
        this.activeTooltip.style.top = `${top + window.scrollY}px`;
    }
};

export default TooltipUI;

