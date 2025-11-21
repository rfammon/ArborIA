/* js/main.js (vFinal Blindado)
   Inicialização robusta com tratamento de erros.
*/

import UI from './ui.js';
import TooltipUI from './tooltip.ui.js';
import MapUI from './map.ui.js';
import CalculatorUI from './calculator.form.ui.js';
import State from './state.js';
import Features from './features.js';
import Clinometer from './clinometer.js';
import DapEstimator from './dap.estimator.js';
import { manualContent } from './data-content.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[ArborIA] Inicializando...');

    // 1. Configurar Navegação (PRIORIDADE MÁXIMA)
    // Roda primeiro para garantir que os botões funcionem mesmo se o resto falhar
    try {
        setupNavigation();
        console.log('[Main] Navegação configurada.');
    } catch (e) {
        console.error('[Main] Erro fatal na navegação:', e);
    }

    // 2. Iniciar Estado e UI Básica
    try {
        State.init();
        UI.init();
        TooltipUI.init();
        Features.init();
    } catch (e) {
        console.error('[Main] Erro em módulos core:', e);
    }
    
    // 3. Iniciar Módulos Complexos (Com proteção de erro)
    try {
        MapUI.init();
    } catch (e) { console.warn('[Main] Mapa falhou:', e); }

    try {
        CalculatorUI.init();
    } catch (e) { console.warn('[Main] Calculadora falhou:', e); }
    
    try {
        Clinometer.init();
        DapEstimator.init();
    } catch (e) { console.warn('[Main] Sensores falharam:', e); }

    // 4. Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
            console.log('[SW] Registrado.');
        } catch (e) { console.error('[SW] Falha:', e); }
    }
});

function setupNavigation() {
    const buttons = document.querySelectorAll('.topico-btn');
    const navContainer = document.querySelector('.mapa-navegacao');
    const contentSection = document.getElementById('manual-view');
    const detailView = document.getElementById('detalhe-view');

    // Cria botão Voltar
    let backBtn = document.getElementById('btn-voltar-painel');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'btn-voltar-painel';
        backBtn.innerHTML = '⬅ Voltar ao Painel';
        contentSection.insertBefore(backBtn, detailView);
    }

    // Ação Voltar
    backBtn.addEventListener('click', () => {
        // Esconde tudo
        contentSection.style.display = 'none';
        document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');
        
        // Mostra Painel
        navContainer.style.display = 'block';
        navContainer.classList.remove('hidden');
        
        // Limpa ativos
        buttons.forEach(b => b.classList.remove('active'));
        
        // Scroll topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Ação Botões do Menu
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Feedback Visual Imediato
            console.log('Clique no botão:', btn.dataset.target); // Debug
            
            const targetId = btn.dataset.target;
            const isMobile = window.innerWidth <= 768;

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Roteamento
            if (manualContent[targetId]) {
                // É Texto
                UI.renderSection(targetId);
                hideSpecialViews();
                contentSection.style.display = 'block';
            } else {
                // É Funcionalidade (Calc, Map, Cam)
                handleSpecialView(targetId);
            }

            // Lógica Mobile Single-View
            if (isMobile) {
                // Esconde o menu
                navContainer.classList.add('hidden');
                navContainer.style.display = 'none'; 
                
                // Controla botão voltar
                if (!targetId.includes('view') || targetId === 'calculadora-risco') {
                     backBtn.style.display = 'flex';
                } else {
                     backBtn.style.display = 'none'; // Câmeras tem seu próprio botão X
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                backBtn.style.display = 'none';
            }
        });
    });
}

function hideSpecialViews() {
    document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');
    const manualView = document.getElementById('manual-view');
    if(manualView) manualView.style.display = 'block';
}

function handleSpecialView(targetId) {
    const manualView = document.getElementById('manual-view');
    if(manualView) manualView.style.display = 'none';
    
    document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');

    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.style.display = 'block';
        if (targetId === 'calculadora-risco') {
            try { MapUI.refresh(); } catch(e){}
        }
    }
}
