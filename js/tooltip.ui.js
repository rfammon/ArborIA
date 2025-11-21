/* js/tooltip.ui.js 
   Gerenciador de Tooltips (Definições e Termos)
   Refatorado para Mobile-First e UX estável.
*/

import { glossaryData } from './data-content.js';

const TooltipUI = {
    activeTooltip: null,
    backdrop: null,

    init() {
        // 1. Cria o elemento DOM do tooltip se não existir
        this.createTooltipElement();
        
        // 2. Configura listeners globais (Delegation) para abrir tooltips
        // Isso pega cliques em <span class="checklist-term"> ou qualquer [data-term-key]
        document.addEventListener('click', (e) => {
            const termElement = e.target.closest('.checklist-term, [data-term-key]');
            
            if (termElement) {
                e.preventDefault();
                e.stopPropagation(); // Impede que o clique feche imediatamente
                const termKey = termElement.getAttribute('data-term-key');
                this.show(termElement, termKey);
            } else {
                // Se clicou fora (no backdrop ou corpo), verifica se deve fechar
                if (this.activeTooltip && !e.target.closest('.tooltip-card')) {
                    this.hide();
                }
            }
        });

        // 3. Listener específico para o botão Fechar
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tooltip-close')) {
                e.preventDefault();
                this.hide();
            }
        });
        
        // 4. Listener para tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });

        // NOTA: Removemos listeners de 'scroll' para evitar fechamento acidental no mobile.
    },

    createTooltipElement() {
        // Cria o Card do Tooltip
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

        // Cria o Backdrop (Fundo escuro para mobile)
        const backdropDiv = document.createElement('div');
        backdropDiv.className = 'tooltip-backdrop';
        document.body.appendChild(backdropDiv);
        this.backdrop = backdropDiv;
    },

    show(targetElement, termKey) {
        const content = glossaryData[termKey];
        
        if (!content) {
            console.warn(`[Tooltip] Termo não encontrado: ${termKey}`);
            return;
        }

        // Preenche conteúdo
        const body = this.activeTooltip.querySelector('#tooltip-body');
        const title = this.activeTooltip.querySelector('.tooltip-title');
        
        title.textContent = content.title || 'Definição';
        body.innerHTML = content.description; // Permite HTML (negrito, imagens)

        // Ativa visualmente
        this.activeTooltip.classList.add('active');
        this.backdrop.classList.add('active');

        // Posicionamento Inteligente
        this.updatePosition(targetElement);
    },

    hide() {
        if (this.activeTooltip) {
            this.activeTooltip.classList.remove('active');
            this.backdrop.classList.remove('active');
        }
    },

    updatePosition(targetElement) {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // No mobile, o CSS resolve com position: fixed e transform translate center.
            // Removemos estilos inline que poderiam conflitar.
            this.activeTooltip.style.left = '';
            this.activeTooltip.style.top = '';
            return; 
        }

        // Lógica Desktop (Posicionar próximo ao elemento)
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.activeTooltip.getBoundingClientRect();
        
        // Centraliza horizontalmente em relação ao termo
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Posiciona acima do termo por padrão
        let top = rect.top - tooltipRect.height - 10; 

        // Se sair da tela pela esquerda
        if (left < 10) left = 10;
        
        // Se sair da tela pela direita
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Se não couber em cima, joga para baixo
        if (top < 10) {
            top = rect.bottom + 10;
            this.activeTooltip.classList.add('bottom'); // Opcional: virar a setinha
        } else {
            this.activeTooltip.classList.remove('bottom');
        }

        // Aplica coordenadas (com scroll global considerado)
        this.activeTooltip.style.left = `${left}px`;
        this.activeTooltip.style.top = `${top + window.scrollY}px`;
    }
};

export default TooltipUI;
