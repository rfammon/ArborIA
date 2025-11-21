/* js/ui.js (vFinal)
   Gerenciador de Interface do Usuário
   Corrige erro de exportação e renderiza conteúdo do data-content.js
*/

import { manualContent } from './data-content.js';

const UI = {
    // Elementos DOM Cacheados
    elements: {
        contentArea: document.getElementById('detalhe-view'),
        manualView: document.getElementById('manual-view'),
        navContainer: document.querySelector('.mapa-navegacao'),
        backBtn: document.getElementById('btn-voltar-painel')
    },

    init() {
        console.log('[UI] Inicializado.');
        // Você pode adicionar listeners globais de UI aqui se precisar
    },

    // Função Principal: Renderiza o HTML do manual na tela
    renderSection(targetId) {
        const content = manualContent[targetId];
        const view = this.elements.contentArea;

        if (!content) {
            console.error(`[UI] Conteúdo não encontrado para: ${targetId}`);
            view.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3>Conteúdo em Desenvolvimento</h3>
                    <p>O tópico "${targetId}" ainda não foi cadastrado no sistema.</p>
                </div>
            `;
            return;
        }

        // 1. Injeta o HTML
        view.innerHTML = `
            <h3 class="section-title">${content.titulo}</h3>
            <div class="section-body fade-in">
                ${content.html}
            </div>
        `;

        // 2. Scroll suave para o topo do conteúdo
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // 3. (Opcional) Reconectar listeners de imagens ou botões internos se houver
        this.setupInternalListeners();
    },

    setupInternalListeners() {
        // Exemplo: Se quiser que as imagens abram em tela cheia ao clicar
        const images = document.querySelectorAll('.manual-img');
        images.forEach(img => {
            img.addEventListener('click', () => {
                // Lógica futura de lightbox
                console.log('Imagem clicada:', img.src);
            });
        });
    }
};

/* CORREÇÃO DO ERRO: 
   A linha abaixo 'export default UI' é obrigatória para que 
   o 'import UI from ...' no main.js funcione.
*/
export default UI;
