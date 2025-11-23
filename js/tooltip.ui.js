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
        imageContainer: null
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

        // Fecha ao clicar no backdrop
        this.elements.backdrop.addEventListener('click', () => this.hideTooltip());
        this.elements.card.addEventListener('click', () => this.hideTooltip());

        // Delegação de eventos para performance
        document.body.addEventListener('click', (e) => {
            if (e.target.classList.contains('checklist-term') || e.target.classList.contains('tooltip-trigger')) {
                const termKey = e.target.getAttribute('data-term-key'); // Já vem normalizado
                const termText = e.target.textContent;
                
                if (termKey && this.definitions[termKey]) {
                    this.showTooltip(termText, this.definitions[termKey]);
                } else {
                    const nativeTitle = e.target.getAttribute('title');
                    if (nativeTitle) this.showTooltip(termText, nativeTitle);
                }
            }
        });
        
        console.log("✅ TooltipUI Initialized");
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
        if(this.elements.card) this.elements.card.classList.add('active');
    },

    hideTooltip() {
        if(this.elements.backdrop) this.elements.backdrop.classList.remove('active');
        if(this.elements.card) this.elements.card.classList.remove('active');
        
        // Limpa a imagem ao fechar para não aparecer em tooltips sem imagem
        if (this.elements.imageContainer) {
            this.elements.imageContainer.innerHTML = '';
        }
    }
};
