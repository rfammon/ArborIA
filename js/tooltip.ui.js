/* js/tooltip.ui.js (vFinal - Híbrido & Robusto)
   Gerencia Tooltips: Hover (Desktop) e Click (Mobile).
   Integração correta com data-content.js e Module System.
*/

import { glossaryData } from './data-content.js';

const TooltipUI = {
    activeTooltip: null,
    backdrop: null,
    isMobile: false,
    hideTimeout: null, // Timer para evitar fechamento brusco no mouseout

    init() {
        console.log('[TooltipUI] Inicializando...');
        
        // 1. Detecção de Mobile (Toque ou largura de tela)
        this.isMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
        
        // Atualiza flag ao redimensionar a tela
        window.addEventListener('resize', () => {
            this.isMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
        });

        this.createTooltipElement();
        this.setupEventListeners();
    },

    createTooltipElement() {
        if (document.getElementById('arboria-tooltip')) return;

        // Cria o Card Flutuante
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

        // Cria o Fundo Escuro (Backdrop) para Mobile
        const backdropDiv = document.createElement('div');
        backdropDiv.className = 'tooltip-backdrop';
        document.body.appendChild(backdropDiv);
        this.backdrop = backdropDiv;
    },

    setupEventListeners() {
        // Usamos delegação de eventos no 'document' para capturar elementos injetados dinamicamente
        
        // A. EVENTOS DE CLIQUE (Mobile Principal + Fechar Desktop)
        document.addEventListener('click', (e) => {
            const termElement = e.target.closest('.glossary-term, [data-term-key]');
            const closeBtn = e.target.closest('.tooltip-close');
            const isTooltipClick = e.target.closest('.tooltip-card');

            // 1. Clique no Botão Fechar
            if (closeBtn) {
                e.preventDefault();
                this.hide();
                return;
            }

            // 2. Clique num Termo (Lógica Mobile)
            if (termElement) {
                if (this.isMobile) {
                    e.preventDefault();
                    e.stopPropagation();
                    const termKey = termElement.getAttribute('data-term-key');
                    this.show(termElement, termKey);
                }
                // No Desktop, o hover cuida de abrir, mas clicar não deve fechar.
                return;
            }

            // 3. Clique Fora (Fechar)
            // Se o tooltip está aberto e o clique NÃO foi dentro dele
            if (this.activeTooltip && this.activeTooltip.classList.contains('active') && !isTooltipClick) {
                this.hide();
            }
        });

        // B. EVENTOS DE MOUSE (Apenas Desktop)
        document.addEventListener('mouseover', (e) => {
            if (this.isMobile) return; // Ignora em telas de toque

            const termElement = e.target.closest('.glossary-term, [data-term-key]');
            if (termElement) {
                // Cancela o fechamento se o usuário voltou para um termo
                if (this.hideTimeout) clearTimeout(this.hideTimeout);
                
                const termKey = termElement.getAttribute('data-term-key');
                this.show(termElement, termKey);
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (this.isMobile) return;

            const termElement = e.target.closest('.glossary-term, [data-term-key]');
            if (termElement) {
                // Delay de segurança para permitir mover o mouse do texto para o tooltip
                this.hideTimeout = setTimeout(() => {
                    // Só fecha se o mouse NÃO estiver em cima do tooltip
                    if (!this.activeTooltip.matches(':hover')) {
                        this.hide();
                    }
                }, 300); // 300ms de tolerância
            }
        });

        // Garante que o tooltip permaneça aberto se o mouse estiver sobre ELE (Desktop)
        if (this.activeTooltip) {
            this.activeTooltip.addEventListener('mouseleave', () => {
                if (!this.isMobile) this.hide();
            });
        }

        // Acessibilidade: Tecla ESC fecha
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    },

    show(targetElement, termKey) {
        // Segurança: Verifica se os dados existem
        if (!glossaryData) {
            console.error('[TooltipUI] Erro: glossaryData não carregado.');
            return;
        }

        const content = glossaryData[termKey];
        
        if (!content) {
            console.warn(`[TooltipUI] Termo não encontrado: "${termKey}"`);
            return;
        }

        // Preenche o conteúdo
        const body = this.activeTooltip.querySelector('#tooltip-body');
        const title = this.activeTooltip.querySelector('.tooltip-title');
        
        title.textContent = content.title || 'Informação';
        body.innerHTML = content.description; // Permite HTML dentro da descrição

        // Exibe visualmente (usando requestAnimationFrame para evitar bugs de layout)
        requestAnimationFrame(() => {
            this.activeTooltip.classList.add('active');
            if (this.isMobile) {
                this.backdrop.classList.add('active');
            }
            
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
            // No Mobile, o CSS (position: fixed) cuida de centralizar.
            // Limpamos estilos inline que poderiam interferir.
            this.activeTooltip.style.left = '';
            this.activeTooltip.style.top = '';
            return;
        }

        // Lógica Desktop (Posicionamento Inteligente)
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.activeTooltip.getBoundingClientRect();
        
        // Centraliza horizontalmente em relação ao termo
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Posiciona ACIMA do termo por padrão
        let top = rect.top - tooltipRect.height - 12; 

        // Correção de bordas (não sair da tela pela esquerda/direita)
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Se não couber em cima (topo da tela), joga para baixo
        if (top < 0) {
            top = rect.bottom + 12;
            this.activeTooltip.classList.add('bottom'); // Classe opcional para inverter a setinha css
        } else {
            this.activeTooltip.classList.remove('bottom');
        }

        // Aplica coordenadas (somando o scroll da página)
        this.activeTooltip.style.left = `${left}px`;
        this.activeTooltip.style.top = `${top + window.scrollY}px`;
    }
};

/* EXPORTAÇÃO PADRÃO (Corrige o erro do main.js) */
export default TooltipUI;
