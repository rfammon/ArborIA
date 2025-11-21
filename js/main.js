/* js/main.js (vFinal Corrigido)
   Importa e inicia TODOS os módulos.
*/

import UI from './ui.js';
import TooltipUI from './tooltip.ui.js';
import MapUI from './map.ui.js';
import CalculatorUI from './calculator.form.ui.js'; // <--- IMPORTANTE
import State from './state.js';
import Features from './features.js';
import Clinometer from './clinometer.js';
import DapEstimator from './dap.estimator.js';

import { manualContent } from './data-content.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[ArborIA] Booting...');

    // 1. Iniciar Estado e Hardware
    State.init();
    Features.init();
    
    // 2. Iniciar Componentes de UI
    UI.init();
    TooltipUI.init();
    
    // 3. Iniciar Mapa (Prepara container, mas só renderiza quando visível)
    MapUI.init();

    // 4. Iniciar Calculadora (Liga os listeners das abas e form)
    CalculatorUI.init(); // <--- ISSO ESTAVA FALTANDO ANTES!
    
    // 5. Iniciar Componentes de Câmera (Listeners)
    Clinometer.init();
    DapEstimator.init();

    // 6. Configurar Navegação Principal
    setupNavigation();

    // 7. PWA
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
            console.log('[SW] OK');
        } catch (e) { console.error('[SW] Fail', e); }
    }
});

function setupNavigation() {
    const buttons = document.querySelectorAll('.topico-btn');
    const navContainer = document.querySelector('.mapa-navegacao');
    const contentSection = document.getElementById('manual-view');
    const detailView = document.getElementById('detalhe-view');

    // Botão Voltar
    let backBtn = document.getElementById('btn-voltar-painel');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'btn-voltar-painel';
        backBtn.innerHTML = '⬅ Voltar ao Painel';
        contentSection.insertBefore(backBtn, detailView);
    }

    backBtn.addEventListener('click', () => {
        contentSection.style.display = 'none';
        document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');
        
        navContainer.style.display = 'block';
        navContainer.classList.remove('hidden');
        buttons.forEach(b => b.classList.remove('active'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const isMobile = window.innerWidth <= 768;

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Roteamento
            if (manualContent[targetId]) {
                // Texto do Manual
                UI.renderSection(targetId);
                hideSpecialViews();
                contentSection.style.display = 'block';
            } else {
                // Funcionalidade (Calculadora, Câmera)
                handleSpecialView(targetId);
            }

            // UI Mobile
            if (isMobile) {
                navContainer.classList.add('hidden');
                // Botão voltar aparece para tudo, MENOS para câmeras fullscreen
                if (!targetId.includes('view') || targetId === 'calculadora-risco') {
                     backBtn.style.display = 'flex';
                } else {
                     backBtn.style.display = 'none';
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
    document.getElementById('manual-view').style.display = 'block';
}

function handleSpecialView(targetId) {
    document.getElementById('manual-view').style.display = 'none';
    document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');

    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.style.display = 'block';
        
        // Se abriu a calculadora, força refresh do mapa e aba padrão
        if (targetId === 'calculadora-risco') {
            // Opcional: pode forçar abrir na aba 1 sempre
            // CalculatorUI.switchTab('tab-content-register'); 
            MapUI.refresh();
        }
    }
}
