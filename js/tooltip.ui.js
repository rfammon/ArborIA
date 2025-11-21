/**
 * ARBORIA 2.0 - TOOLTIP SYSTEM
 * Transforma termos técnicos em Cards de Glossário (Mobile Friendly).
 */

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
        // Adicione mais definições aqui conforme necessário
    },

    elements: {
        card: null,
        title: null,
        text: null,
        backdrop: null
    },

    init() {
        this.elements.card = document.getElementById('tooltip-card');
        this.elements.title = document.getElementById('tooltip-title');
        this.elements.text = document.getElementById('tooltip-text');
        this.elements.backdrop = document.getElementById('tooltip-backdrop');

        if (!this.elements.card) {
            console.warn("TooltipUI: Elementos do DOM não encontrados (tooltip-card).");
            return; 
        }

        // Fecha ao clicar no backdrop
        this.elements.backdrop.addEventListener('click', () => this.hideTooltip());

        // Delegação de eventos para performance (pega cliques em qualquer lugar)
        document.body.addEventListener('click', (e) => {
            // Verifica se clicou num termo de checklist ou trigger de tooltip
            if (e.target.classList.contains('checklist-term') || e.target.classList.contains('tooltip-trigger')) {
                const termKey = e.target.getAttribute('data-term-key');
                const termText = e.target.textContent;
                
                if (termKey && this.definitions[termKey]) {
                    this.showTooltip(termText, this.definitions[termKey]);
                } else {
                    // Fallback: tenta usar o atributo 'title' nativo se não tiver chave
                    const nativeTitle = e.target.getAttribute('title');
                    if (nativeTitle) this.showTooltip(termText, nativeTitle);
                }
            }
        });
        
        console.log("✅ TooltipUI Initialized");
    },

    showTooltip(title, description) {
        if(this.elements.title) this.elements.title.textContent = title;
        if(this.elements.text) this.elements.text.textContent = description;
        
        if(this.elements.backdrop) this.elements.backdrop.classList.add('active');
        if(this.elements.card) this.elements.card.classList.add('active');
    },

    hideTooltip() {
        if(this.elements.backdrop) this.elements.backdrop.classList.remove('active');
        if(this.elements.card) this.elements.card.classList.remove('active');
    }
};
