/* js/main.js (vFinal 9.0 - The Maestro)
   Ponto de entrada principal. Gerencia a navegação e inicializa os módulos.
*/

// === 1. IMPORTAÇÕES (Módulos Refatorados) ===
import UI from './ui.js';
import TooltipUI from './tooltip.ui.js';
import MapUI from './map.ui.js';
import CalculatorUI from './calculator.form.ui.js';
import State from './state.js';
import Features from './features.js';
import Utils from './utils.js';
import Clinometer from './clinometer.js';
import DapEstimator from './dap.estimator.js';
import { manualContent } from './data-content.js';

// === 2. INICIALIZAÇÃO DO SISTEMA ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[ArborIA] Inicializando sistema...');

    // A. Configurar Navegação (Prioridade: UI deve responder rápido)
    try {
        setupNavigation();
        console.log('[Main] Navegação configurada.');
    } catch (e) {
        console.error('[Main] Erro fatal na navegação:', e);
    }

    // B. Inicializar Estado e Hardware
    try {
        State.init();     // Carrega dados do localStorage
        Features.init();  // WakeLock e Permissões
    } catch (e) { console.error('[Main] Erro em State/Features:', e); }

    // C. Inicializar Interfaces Visuais
    try {
        UI.init();
        TooltipUI.init();
        // Inicializa Tabela (necessário para a aba Resumo funcionar independente da Calc)
        // Nota: CalculatorUI também chama isso, mas é seguro chamar 2x
    } catch (e) { console.error('[Main] Erro em UI:', e); }

    // D. Inicializar Módulos Complexos (Com proteção individual)
    try {
        MapUI.init();
    } catch (e) { console.warn('[Main] Mapa não carregou (Leaflet ausente?):', e); }

    try {
        CalculatorUI.init(); 
    } catch (e) { console.warn('[Main] Calculadora falhou:', e); }

    try {
        Clinometer.init();
        DapEstimator.init();
    } catch (e) { console.warn('[Main] Ferramentas de Câmera falharam:', e); }

    // E. Service Worker (PWA Offline)
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
            console.log('[SW] Service Worker registrado.');
        } catch (e) { console.error('[SW] Falha no registro:', e); }
    }
});

// === 3. LÓGICA DE NAVEGAÇÃO (Desktop & Mobile) ===

function setupNavigation() {
    const buttons = document.querySelectorAll('.topico-btn');
    const navContainer = document.querySelector('.mapa-navegacao');
    const contentSection = document.getElementById('manual-view');
    const detailView = document.getElementById('detalhe-view'); // Onde o texto é injetado

    // 3.1. Criar/Buscar Botão Voltar (Mobile)
    let backBtn = document.getElementById('btn-voltar-painel');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'btn-voltar-painel';
        backBtn.innerHTML = '⬅ Voltar ao Painel';
        // Insere antes do conteúdo para ficar visível no topo
        if (contentSection && contentSection.parentNode) {
            contentSection.parentNode.insertBefore(backBtn, contentSection);
        }
    }

    // 3.2. Ação do Botão Voltar
    backBtn.addEventListener('click', () => {
        // Esconde todas as views de conteúdo
        contentSection.style.display = 'none';
        document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');
        
        // Mostra o Painel de Navegação
        navContainer.style.display = 'block';
        navContainer.classList.remove('hidden');
        
        // Esconde o botão voltar
        backBtn.style.display = 'none';
        
        // Reseta botões ativos
        buttons.forEach(b => b.classList.remove('active'));
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3.3. Ação dos Botões do Menu
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.dataset.target;
            const isMobile = window.innerWidth <= 768;

            console.log('[Main] Navegando para:', targetId);

            // Feedback Visual
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Lógica de Roteamento
            if (manualContent[targetId]) {
                // ROTA A: Conteúdo de Texto (Manual)
                UI.renderSection(targetId);
                hideSpecialViews();
                contentSection.style.display = 'block';
            } else {
                // ROTA B: Funcionalidade (App View: Calc, Clinometro, etc)
                handleSpecialView(targetId);
            }

            // Lógica Específica Mobile (Single View)
            if (isMobile) {
                // Esconde o menu principal
                navContainer.style.display = 'none';
                
                // Decide se mostra o botão voltar
                // Câmeras (Clinometro/DAP) têm botão 'Sair' próprio (X), então não precisam de voltar
                if (targetId === 'clinometro-view' || targetId === 'dap-estimator-view') {
                    backBtn.style.display = 'none';
                } else {
                    backBtn.style.display = 'flex'; // Flex para centralizar texto/icone se houver
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Desktop: Nunca mostra botão voltar
                backBtn.style.display = 'none';
            }
        });
    });
}

// === 4. HELPERS DE VISIBILIDADE ===

function hideSpecialViews() {
    // Esconde Calculadora, Mapa, Câmeras
    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });
    
    // Garante que o container de texto (manual) esteja pronto para aparecer
    const manualView = document.getElementById('manual-view');
    if(manualView) manualView.style.display = 'block';
}

function handleSpecialView(targetId) {
    // 1. Esconde o container de texto do manual
    const manualView = document.getElementById('manual-view');
    if(manualView) manualView.style.display = 'none';
    
    // 2. Esconde TODAS as views de app primeiro (reset)
    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });

    // 3. Mostra a view específica solicitada
    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.style.display = 'block';
        
        // === FIX DA CALCULADORA ===
        // Se for a calculadora, força a inicialização visual correta
        if (targetId === 'calculadora-risco') {
            try {
                // Garante que o mapa não fique cinza
                MapUI.refresh();
                
                // Garante que a aba "Registrar" esteja aberta e visível
                CalculatorUI.openTab('tab-content-register');
                
            } catch(e) {
                console.warn('[Main] Erro ao resetar visual da calculadora:', e);
            }
        }
        
        // === FIX DAS CÂMERAS ===
        // Inicia o stream se necessário (embora o Observer no módulo já faça isso)
        if (targetId === 'clinometro-view') {
            try { Clinometer.start(); } catch(e){}
        }
        if (targetId === 'dap-estimator-view') {
            try { DapEstimator.start(); } catch(e){}
        }
    } else {
        console.error(`[Main] View não encontrada: #${targetId}`);
        Utils.showToast('Erro: Funcionalidade não encontrada.', 'error');
    }
}
