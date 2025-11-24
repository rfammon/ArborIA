/**
 * ARBORIA 2.0 - TOOLTIP SYSTEM
 * Transforma termos técnicos em Cards de Glossário (Mobile Friendly).
 */

import { glossaryTerms, equipmentData, checklistData, podaPurposeData } from './content.js';

export const TooltipUI = {
    definitions: {
        "dap": "Diâmetro à Altura do Peito (1.30m do solo). Medida padrão mundial.",
        "galhos-mortos": "Galhos sem atividade biológica, secos e quebradiços. Alto risco de queda.",
        "rachaduras": "Fendas longitudinais ou transversais que comprometem a integridade mecânica.",
        "apodrecimento": "Decomposição da madeira por fungos (cartilaginosa ou fibrosa).",
        "casca-inclusa": "Casca presa na junção entre dois troncos, impedindo a união das fibras.",
        "brotacao-intensa": "Muitos brotos saindo do mesmo ponto (epicórmicos), indicando estresse.",
        "copa-assimetrica": "Desequilíbrio na distribuição de peso da copa, gerando alavanca.",
        "inclinacao": "Desvio do eixo vertical. Crítico se houver levantamento de solo.",
        "perda-raizes": "Danos mecânicos ou podas no sistema radicular de sustentação.",
        "compactacao": "Solo endurecido que impede a respiração das raízes.",
    },

    elements: {
        card: null,
        title: null,
        text: null,
        backdrop: null,
        imageContainer: null,
        closeButton: null // Adicionado botão de fechar
    },

    // Helper para normalizar chaves para o formato "lowercase-hyphenated"
    normalizeKey(key) {
        return key.toLowerCase().replace(/\s+/g, '-');
    },

    init() {
        this.elements.card = document.getElementById('tooltip-card');
        this.elements.title = document.getElementById('tooltip-title');
        this.elements.text = document.getElementById('tooltip-text');
        this.elements.backdrop = document.getElementById('tooltip-backdrop');
        this.elements.imageContainer = document.getElementById('tooltip-image-container');
        
        // Adiciona um botão de fechar diretamente no card do tooltip
        const existingCloseBtn = this.elements.card?.querySelector('.tooltip-close-btn');
        if (!existingCloseBtn) {
            this.elements.closeButton = document.createElement('button');
            this.elements.closeButton.className = 'tooltip-close-btn';
            this.elements.closeButton.innerHTML = '&times;';
            this.elements.closeButton.setAttribute('aria-label', 'Fechar');
            this.elements.card.prepend(this.elements.closeButton);
        } else {
            this.elements.closeButton = existingCloseBtn;
        }


        if (!this.elements.card) {
            console.warn("TooltipUI: Elementos do DOM não encontrados (tooltip-card).");
            return; 
        }

        // Normaliza as chaves de todos os termos antes de unificá-los.
        // A ordem importa: dados mais específicos (com imagens) devem vir por último.
        const normalizedGlossaryTerms = {};
        for (const key in glossaryTerms) {
            normalizedGlossaryTerms[this.normalizeKey(key)] = glossaryTerms[key];
        }

        const normalizedEquipmentData = {};
        for (const key in equipmentData) {
            normalizedEquipmentData[this.normalizeKey(key)] = equipmentData[key];
        }

        const normalizedChecklistData = {};
        for (const key in checklistData) {
            normalizedChecklistData[this.normalizeKey(key)] = checklistData[key];
        }

        const normalizedPodaPurposeData = {};
        for (const key in podaPurposeData) {
            normalizedPodaPurposeData[this.normalizeKey(key)] = podaPurposeData[key];
        }

        // Unifica todas as fontes de dados em um único objeto de definições, com chaves normalizadas.
        // Ordem de precedência (do menor para o maior):
        // 1. Definições base (hardcoded no objeto TooltipUI.definitions).
        // 2. Termos do glossário geral (glossaryTerms).
        // 3. Dados específicos de equipamentos, checklist, propósito de poda (equipmentData, checklistData, podaPurposeData).
        
        // Captura as definições base antes de serem sobrescritas
        const baseDefinitions = this.definitions;
        this.definitions = {}; // Reseta para construir com a ordem correta

        // Helper para normalizar e adicionar termos
        const addNormalizedTerms = (sourceObj, isNestedWithDesc = false) => {
            for (const key in sourceObj) {
                const normalizedKey = this.normalizeKey(key);
                if (isNestedWithDesc) {
                    this.definitions[normalizedKey] = sourceObj[key]; // Mantém o objeto {desc, img}
                } else {
                    this.definitions[normalizedKey] = sourceObj[key]; // Termo simples (string)
                }
            }
        };

        // 1. Adiciona as definições base
        addNormalizedTerms(baseDefinitions);
        // 2. Adiciona os termos do glossário geral (pode sobrescrever os base)
        addNormalizedTerms(glossaryTerms);
        // 3. Adiciona dados específicos (sobrescrevem os anteriores se houver conflito)
        addNormalizedTerms(equipmentData, true);
        addNormalizedTerms(checklistData, true);
        addNormalizedTerms(podaPurposeData, true);

        // --- LISTENERS DE DISMISSAL ---
        // Fecha ao clicar no backdrop ou no botão de fechar
        this.elements.backdrop.addEventListener('click', () => this.hideTooltip());
        this.elements.closeButton.addEventListener('click', () => this.hideTooltip());
        
        // Fecha com a tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.card.classList.contains('active')) {
                this.hideTooltip();
            }
        });

        // --- LISTENERS DE TRIGGER ---
        // Delegação de eventos para performance para hover/focus/click
        document.body.addEventListener('mouseover', this._handleTooltipEvent.bind(this));
        document.body.addEventListener('mouseout', this._handleTooltipEvent.bind(this));
        document.body.addEventListener('focusin', this._handleTooltipEvent.bind(this));
        document.body.addEventListener('focusout', this._handleTooltipEvent.bind(this));
        document.body.addEventListener('click', this._handleTooltipEvent.bind(this)); // Mantém click para compatibilidade touch

        console.log("✅ TooltipUI Initialized");
    },

    _handleTooltipEvent(e) {
        const target = e.target.closest('.checklist-term, .tooltip-trigger');
        if (!target) {
            if (e.type === 'mouseout' || e.type === 'focusout') {
                // Se o mouse saiu de um trigger e não entrou em outro, esconde
                // Ou se o foco saiu de um trigger
                // Previne fechar se o mouse entrar no próprio tooltip
                if (!this.elements.card.contains(e.relatedTarget) && !target) {
                    this.hideTooltip();
                }
            }
            return;
        }

        const termKey = target.getAttribute('data-term-key') || this.normalizeKey(target.textContent);
        const termText = target.textContent;
        
        if (termKey && this.definitions[termKey]) {
            // Evita re-mostrar se já está visível para o mesmo termo
            if (this.elements.card.classList.contains('active') && this.elements.title.textContent === termText) {
                return;
            }

            // Atraso para hover para evitar flashes acidentais
            if (e.type === 'mouseover') {
                this._hoverTimer = setTimeout(() => {
                    this.showTooltip(termText, this.definitions[termKey]);
                }, 300); // 300ms delay for hover
            } else if (e.type === 'mouseout') {
                clearTimeout(this._hoverTimer);
                // Permite que o tooltip permaneça visível se o foco estiver nele ou mouse entrar nele
                if (!this.elements.card.contains(e.relatedTarget)) {
                    this.hideTooltip();
                }
            } else if (e.type === 'focusin' || e.type === 'click') {
                clearTimeout(this._hoverTimer); // Cancela hover se clicou/focou
                this.showTooltip(termText, this.definitions[termKey]);
            }
        } else {
            const nativeTitle = target.getAttribute('title');
            if (nativeTitle) {
                if (e.type === 'mouseover') {
                    this._hoverTimer = setTimeout(() => {
                        this.showTooltip(termText, nativeTitle);
                    }, 300);
                } else if (e.type === 'mouseout') {
                    clearTimeout(this._hoverTimer);
                    if (!this.elements.card.contains(e.relatedTarget)) {
                        this.hideTooltip();
                    }
                } else if (e.type === 'focusin' || e.type === 'click') {
                    clearTimeout(this._hoverTimer);
                    this.showTooltip(termText, nativeTitle);
                }
            }
        }
    },

    showTooltip(title, definition) {
        let description = '';
        let imageUrl = null;

        if (typeof definition === 'string') {
            description = definition;
        } else if (typeof definition === 'object' && definition !== null) {
            description = definition.desc;
            if (definition.img) {
                imageUrl = `img/${definition.img}`;
            }
        }

        if(this.elements.title) this.elements.title.textContent = title;
        if(this.elements.text) this.elements.text.textContent = description;
        
        if (this.elements.imageContainer) {
            this.elements.imageContainer.innerHTML = '';
            if (imageUrl) {
                this.elements.imageContainer.innerHTML = `<img src="${imageUrl}" alt="${title}">`;
            }
        }
        
        if(this.elements.backdrop) this.elements.backdrop.classList.add('active');
        if(this.elements.card) {
            this.elements.card.classList.add('active');
            this.elements.card.setAttribute('aria-hidden', 'false'); // Acessibilidade
            this.elements.card.focus(); // Tenta focar no tooltip para leitura
        }
    },

    hideTooltip() {
        if(this.elements.backdrop) this.elements.backdrop.classList.remove('active');
        if(this.elements.card) {
            this.elements.card.classList.remove('active');
            this.elements.card.setAttribute('aria-hidden', 'true'); // Acessibilidade
            // Não remove o foco do elemento que ativou o tooltip
        }
        
        // Limpa a imagem ao fechar para não aparecer em tooltips sem imagem
        if (this.elements.imageContainer) {
            this.elements.imageContainer.innerHTML = '';
        }
    }
};
