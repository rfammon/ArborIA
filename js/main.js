/* js/main.js (vFinal) - Controller Principal */

import UI from './ui.js';
import TooltipUI from './tooltip.ui.js';
import MapUI from './map.ui.js';
import { manualContent, glossaryData } from './data-content.js'; // Importando dados
import State from './state.js';

// Inicialização Principal
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[ArborIA] Inicializando Sistema...');

    // 1. Inicializa UI e Componentes
    UI.init();
    
    // CRÍTICO: Passar os dados para o TooltipUI ou garantir que ele leia do módulo correto
    // Aqui apenas iniciamos os listeners
    TooltipUI.init(); 
    
    // 2. Renderiza conteúdo inicial (opcional ou vazio)
    // Não carregamos nada por padrão para deixar o menu limpo, 
    // ou carregamos 'conceitos-basicos' mas sem esconder o menu no desktop.

    // 3. Configura Navegação (Botões do Painel)
    setupNavigation();

    // 4. Configura Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('./service-worker.js');
            console.log('[SW] Registrado:', reg.scope);
        } catch (err) {
            console.error('[SW] Falha:', err);
        }
    }
});

function setupNavigation() {
    const buttons = document.querySelectorAll('.topico-btn');
    const navContainer = document.querySelector('.mapa-navegacao');
    const contentSection = document.getElementById('manual-view');
    const detailView = document.getElementById('detalhe-view');

    // Cria o botão "Voltar" dinamicamente se não existir
    let backBtn = document.getElementById('btn-voltar-painel');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'btn-voltar-painel';
        backBtn.innerHTML = '⬅ Voltar ao Painel';
        // Insere ANTES do conteúdo do manual
        contentSection.insertBefore(backBtn, detailView);
    }

    // Ação do Botão Voltar
    backBtn.addEventListener('click', () => {
        // Esconde conteúdo, Mostra painel
        contentSection.style.display = 'none'; // Ou classe .hidden
        
        // Limpa Views Especiais (Calculadora, Câmeras)
        document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');
        
        navContainer.style.display = 'block'; // Reexibe painel
        navContainer.classList.remove('hidden');
        
        // Reseta estado ativo dos botões
        buttons.forEach(btn => btn.classList.remove('active'));
        
        // Scroll para o topo suavemente
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Ação dos Botões de Tópico
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.dataset.target;
            const isMobile = window.innerWidth <= 768;

            // 1. UI Feedback
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2. Roteamento de Conteúdo
            if (manualContent[targetId]) {
                // É um conteúdo de texto (HTML)
                UI.renderSection(targetId);
                hideSpecialViews();
                contentSection.style.display = 'block';
            } else {
                // É uma Funcionalidade (Calculadora, Câmera)
                handleSpecialView(targetId);
            }

            // 3. Lógica Mobile "Single View"
            if (isMobile) {
                navContainer.classList.add('hidden'); // Esconde Painel
                
                // Mostra o botão voltar apenas se não for Câmera (Câmeras tem seu próprio botão de sair)
                if (!targetId.includes('view') || targetId === 'calculadora-risco') {
                     backBtn.classList.add('visible');
                     backBtn.style.display = 'flex';
                } else {
                     backBtn.style.display = 'none';
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Desktop: Botão voltar não é necessário normalmente, mas se quiser:
                backBtn.style.display = 'none';
            }
        });
    });
}

function hideSpecialViews() {
    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });
    // Garante que o container de texto padrão apareça
    document.getElementById('manual-view').style.display = 'block';
}

function handleSpecialView(targetId) {
    // Esconde texto padrão
    document.getElementById('manual-view').style.display = 'none';
    
    // Esconde todas as views especiais primeiro
    document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');

    // Mostra a view alvo
    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.style.display = 'block';
        
        // Inicia scripts específicos se necessário
        if (targetId === 'calculadora-risco') {
            MapUI.init(); // Garante que o mapa renderize corretamente (resize issue)
        }
    }
}
