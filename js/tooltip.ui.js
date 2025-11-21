/* js/tooltip.ui.js 
   Gerenciador de Tooltips (Refatorado com requestAnimationFrame)
   Correção: Layout Thrashing e Posicionamento
*/

import { glossaryData } from './data-content.js';

const TooltipUI = {
    activeTooltip: null,
    backdrop: null,
    isMobile: false,

    init() {
        // Detecta mobile uma vez na inicialização
        this.isMobile = window.innerWidth <= 768;
        
        // Atualiza flag de mobile se redimensionar
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
        });

        this.createTooltipElement();
        this.setupEventListeners();
    },

    createTooltipElement() {
        // Evita duplicar se já existir
        if (document.getElementById('arboria-tooltip')) return;

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

        const backdropDiv = document.createElement('div');
        backdropDiv.className = 'tooltip-backdrop';
        document.body.appendChild(backdropDiv);
        this.backdrop = backdropDiv;
    },

    setupEventListeners() {
        // Delegação de eventos para abrir tooltip
        document.addEventListener('click', (e) => {
            const termElement = e.target.closest('.checklist-term, [data-term-key]');
            
            if (termElement) {
                e.preventDefault();
                e.stopPropagation();
                const termKey = termElement.getAttribute('data-term-key');
                this.show(termElement, termKey);
            } else {
                // Fechar se clicar fora
                if (this.activeTooltip && 
                    this.activeTooltip.classList.contains('active') && 
                    !e.target.closest('.tooltip-card')) {
                    this.hide();
                }
            }
        });

        // Botão Fechar
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tooltip-close')) {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            }
        });
        
        // Tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    },

    show(targetElement, termKey) {
        // Verificação de segurança: Dados existem?
        if (!glossaryData) {
            console.error('[ArborIA] Erro: glossaryData não importado ou vazio.');
            return;
        }

        const content = glossaryData[termKey];
        
        if (!content) {
            console.warn(`[ArborIA] Termo não encontrado no glossário: ${termKey}`);
            return;
        }

        const body = this.activeTooltip.querySelector('#tooltip-body');
        const title = this.activeTooltip.querySelector('.tooltip-title');
        
        // 1. ESCRITA (Altera o DOM)
        title.textContent = content.title || 'Definição';
        body.innerHTML = content.description;

        // 2. LEITURA E POSICIONAMENTO (Agendado para o próximo frame)
        // Isso evita o erro "Layout Forced"
        requestAnimationFrame(() => {
            this.activeTooltip.classList.add('active');
            this.backdrop.classList.add('active');
            this.updatePosition(targetElement);
        });
    },

    hide() {
        if (this.activeTooltip) {
            this.activeTooltip.classList.remove('active');
            this.backdrop.classList.remove('active');
        }
    },

    updatePosition(targetElement) {
        if (this.isMobile) {
            // Resetar estilos inline no mobile para o CSS controlar (Fixed Center)
            this.activeTooltip.style.left = '';
            this.activeTooltip.style.top = '';
            return;
        }

        // Lógica Desktop
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.activeTooltip.getBoundingClientRect();
        
        // Centraliza horizontalmente
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Posiciona ACIMA por padrão
        let top = rect.top - tooltipRect.height - 12; // 12px de margem

        // Correção de bordas (Viewport)
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Se não couber em cima, joga para baixo
        if (top < 0) {
            top = rect.bottom + 12;
            this.activeTooltip.classList.add('bottom');
        } else {
            this.activeTooltip.classList.remove('bottom');
        }

        // Aplica coordenadas (com scroll global)
        this.activeTooltip.style.left = `${left}px`;
        this.activeTooltip.style.top = `${top + window.scrollY}px`;
    }
};

export default TooltipUI;
