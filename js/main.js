/* js/main.js (vFinal 7.0)
   Controlador Principal (Entry Point).
   Inicializa módulos, gerencia roteamento e garante integridade da UI.
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
    console.log('[ArborIA] Inicializando sistema...');

    // 1. Configurar Navegação (PRIORIDADE MÁXIMA)
    // Deve rodar antes de tudo para garantir que os botões respondam
    try {
        setupNavigation();
        console.log('[Main] Navegação configurada.');
    } catch (e) {
        console.error('[Main] Erro fatal na navegação:', e);
    }

    // 2. Iniciar Estado e Hardware
    try {
        State.init();
        Features.init();
    } catch (e) { console.error('[Main] Falha em State/Features:', e); }

    // 3. Iniciar UI Básica
    try {
        UI.init();
        TooltipUI.init();
    } catch (e) { console.error('[Main] Falha em UI/Tooltip:', e); }
    
    // 4. Iniciar Módulos Complexos (Com proteção de erro individual)
    try {
        MapUI.init();
    } catch (e) { console.warn('[Main] Mapa falhou na inicialização:', e); }

    try {
        CalculatorUI.init();
    } catch (e) { console.warn('[Main] Calculadora falhou na inicialização:', e); }
    
    try {
        Clinometer.init();
        DapEstimator.init();
    } catch (e) { console.warn('[Main] Sensores/Câmera falharam:', e); }

    // 5. Service Worker (PWA Offline)
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('./service-worker.js');
            console.log('[SW] Registrado:', reg.scope);
        } catch (e) { console.error('[SW] Falha:', e); }
    }
});

/* --- LÓGICA DE NAVEGAÇÃO --- */

function setupNavigation() {
    const buttons = document.querySelectorAll('.topico-btn');
    const navContainer = document.querySelector('.mapa-navegacao');
    const contentSection = document.getElementById('manual-view');
    const detailView = document.getElementById('detalhe-view');

    // 1. Criação do Botão "Voltar" (Mobile/App Style)
    let backBtn = document.getElementById('btn-voltar-painel');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'btn-voltar-painel';
        backBtn.innerHTML = '⬅ Voltar ao Painel';
        // Insere antes do conteúdo para ficar no topo
        contentSection.insertBefore(backBtn, detailView);
    }

    // 2. Ação do Botão Voltar
    backBtn.addEventListener('click', () => {
        // Esconde todas as views
        contentSection.style.display = 'none';
        document.querySelectorAll('.app-view').forEach(el => el.style.display = 'none');
        
        // Mostra o Painel de Ícones
        navContainer.style.display = 'block';
        navContainer.classList.remove('hidden');
        
        // Reseta estado ativo dos botões
        buttons.forEach(b => b.classList.remove('active'));
        
        // Rola para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. Ação dos Botões do Menu Principal
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.dataset.target;
            const isMobile = window.innerWidth <= 768;

            // Feedback Visual
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // ROTEAMENTO
            if (manualContent[targetId]) {
                // Rota A: Conteúdo de Texto (Manual)
                UI.renderSection(targetId);
                hideSpecialViews();
                contentSection.style.display = 'block';
            } else {
                // Rota B: Funcionalidade (App View)
                handleSpecialView(targetId);
            }

            // UX Mobile: "Single Page Feel"
            if (isMobile) {
                navContainer.classList.add('hidden');
                navContainer.style.display = 'none'; 
                
                // Lógica do botão voltar
                // Se for Câmera (Clinometro/DAP), eles têm botão 'Sair' próprio
                if (!targetId.includes('view') || targetId === 'calculadora-risco') {
                     backBtn.style.display = 'flex';
                } else {
                     backBtn.style.display = 'none';
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Desktop: Não precisa de botão voltar
                backBtn.style.display = 'none';
            }
        });
    });
}

function hideSpecialViews() {
    // Esconde Calculadora, Mapa, Câmeras
    document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');
    
    // Garante que o container de texto esteja visível
    const manualView = document.getElementById('manual-view');
    if(manualView) manualView.style.display = 'block';
}

function handleSpecialView(targetId) {
    // Esconde o container de texto
    const manualView = document.getElementById('manual-view');
    if(manualView) manualView.style.display = 'none';
    
    // Esconde todas as views primeiro (reset)
    document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');

    // Mostra a view alvo
    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.style.display = 'block';
        
        // === TRATAMENTO ESPECIAL PARA A CALCULADORA ===
        if (targetId === 'calculadora-risco') {
            try { 
                // 1. Força o Mapa a recalcular tamanho (evita tela cinza)
                MapUI.refresh(); 
                
                // 2. Força a aba "Registrar" a abrir (evita abas vazias)
                CalculatorUI.openTab('tab-content-register');
                
            } catch(e) {
                console.warn('[Main] Erro ao resetar visual da calculadora:', e);
            }
        }
    }
}
