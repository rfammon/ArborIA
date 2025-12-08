/**
 * ARBORIA - Módulo de Planejamento (ESM Edition)
 * Versão: 2.2 (Refactored to ES Module)
 */
import { RISK_LABELS } from './constants.js';
import { openReportPreview } from './utils.js';

'use strict';

// --- CONFIGURAÇÃO E CONSTANTES ---
const CONSTANTS = {
    EPIS: [
        'Capacete com jugular (NR-35)', 'Óculos de proteção ampla visão',
        'Protetor auricular tipo concha', 'Luvas de vaqueta/anticorte',
        'Perneiras de proteção', 'Calçado de segurança com biqueira',
        'Cinto tipo paraquedista (Trabalho em Altura)', 'Roupa com proteção UV'
    ],
    TOOLS: [
        'Motosserra (Sabre > 30cm)', 'Motopoda (Haste telescópica)',
        'Serrote de Poda', 'Tesourão de Poda', 'Caminhão Cesto Aéreo',
        'Triturador de Galhos', 'Cordas e Roldanas (Rigging)'
    ],
    WASTE: [
        'Trituração para Compostagem (Interna)', 'Aterro Sanitário Licenciado',
        'Doação para Biomassa', 'Pátio de Resíduos Orgânicos', 'Outro'
    ]
};

// --- ESTADO DA APLICAÇÃO ---
let state = {
    container: null,
    config: null,
    view: 'LIST', // LIST, FORM, DOCUMENT
    selectedTree: null,
    plan: null,
    mapInstance: null,
    savedPlans: [], // Planos salvos do usuário
    isLoadingPlans: false
};

// --- UTILITÁRIOS ---
const $ = (selector) => state.container ? state.container.querySelector(selector) : null;
const $$ = (selector) => state.container ? state.container.querySelectorAll(selector) : [];

function showToast(message, type = 'info') {
    // Usar o utils.showToast se disponível, senão criar um toast simples
    if (window.utils && window.utils.showToast) {
        window.utils.showToast(message, type);
    } else {
        // Fallback: criar um toast simples
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// --- FUNÇÕES DE SAVE/LOAD ---
async function saveCurrentPlan() {
    if (!state.plan) {
        showToast('Nenhum plano para salvar', 'warning');
        return;
    }

    if (!state.config.apiService) {
        showToast('Serviço de API não disponível', 'error');
        return;
    }

    // Verificar se usuário está autenticado
    try {
        const user = await state.config.apiService.getUser();
        if (!user) {
            showToast('É necessário fazer login para salvar planos', 'warning');
            return;
        }
    } catch (error) {
        showToast('Erro de autenticação', 'error');
        return;
    }

    try {
        // Verificar se já existe plano para esta árvore
        const existingResult = await state.config.apiService.checkExistingPlan(state.plan.treeId);
        if (existingResult.error && existingResult.error.code !== 'PGRST116') {
            throw existingResult.error;
        }

        const existingPlan = existingResult.data;
        if (existingPlan && existingPlan.id !== state.plan.id) {
            if (!confirm('Já existe um plano salvo para esta árvore. Deseja sobrescrever?')) {
                return;
            }
        }

        // Salvar no servidor
        const result = await state.config.apiService.savePlan(state.plan);
        if (result.error) throw result.error;

        // Atualizar lista local
        await loadSavedPlans();

        showToast('✅ Plano salvo com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao salvar plano:', error);
        showToast('❌ Erro ao salvar plano: ' + (error.message || 'Erro desconhecido'), 'error');
    }
}

async function loadSavedPlans() {
    if (!state.config.apiService) {
        showToast('Serviço de API não disponível', 'error');
        return;
    }

    // Verificar se usuário está autenticado
    try {
        const user = await state.config.apiService.getUser();
        if (!user) {
            showToast('É necessário fazer login para carregar planos', 'warning');
            return;
        }
    } catch (error) {
        showToast('Erro de autenticação', 'error');
        return;
    }

    state.isLoadingPlans = true;
    await render(); // Mostrar loading

    try {
        const result = await state.config.apiService.getUserPlans();
        if (result.error) throw result.error;

        state.savedPlans = result.data;

        // Salvar localmente para sincronização
        localStorage.setItem('syncedPlans', JSON.stringify(state.savedPlans));

    } catch (error) {
        console.error('Erro ao carregar planos:', error);
        showToast('❌ Erro ao carregar planos', 'error');
    } finally {
        state.isLoadingPlans = false;
        await render();
    }
}

async function loadPlan(planId) {
    if (!state.config.apiService) {
        showToast('Serviço de API não disponível', 'error');
        return;
    }

    try {
        const result = await state.config.apiService.getPlan(planId);
        if (result.error) throw result.error;

        const planData = result.data;

        // Encontrar árvore relacionada
        const treeData = state.config.trees.find(t => t.id == planData.treeId);

        if (!treeData) {
            showToast('❌ Árvore relacionada ao plano não encontrada', 'error');
            return;
        }

        // Transformar dados da árvore para formato do módulo, incluindo dados do plano
        const tree = {
            id: treeData.id,
            species: treeData.species,
            location: treeData.location,
            riskLevel: treeData.riskLevel || 'Não Avaliado',
            residualRisk: treeData.residualRisk || treeData.riskLevel,
            failureProb: planData.failureProb || treeData.failureProb || '-',
            targetType: planData.targetType || treeData.targetType || '-',
            mitigation: treeData.mitigation || 'nenhuma',
            riskFactorsCode: treeData.riskFactorsCode ? treeData.riskFactorsCode.split(',') : '',
            defects: treeData.defects || [],
            riskScore: treeData.riskScore,
            date: treeData.date,
            dap: treeData.dap,
            height: treeData.height,
            suggestedIntervention: treeData.mitigation,
            image: treeData.image || null,
            displayId: treeData.displayId || 1,
            // Coordenadas para renderização do mapa
            coordX: treeData.coordX,
            coordY: treeData.coordY,
            utmZoneNum: treeData.utmZoneNum,
            utmZoneLetter: treeData.utmZoneLetter
        };

        state.selectedTree = tree;
        state.plan = planData;

        state.view = 'DOCUMENT';
        render();
        showToast('✅ Plano carregado!', 'success');

    } catch (error) {
        console.error('Erro ao carregar plano:', error);
        showToast('❌ Erro ao carregar plano', 'error');
    }
}

async function deletePlan(planId) {
    if (!state.config.apiService) {
        showToast('Serviço de API não disponível', 'error');
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const result = await state.config.apiService.deletePlan(planId);
        if (result.error) throw result.error;

        // Remover da lista local
        state.savedPlans = state.savedPlans.filter(p => p.id !== planId);
        localStorage.setItem('syncedPlans', JSON.stringify(state.savedPlans));

        await render();
        showToast('✅ Plano excluído!', 'success');

    } catch (error) {
        console.error('Erro ao excluir plano:', error);
        showToast('❌ Erro ao excluir plano', 'error');
    }
}

function showPlansModal() {
    const modal = $('#plans-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.zIndex = '10000';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
    }
}

function hidePlansModal() {
    const modal = $('#plans-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function clearLocalPlans() {
    localStorage.removeItem('syncedPlans');
    state.savedPlans = [];
}

// Carregar plano por ID da árvore
async function loadPlanByTreeId(treeId) {
    if (!state.config.apiService) {
        showToast('Serviço de API não disponível', 'error');
        return;
    }

    try {
        // Verificar se usuário está autenticado
        const user = await state.config.apiService.getUser();
        if (!user) {
            showToast('É necessário fazer login para carregar planos', 'warning');
            return;
        }

        // Procurar plano na lista local primeiro
        let plan = state.savedPlans.find(p => p.treeId === treeId);

        if (!plan) {
            // Se não encontrou localmente, buscar no servidor
            const result = await state.config.apiService.checkExistingPlan(treeId);
            if (result.error) throw result.error;
            if (!result.data) {
                showToast('Nenhum plano encontrado para esta árvore', 'warning');
                return;
            }

            // Carregar o plano completo
            const planResult = await state.config.apiService.getPlan(result.data.id);
            if (planResult.error) throw planResult.error;
            plan = planResult.data;
        }

        // Transformar dados da árvore para formato do módulo, incluindo dados do plano
        const treeData = state.config.trees.find(t => t.id == plan.treeId);

        if (!treeData) {
            showToast('❌ Árvore relacionada ao plano não encontrada', 'error');
            return;
        }

        const tree = {
            id: treeData.id,
            species: treeData.species,
            location: treeData.location,
            riskLevel: treeData.riskLevel || 'Não Avaliado',
            residualRisk: treeData.residualRisk || treeData.riskLevel,
            failureProb: plan.failureProb || treeData.failureProb || '-',
            targetType: plan.targetType || treeData.targetType || '-',
            mitigation: treeData.mitigation || 'nenhuma',
            riskFactorsCode: treeData.riskFactorsCode ? treeData.riskFactorsCode.split(',') : '',
            defects: treeData.defects || [],
            riskScore: treeData.riskScore,
            date: treeData.date,
            dap: treeData.dap,
            height: treeData.height,
            suggestedIntervention: treeData.mitigation,
            image: treeData.image || null,
            displayId: treeData.displayId || 1,
            // Coordenadas para renderização do mapa
            coordX: treeData.coordX,
            coordY: treeData.coordY,
            utmZoneNum: treeData.utmZoneNum,
            utmZoneLetter: treeData.utmZoneLetter
        };

        state.selectedTree = tree;
        state.plan = plan;
        state.view = 'DOCUMENT';
        await render();
        showToast('✅ Plano carregado!', 'success');

    } catch (error) {
        console.error('Erro ao carregar plano por árvore:', error);
        showToast('❌ Erro ao carregar plano', 'error');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function generateId() {
    const STORAGE_KEY = 'arboria_pi_sequence';
    const currentYear = new Date().getFullYear();
    const lastSeq = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    const nextSeq = lastSeq + 1;
    localStorage.setItem(STORAGE_KEY, nextSeq.toString());
    return `PI-${currentYear}-${String(nextSeq).padStart(3, '0')}`;
}

function convertToLatLon(tree) {
    if (tree.coordX === 'N/A' || tree.coordY === 'N/A' || !tree.coordX || !tree.coordY) return null;
    if (typeof window.proj4 === 'undefined') {

        return null;
    }

    const e = parseFloat(tree.coordX);
    const n = parseFloat(tree.coordY);
    const zn = tree.utmZoneNum || 23;
    const hemi = '+south';
    const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;

    try {
        const ll = window.proj4(def, "EPSG:4326", [e, n]);
        return [ll[1], ll[0]]; // Return as [lat, lng]
    } catch (e) {

        return null;
    }
}

// --- TEMPLATES ---

async function renderTreeList(trees) {
    // Adicionando espaçamento superior apenas
    const navHeader = `
        <div style="padding: 1rem 1rem 0 1rem;"></div>
    `;

    if (!trees || trees.length === 0) {
        return `
            ${navHeader}
            <div style="text-align: center; padding: 2rem;">
                <h3>Nenhuma árvore encontrada</h3>
                <p class="text-muted">Aguardando dados do Levantamento de Dados.</p>
            </div>
        `;
    }

    // [MODIFICATION-SEQ-ID] Add a sequential display ID
    const treesWithDisplayId = trees.map((tree, index) => ({
        ...tree,
        displayId: index + 1
    }));

    // Verificar planos salvos para cada árvore
    const treesWithPlans = await Promise.all(treesWithDisplayId.map(async (tree) => {
        let hasSavedPlan = false;
        if (state.config.apiService) {
            try {
                const result = await state.config.apiService.checkExistingPlan(tree.id);
                hasSavedPlan = result.data !== null;
            } catch (error) {
                console.warn('Erro ao verificar plano para árvore:', tree.id, error);
            }
        }
        return { ...tree, hasSavedPlan };
    }));

    const cards = treesWithPlans.map(tree => {
        const riskClass = (tree.riskLevel || '').includes('Alto') ? 'risk-high' : (tree.riskLevel || '').includes('Médio') ? 'risk-medium' : 'risk-low';
        const riskFactorsCount = tree.riskFactorsCode ? tree.riskFactorsCode.split(',').filter(x => x === '1').length : 0;

        // Só mostrar o botão se existir plano salvo
        const planButton = tree.hasSavedPlan ? `
            <button type="button" class="btn btn-sm btn-icon-only btn-plan-intervencion" data-id="${tree.id}" title="Ver Plano Salvo">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clipboard"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            </button>` : '';

        return `
        <div class="tree-card" data-id="${tree.id}" data-display-id="${tree.displayId}">
            <div class="tree-card-img">
                <img src="${tree.image || 'img/icons/favicon.png'}"
                     onerror="this.src='img/icons/favicon.png'">
                <div class="tree-card-risk-badge ${riskClass}">
                    ${tree.riskLevel}
                </div>
            </div>
            <div class="tree-card-info">
                <div class="tree-card-header">
                    <h3>${tree.species}</h3>
                    <span class="tree-card-id">ID: ${tree.displayId}</span>
                </div>
                <div class="tree-card-meta">
                    <span>
                        ${tree.location}
                    </span>
                    <span>
                        ${formatDate(tree.date)}
                    </span>
                </div>
                <div class="tree-card-details">
                    <span class="tree-card-details-item">DAP: <strong>${tree.dap}cm</strong></span>
                    <span class="tree-card-details-item">Alt: <strong>${tree.height}m</strong></span>
                    <span class="tree-card-details-item">${riskFactorsCount} Fatores de Risco</span>
                </div>
                <div class="tree-card-actions">
                    ${planButton}
                </div>
            </div>
        </div>`;
    }).join('');

    return `
            ${navHeader}
            <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
                ${cards}
            </div>
        `;
}

function renderForm(tree) {
    const isHighRisk = (tree.riskLevel || '').includes('Alto') || (tree.riskLevel || '').includes('Extremo');
    const riskIndicatorClass = isHighRisk ? 'risk-indicator-high' : 'risk-indicator-low'; // Simplified, could expand

    // Logic Mapping: TRAQ Suggestion -> Select Option
    let defaultIntervention = 'Monitoramento';
    const mit = (tree.mitigation || '').toLowerCase();

    if (mit.includes('supressao')) defaultIntervention = 'Supressão (Corte)';
    else if (mit.includes('poda')) defaultIntervention = 'Poda';
    else if (mit.includes('isolamento')) defaultIntervention = 'Monitoramento';

    const today = new Date().toISOString().split('T')[0];
    const preSelectedTools = [];
    if (parseFloat(tree.dap) > 15) preSelectedTools.push('Motosserra (Sabre > 30cm)');
    if (parseFloat(tree.height) > 4) preSelectedTools.push('Motopoda (Haste telescópica)');

    const renderChecks = (list, name, preSelected = []) => list.map(item => `
        <label class="checkbox-group">
            <input type="checkbox" name="${name}" value="${item}" ${preSelected.includes(item) ? 'checked' : ''}>
            <span>${item}</span>
        </label>
    `).join('');

    return `
        <div style="padding: 1rem;">
            <div id="back-btn-container" style="display: flex; margin-bottom: 1rem;">
                <button type="button" id="btn-back" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 8px;">
                    ❮ Voltar à Lista
                </button>
            </div>
            <form id="planning-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- DIAGNOSTIC SECTION -->
                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">⚠️</span>
                         <h3>Diagnóstico TRAQ #${tree.displayId}</h3>
                    </div>
                    
                    <div class="planning-diagnostic-grid">
                        <div class="planning-risk-indicator ${riskIndicatorClass}">
                            <small>Risco Atual</small>
                            <strong>${tree.riskLevel}</strong>
                        </div>
                        <div class="planning-risk-indicator risk-indicator-projected">
                            <small>Risco Projetado</small>
                            <strong>${tree.residualRisk || '-'}</strong>
                        </div>
                    </div>

                    <div class="planning-details-box">
                        <div class="planning-details-row">
                            <strong>Falha Provável:</strong> <span>${tree.failureProb}</span>
                        </div>
                        <div class="planning-details-row">
                            <strong>Alvo:</strong> <span>${tree.targetType}</span>
                        </div>
                         <div class="planning-details-row">
                            <strong>Recomendação:</strong> <span>${tree.mitigation || 'Não especificada'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- CAMPOS TRAQ OCULTOS PARA EDIÇÃO -->
                <div style="display: none;">
                    <input type="hidden" id="failure-prob" name="failureProb" value="${tree.failureProb || ''}">
                    <input type="hidden" id="target-type" name="targetType" value="${tree.targetType || ''}">
                </div>

                <!-- INTERVENTION DEFINITION -->
                <div class="planning-box green">
                    <div class="planning-box-header">
                        <span class="icon">🎯</span>
                         <h3>1. Definição da Intervenção</h3>
                    </div>
                    <div class="form-grid">
                         <div class="form-group">
                             <label for="interventionType">Tipo de Intervenção</label>
                             <select name="interventionType" id="interventionType" class="form-control">
                                <option value="Poda" ${defaultIntervention === 'Poda' ? 'selected' : ''}>Poda</option>
                                <option value="Supressão (Corte)" ${defaultIntervention === 'Supressão (Corte)' ? 'selected' : ''}>Supressão (Corte)</option>
                                <option value="Monitoramento" ${defaultIntervention === 'Monitoramento' ? 'selected' : ''}>Monitoramento</option>
                            </select>
                        </div>
                        <div id="techniques-container" class="form-group" style="${defaultIntervention !== 'Poda' ? 'display: none;' : ''}">
                             <label>Técnicas de Poda</label>
                            <div class="checkbox-container">
                                ${renderChecks(['Limpeza', 'Elevação', 'Redução', 'Correção'], 'techniques')}
                            </div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="justification">Justificativa Técnica</label>
                        <textarea name="justification" id="justification" required class="form-control" rows="3">${tree.mitigation ? `Intervenção recomendada para redução de risco (TRAQ). Alvo: ${tree.targetType}.` : ''}</textarea>
                    </div>
                </div>

                <!-- RESOURCES & SMS -->
                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">👷</span>
                        <h3>2. Recursos e SMS</h3>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Ferramentas</label>
                            <div class="checkbox-container-box">
                                ${renderChecks(CONSTANTS.TOOLS, 'tools', preSelectedTools)}
                            </div>
                            <input type="text" name="toolsJustification" placeholder="Outras..." class="form-control mt-2">
                        </div>
                         <div class="form-group">
                            <label>EPIs Obrigatórios</label>
                            <div class="checkbox-container-box">
                                ${renderChecks(CONSTANTS.EPIS, 'epis', CONSTANTS.EPIS.slice(0, 6))}
                            </div>
                            <input type="text" name="episJustification" placeholder="Outros..." class="form-control mt-2">
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem; border-top: 1px solid var(--color-border); padding-top: 1.5rem;">
                        <label style="margin-bottom: 0.5rem; display: block; font-weight: 600;">Equipe de Campo</label>
                        <div class="planning-team-grid">
                            <div class="form-group">
                                <label for="foremen">Encarregados</label>
                                <input type="number" id="foremen" name="foremen" value="1" min="0" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="chainsawOperators">Operadores</label>
                                <input type="number" id="chainsawOperators" name="chainsawOperators" value="1" min="0" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="auxiliaries">Auxiliares</label>
                                <input type="number" id="auxiliaries" name="auxiliaries" value="2" min="0" class="form-control">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PREVIEW BOX -->
                <div class="planning-box green">
                     <div class="planning-box-header">
                        <span class="icon">📜</span>
                        <h3>Procedimento Padrão (Pré-visualização)</h3>
                    </div>
                    <div class="planning-preview-box">
                        <p style="margin-bottom: 0.5rem; font-weight: 600;">O procedimento abaixo será incluído automaticamente no relatório.</p>
                        <div id="procedure-preview">Selecione o tipo de intervenção acima.</div>
                    </div>
                </div>

                <!-- SCHEDULE -->
                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">⏱️</span> 
                        <h3>3. Cronograma Operacional</h3>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="startDate">Data de Início</label>
                            <input type="date" id="startDate" name="startDate" value="${today}" required class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Mobilização (dias)</label>
                            <input type="number" id="dur_mob" name="durationMobilization" value="1" min="0" class="form-control duration-input">
                        </div>
                        <div class="form-group">
                            <label>Execução (dias)</label>
                            <input type="number" id="dur_exec" name="durationExecution" value="1" min="0" class="form-control duration-input">
                        </div>
                        <div class="form-group">
                             <label>Desmobilização (dias)</label>
                            <input type="number" id="dur_demob" name="durationDemobilization" value="1" min="0" class="form-control duration-input">
                        </div>
                        <div class="form-group">
                            <label for="endDate">Previsão de Término</label>
                            <input type="date" id="endDate" name="endDate" value="${today}" readonly class="form-control" style="background-color: var(--color-bg-body); cursor: not-allowed;">
                        </div>
                    </div>
                </div>

                <!-- CLOSING -->
                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">🏁</span>
                        <h3>4. Encerramento</h3>
                    </div>
                    <div class="form-group">
                        <label for="wasteSelect">Destinação de Resíduos</label>
                        <select name="wasteDestination" id="wasteSelect" class="form-control">
                            ${CONSTANTS.WASTE.map(w => `<option value="${w}">${w}</option>`).join('')}
                        </select>
                        <input type="text" id="customWaste" name="customWaste" placeholder="Especifique..." class="form-control mt-2" style="display: none;">
                    </div>
                    <div class="form-grid mt-4">
                        <div class="form-group">
                            <label for="responsible">Responsável Técnico</label>
                            <input type="text" id="responsible" name="responsible" value="${state.config.currentUser}" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="responsibleTitle">Cargo</label>
                            <input type="text" id="responsibleTitle" name="responsibleTitle" value="Engenheiro Responsável" class="form-control">
                        </div>
                    </div>
                    <div class="form-group mt-4">
                        <label for="executionInstructions">Orientações de Execução</label>
                        <textarea id="executionInstructions" name="executionInstructions" placeholder="Instruções adicionais..." class="form-control" rows="2"></textarea>
                    </div>
                </div>

                <div class="risk-buttons-area">
                    <button type="button" id="btn-cancel" class="btn btn-secondary">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Gerar Plano de Intervenção</button>
                </div>
            </form>
        </div>
    `;
}

// Helper: Gera o procedimento baseado no tipo de intervenção (Manual Técnico)
function getOperationalSteps(type, techniques = []) {
    // Passos comuns (Segurança e Preparo)
    const safetySteps = [
        'Isolamento da área (Raio: Altura da árvore + 50%) e sinalização.',
        'Verificação prévia de fauna (ninhos/colmeias) e redes elétricas.',
        'Definição de rotas de fuga e posicionamento da equipe em solo.'
    ];

    let specificSteps = [];

    if (type.includes('Supressão') || type.includes('Corte')) {
        // Procedimento de Supressão (Baseado no Manual)
        specificSteps = [
            'Realizar limpeza da base do tronco.',
            'Executar entalhe direcional (boca) entre 45° e 70° na direção de queda.',
            'Executar corte de abate (trás) 5cm acima da base do entalhe.',
            'Manter filete de ruptura (dobradiça) para controle da queda.',
            'Realizar o traçamento do tronco no solo.'
        ];
    } else {
        // Procedimento de Poda (Baseado no Manual)
        const techStr = techniques.length ? `(${techniques.join(', ')})` : '';
        specificSteps = [
            `Identificar galhos alvo conforme objetivo da poda ${techStr}.`,
            'Realizar o corte final rente ao colar, sem ferir a crista da casca.',
            'Utilizar a técnica de três cortes para galhos pesados (evitar lascamento).',
            'Não utilizar esporas para escalada (exceto em remoção total).'
        ];
    }

    // Passos finais
    const finalSteps = [
        'Trituração/Destinação adequada dos resíduos (Biomassa).',
        'Limpeza final da área e desmobilização.'
    ];

    return [...safetySteps, ...specificSteps, ...finalSteps];
}

/**
 * [REFACTOR] Generates the pure HTML content for the intervention plan document.
 * This is now decoupled from the view's wrapper and buttons.
 * @param {object} plan - The plan object.
 * @param {object} tree - The tree object.
 * @param {string} idSuffix - Suffix for element IDs to avoid collisions (e.g., "-print").
 */
function getPlanoDocumentHTML(plan, tree, idSuffix = '') {
    const start = new Date(plan.schedule.startDate);
    const end = new Date(plan.schedule.endDate);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

    const countTeam = (parseInt(plan.teamComposition?.foremen) || 0) +
        (parseInt(plan.teamComposition?.chainsawOperators) || 0) +
        (parseInt(plan.teamComposition?.auxiliaries) || 0);
    const steps = getOperationalSteps(plan.interventionType, plan.techniques);

    let activeRisks = [];
    if (tree.riskFactorsCode) {
        const codes = typeof tree.riskFactorsCode === 'string' ? tree.riskFactorsCode.split(',') : tree.riskFactorsCode;
        activeRisks = codes.map((v, i) => (v == '1' || v === 1) ? RISK_LABELS[i] : null).filter(Boolean);
    }
    const riskListHTML = activeRisks.length > 0
        ? `<ul class="compact-list" style="columns: 2; -webkit-columns: 2; color: #d32f2f;">${activeRisks.map(r => `<li>• ${r}</li>`).join('')}</ul>`
        : `<span style="color: #2e7d32; font-style: italic;">Nenhum fator crítico visualmente identificado.</span>`;

    const size = "220px";
    const photoHTML = tree.image
        ? `<img src="${tree.image}" style="width: ${size}; height: ${size}; object-fit: cover; border-radius: 4px; border: 1px solid #ccc; display: block; margin: 0 auto;" crossorigin="anonymous">`
        : `<div style="width: ${size}; height: ${size}; background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.8rem; border:1px solid #ccc; border-radius:4px; margin: 0 auto;">Sem Foto</div>`;

    // Gerar conteúdo estático do mapa
    const coords = convertToLatLon(tree);
    const staticMapHTML = coords ? `
        <div style="width: ${size}; height: ${size}; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; margin: 0 auto; text-align: center; color: #666;">
            <div style="font-size: 24px; margin-bottom: 10px;">📍</div>
            <div style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Localização</div>
            <div style="font-size: 10px; margin-bottom: 5px;">${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</div>
            <div style="font-size: 10px; color: ${tree.riskLevel.includes('Alto') ? '#d32f2f' : tree.riskLevel.includes('Médio') ? '#f57c00' : '#388e3c'};">
                ${tree.riskLevel}
            </div>
        </div>
    ` : `
        <div style="width: ${size}; height: ${size}; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border: 1px solid #ccc; border-radius: 4px; margin: 0 auto; text-align: center; color: #999; font-size: 0.8rem;">
            Coordenadas não disponíveis
        </div>
    `;

    return `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; border-bottom: 4px solid; border-image: var(--arb-gradient) 1;">
            <div style="padding-bottom: 5px;">
                <h1 style="font-size: 2.2rem; font-weight: 800; letter-spacing: -1px; line-height: 1;">
                    <span style="color: var(--arb-blue);">Arbor</span><span style="color: var(--arb-green);">IA</span>
                </h1>
                <div style="font-size: 0.8rem; color: #666;">Sistema de Manejo Integrado</div>
            </div>
            <div style="text-align: right; padding-bottom: 8px;">
                <div style="font-size: 1.1rem; font-weight: bold; color: #333;">PI-${plan.id.split('-').slice(1).join('-')}</div>
                <div style="font-size: 0.8rem; color: #666;">Expedição: ${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
        </div>

        <div class="arb-card">
            <div class="arb-card-header" style="border-color: var(--arb-blue);">
                <span>📍</span> Identificação e Diagnóstico
            </div>
            <div class="arb-card-body">
                <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 0.9rem;">
                    <div><strong>Espécie:</strong> ${tree.species} <small>(#${tree.displayId})</small></div>
                    <div><strong>Dimensões:</strong> DAP ${tree.dap}cm / Alt ${tree.height}m</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 15px; text-align: center;">
                    <div style="background: #f5f5f5; border-radius: 4px; padding: 5px;"><div style="font-size: 0.65rem; color: #666; text-transform: uppercase;">Prob. Falha</div><div style="font-weight: bold;">${tree.failureProb}</div></div>
                    <div style="background: #f5f5f5; border-radius: 4px; padding: 5px;"><div style="font-size: 0.65rem; color: #666; text-transform: uppercase;">Alvo</div><div style="font-weight: bold;">${tree.targetType}</div></div>
                    <div style="background: ${tree.riskLevel.includes('Alto') ? '#ffebee' : '#f1f8e9'}; border-radius: 4px; padding: 5px; border: 1px solid ${tree.riskLevel.includes('Alto') ? '#ef9a9a' : '#c5e1a5'};"><div style="font-size: 0.65rem; color: #666; text-transform: uppercase;">Risco Inicial</div><div style="font-weight: 800; color: ${tree.riskLevel.includes('Alto') ? '#c62828' : '#2e7d32'};">${tree.riskLevel}</div></div>
                </div>
                <div style="margin-bottom: 15px;"><strong style="font-size: 0.75rem; color: #555; text-transform: uppercase;">Fatores de Risco:</strong><div style="font-size: 0.8rem; margin-top: 2px; color: #d32f2f;">${riskListHTML}</div></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: start;">
                    <div style="text-align: center;">${photoHTML}<div style="font-size:0.7rem; color:#666; margin-top:4px;">Registro Fotográfico</div></div>
                    <div style="text-align: center;"><div id="planning-map-container${idSuffix}" style="width: ${size}; height: ${size}; background: #eee; border: 1px solid #ccc; border-radius: 4px; margin: 0 auto;">${staticMapHTML}</div><div style="font-size:0.7rem; color:#666; margin-top:4px;">Localização: ${tree.location}</div></div>
                </div>
            </div>
        </div>

    <div class="arb-card">
        <div class="arb-card-header" style="border-color: var(--arb-green);"><span>📅</span> Planejamento Operacional</div>
        <div class="arb-card-body">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9rem;">
                <div><strong>${plan.interventionType}</strong> <span style="color:#666; font-size:0.8rem;">(${plan.justification})</span></div>
                <div>Duração: <strong>${diffDays} dias</strong></div>
            </div>
            <div id="gantt-chart${idSuffix}"></div>
        </div>
    </div>

    <div class="arb-card">
        <div class="arb-card-header" style="border-color: #ffa000;"><span>🛠️</span> Recursos e Procedimentos</div>
        <div class="arb-card-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <div style="font-size: 0.75rem; font-weight: bold; color: var(--arb-blue); margin-bottom: 4px;">EQUIPE & RECURSOS</div>
                    <ul class="compact-list" style="color:#444;">
                        <li><strong>Equipe:</strong> ${countTeam} profissionais</li>
                        <li><strong>Ferramentas:</strong> ${plan.tools.join(', ')}</li>
                        <li><strong>EPIs:</strong> ${plan.epis.slice(0, 3).join(', ')}...</li>
                    </ul>
                </div>
                <div style="border-left: 1px solid #eee; padding-left: 15px;">
                    <div style="font-size: 0.75rem; font-weight: bold; color: var(--arb-green); margin-bottom: 4px;">PROCEDIMENTO (${plan.interventionType.toUpperCase()})</div>
                    <ol class="compact-list" style="color:#333;">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
                </div>
            </div>
        </div>
    </div>

    <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
            <div>
                <div style="border-bottom: 1px solid #333; margin-bottom: 4px; width: 80%; margin: 0 auto 4px auto;"></div>
                <strong style="font-size: 0.8rem;">${plan.responsible}</strong><br>
                <span style="font-size: 0.7rem; color: #666;">Engenheiro Responsável</span>
            </div>
            <div>
                <div style="border-bottom: 1px solid #333; margin-bottom: 4px; width: 80%; margin: 0 auto 4px auto;"></div>
                <strong style="font-size: 0.8rem;">Segurança do Trabalho</strong><br>
                <span style="font-size: 0.7rem; color: #666;">Liberação de Serviço</span>
            </div>
        </div>
    </div>
`;
}

/**
 * [NEW] Creates the full self-contained HTML for the print preview.
 */
function generatePlanoIntervencaoForPrinting(plan, tree) {
    const reportContent = getPlanoDocumentHTML(plan, tree, '-print');
    const styles = `
        :root {
            --arb-blue: #1565c0;
            --arb-green: #2e7d32;
            --arb-gradient: linear-gradient(90deg, #1565c0 0%, #2e7d32 100%);
            --arb-gray: #f8f9fa;
            --arb-border: #dee2e6;
        }
        body {
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
        }
        h1, h2, h3, h4 { margin: 0; }
        p { margin: 0 0 5px 0; }
        .arb-card {
            border: 1px solid var(--arb-border);
            border-radius: 6px;
            margin-bottom: 12px;
            overflow: hidden;
            display: block;
            box-sizing: border-box;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .arb-card-header {
            background: var(--arb-gray);
            padding: 6px 12px;
            border-bottom: 2px solid #e0e0e0;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            color: #555;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .arb-card-body { padding: 10px; }
        ul.compact-list, ol.compact-list {
            margin: 0;
            padding-left: 20px;
            font-size: 0.8rem;
            line-height: 1.3;
        }
        ul.compact-list li, ol.compact-list li { margin-bottom: 2px; }
        #gantt-chart, #gantt-chart-print { min-height: 100px; position: relative; }
        #planning-map-container, #planning-map-container-print {
             width: 220px;
             height: 220px;
             background: #eee;
             border: 1px solid #ccc;
             border-radius: 4px;
             margin: 0 auto;
        }
        .map-label-clean {
            background-color: transparent;
            border: none;
            box-shadow: none;
            color: white;
            font-weight: bold;
            font-size: 14px;
            text-shadow: 0 0 3px black;
        }
    `;

    const printHTML = `
        <html>
            <head>
                <title>Plano de Intervenção - ${plan.id}</title>
                <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" />
                <script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
                <style>${styles}</style>
            </head>
            <body>
                ${reportContent}
            </body>
        </html>
    `;
    return printHTML;
}

/**
 * [REFACTORED] Renders the document view, now acting as a simple wrapper for the printable content.
 */
function renderDocumentView(plan, tree) {
    const reportContent = getPlanoDocumentHTML(plan, tree, '');
    return `
        <div>
            <div class="risk-buttons-area no-print" style="padding: 15px; background: #fff; border-bottom: 1px solid #eee; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px;">
                    <button type="button" id="btn-back-edit" class="btn btn-secondary">✏️ Editar</button>
                    <button type="button" id="btn-save-plan" class="btn btn-primary" style="background: #2196F3; border-color: #2196F3;">💾 Salvar Plano</button>
                    <button type="button" id="btn-load-plans" class="btn btn-outline">📂 Carregar Planos</button>
                    <button type="button" id="btn-new-plan" class="btn btn-outline">➕ Novo Plano</button>
                </div>
                <button type="button" id="btn-download-pdf" class="btn btn-primary" style="background: var(--arb-green); border-color: var(--arb-green);">🖨️ Gerar Relatório</button>
            </div>
            <div style="background: #555; padding: 20px; display: flex; justify-content: center;">
                <div id="printable-area">
                    ${reportContent}
                </div>
            </div>

            <!-- Modal para listar planos salvos -->
            <div id="plans-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee;">
                        <h3 style="margin: 0; color: #333;">📋 Planos Salvos</h3>
                        <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 15px; max-height: 400px; overflow-y: auto;">
                        ${state.isLoadingPlans ?
            '<div style="text-align: center; padding: 20px;">Carregando planos...</div>' :
            state.savedPlans.length === 0 ?
                '<div style="text-align: center; padding: 20px; color: #666;">Nenhum plano salvo encontrado.</div>' :
                `<div class="plans-list" style="display: flex; flex-direction: column; gap: 10px;">
                                    ${state.savedPlans.map(plan => {
                    const tree = state.config.trees.find(t => t.id == plan.treeId);
                    const treeName = tree ? `${tree.especie} - ${tree.local}` : `Árvore ID: ${plan.treeId}`;
                    const updatedDate = new Date(plan.updatedAt).toLocaleDateString('pt-BR');
                    return `
                                            <div class="plan-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #f9f9f9; cursor: pointer;" data-plan-id="${plan.id}">
                                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                                    <div style="flex: 1;">
                                                        <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${plan.interventionType}</div>
                                                        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">${treeName}</div>
                                                        <div style="font-size: 0.8rem; color: #999;">Atualizado em ${updatedDate}</div>
                                                    </div>
                                                    <div style="display: flex; gap: 5px;">
                                                        <button class="btn-load-plan" data-plan-id="${plan.id}" style="padding: 4px 8px; font-size: 0.8rem;">Carregar</button>
                                                        <button class="btn-delete-plan" data-plan-id="${plan.id}" style="padding: 4px 8px; font-size: 0.8rem; background: #f44336; color: white; border: none; border-radius: 4px;">Excluir</button>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                }).join('')}
                                </div>`
        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- CONTROLLER ---

const Actions = {
    initMap: (tree, containerId = 'planning-map-container') => {
        const coords = convertToLatLon(tree);
        console.log('initMap chamado com coords:', coords);

        // No contexto de impressão, o container sempre será no documento global
        const container = document.getElementById(containerId);
        console.log('Container do mapa encontrado:', !!container, 'Dimensões:', container ? [container.offsetWidth, container.offsetHeight] : 'N/A');

        if (!coords || !container) {
            console.error('Coordenadas ou container não disponíveis', { coords: !!coords, container: !!container });
            if (container) {
                container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: 1rem;">Dados insuficientes para mapa.</p>';
            }
            return;
        }

        console.log('Contexto normal detectado, tentando inicializar mapa dinâmico...');
        Actions.initializeMapInternal(container, tree, coords);
    },

    // Função para renderizar mapa estático (útil para impressão)
    renderStaticMap: (container, tree, coords) => {
        // Gera imagem estática do mapa (OpenStreetMap tiles)
        const zoom = 18;
        const width = 220;
        const height = 220;

        // Mapeia o nível de risco para as cores suportadas pelo serviço de mapa estático
        let markerColor;
        const riskLevel = tree.riskLevel || '';
        if (riskLevel.includes('Alto') || riskLevel.includes('Crítico')) {
            markerColor = 'red';
        } else if (riskLevel.includes('Médio')) {
            markerColor = 'blue'; // Usando azul como substituto para laranja/amarelo
        } else {
            markerColor = 'green';
        }

        // Usando um serviço de mapa estático público
        const mapUrl = `https://static-map.openstreetmap.de/staticmap.php?center=${coords[0]},${coords[1]}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&markers=${coords[0]},${coords[1]},${markerColor}-pushpin`;

        // Fallback para o caso de a API falhar
        const fallbackHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f0f0f0; border-radius: 4px; text-align: center; color: #666;">
                <div style="font-size: 24px; margin-bottom: 10px;">📍</div>
                <div style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Localização</div>
                <div style="font-size: 10px; margin-bottom: 5px;">${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</div>
                <div style="font-size: 10px; color: ${riskLevel.includes('Alto') ? '#d32f2f' : riskLevel.includes('Médio') ? '#f57c00' : '#388e3c'};">
                    ${tree.riskLevel}
                </div>
            </div>
        `;

        // Tenta carregar a imagem do mapa, se falhar, usa o fallback
        const img = new Image();
        img.src = mapUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.alt = 'Mapa de localização da árvore';
        img.onerror = () => {
            container.innerHTML = fallbackHTML;
        };
        img.onload = () => {
            container.innerHTML = ''; // Limpa o container antes de adicionar a imagem
            container.appendChild(img);
        };

        // Exibe o fallback imediatamente enquanto a imagem carrega
        container.innerHTML = fallbackHTML;
    },

    // Função auxiliar para inicializar o mapa
    initializeMapInternal: (container, tree, coords) => {
        // Verifica se estamos no modo de impressão ou se o container não está visível
        const isPrintMode = window.matchMedia && window.matchMedia('print').matches;
        const isContainerVisible = container && container.offsetParent !== null;

        if (isPrintMode || !isContainerVisible) {
            console.log('Modo de impressão ou container não visível detectado, renderizando mapa estático');
            // Força a renderização do mapa estático quando não visível
            Actions.renderStaticMap(container, tree, coords);
            return;
        }

        if (typeof window.maplibregl === 'undefined') {
            console.error('MapLibre GL JS not loaded, falling back to static map.');
            Actions.renderStaticMap(container, tree, coords);
            return;
        }

        // Remover mapa anterior se existir
        if (state.mapInstance) {
            state.mapInstance.remove();
            state.mapInstance = null;
        }

        const map = new window.maplibregl.Map({
            container: container,
            style: {
                version: 8,
                sources: {
                    'satellite': {
                        type: 'raster',
                        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                        tileSize: 256,
                        attribution: '© Google'
                    }
                },
                layers: [{
                    id: 'satellite-layer',
                    type: 'raster',
                    source: 'satellite',
                    minzoom: 0,
                    maxzoom: 20
                }]
            },
            center: [coords[1], coords[0]], // [lng, lat]
            zoom: 18,
            interactive: false // Disable all interactions
        });

        let color = (tree.riskLevel || '').includes('Alto') ? '#d32f2f' : (tree.riskLevel || '').includes('Médio') ? '#f57c00' : '#388e3c';
        const treeHeight = parseFloat(tree.height) || 5;

        map.on('load', () => {
            map.addSource('single-tree', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [coords[1], coords[0]]
                    },
                    properties: {
                        displayId: tree.displayId,
                        color: color,
                        radius: treeHeight
                    }
                }
            });

            map.addLayer({
                id: 'tree-circle',
                type: 'circle',
                source: 'single-tree',
                paint: {
                    'circle-radius': ['get', 'radius'],
                    'circle-color': ['get', 'color'],
                    'circle-opacity': 0.5,
                    'circle-stroke-color': ['get', 'color'],
                    'circle-stroke-width': 1
                }
            });

            // Adicionar tooltip
            new window.maplibregl.Popup({ closeButton: false, closeOnClick: false })
                .setLngLat([coords[1], coords[0]])
                .setHTML(tree.species || tree.displayId || '#')
                .addTo(map);

            state.mapInstance = map;

            if (treeHeight > 0) {
                // Fit bounds to the circle area (approximate)
                const bounds = new window.maplibregl.LngLatBounds()
                    .extend([coords[1] - 0.001, coords[0] - 0.001])
                    .extend([coords[1] + 0.001, coords[0] + 0.001]);
                map.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 40, right: 40 } });
            }

            // Garante que o mapa seja renderizado corretamente antes da impressão
            map.once('idle', () => {
                // O mapa está completamente carregado
                console.log('Mapa completamente carregado');
            });
        }); // Corrigido: fechamento do map.on
    },

    /**
     * [REFACTORED] Generates a print preview using the standard pipeline.
     */
    generatePDF: async () => {
        const btn = $('#btn-download-pdf');
        if (btn) {
            btn.originalText = btn.innerHTML;
            btn.innerHTML = 'Gerando...';
            btn.disabled = true;
        }

        try {
            const reportHTML = generatePlanoIntervencaoForPrinting(state.plan, state.selectedTree);

            const mapRenderCallback = () => {
                console.log('mapRenderCallback chamado'); // Debug
                // Tenta renderizar o mapa dinâmico e o Gantt chart
                const mapContainer = document.getElementById('planning-map-container-print');
                if (mapContainer) {
                    Actions.initMap(state.selectedTree, 'planning-map-container-print');
                }
                initGanttChart(state.plan, '#gantt-chart-print');

                // Força um pequeno atraso para garantir que os elementos sejam renderizados
                // antes da tentativa de impressão
                setTimeout(() => {
                    console.log('Pós-render timeout executado');
                }, 1000);
            };

            // This function is imported from utils.js and handles the print preview overlay
            openReportPreview(reportHTML, mapRenderCallback);

        } catch (err) {
            console.error("Erro ao gerar visualização de impressão:", err);
            alert("Erro ao preparar a visualização. Tente novamente.");
        } finally {
            if (btn) {
                btn.innerHTML = btn.originalText;
                btn.disabled = false;
            }
        }
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const techniques = [];
        $$('input[name="techniques"]:checked').forEach(c => techniques.push(c.value));

        const tools = [];
        $$('input[name="tools"]:checked').forEach(c => tools.push(c.value));

        const epis = [];
        $$('input[name="epis"]:checked').forEach(c => epis.push(c.value));

        const waste = formData.get('wasteDestination');
        const finalWaste = waste === 'Outro' ? formData.get('customWaste') : waste;

        state.plan = {
            id: generateId(),
            treeId: state.selectedTree.id,
            interventionType: formData.get('interventionType'),
            techniques: techniques,
            justification: formData.get('justification'),
            tools: tools,
            epis: epis,
            teamComposition: {
                foremen: formData.get('foremen'),
                chainsawOperators: formData.get('chainsawOperators'),
                auxiliaries: formData.get('auxiliaries')
            },
            schedule: {
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate')
            },
            durations: {
                mobilization: parseInt(formData.get('durationMobilization')),
                execution: parseInt(formData.get('durationExecution')),
                demobilization: parseInt(formData.get('durationDemobilization'))
            },
            responsible: formData.get('responsible'),
            responsibleTitle: formData.get('responsibleTitle'),
            wasteDestination: finalWaste,
            executionInstructions: formData.get('executionInstructions'),
            failureProb: state.selectedTree.failureProb,  // Incluindo campo de falha provável
            targetType: state.selectedTree.targetType     // Incluindo campo de alvo
        };

        state.view = 'DOCUMENT';
        await render();
    }
};

function bindEvents() {
    console.log('bindEvents called, view:', state.view);
    if (state.view === 'LIST') {
        console.log('Adding LIST event listeners');

        // Event delegation for tree cards
        state.container.addEventListener('click', async (e) => {
            const target = e.target;
            const card = target.closest('.tree-card');

            if (!card) return; // Exit if click is not within a card

            const planButton = target.closest('.btn-plan-intervencion');

            if (planButton) {
                // Handle specific button click for "Plano de Intervenção"
                const id = planButton.dataset.id;
                const displayId = card.dataset.displayId;

                // Carregar plano salvo diretamente
                loadPlanByTreeId(id).catch(error => {
                    console.error('Erro ao carregar plano:', error);
                    showToast('Erro ao carregar plano', 'error');
                });
            } else {
                // Handle general card click to open the form
                const id = card.dataset.id;
                const displayId = card.dataset.displayId;
                console.log('Card clicked, id:', id, 'displayId:', displayId, 'trees ids:', state.config.trees.map(t => t.id));
                state.selectedTree = state.config.trees.find(t => String(t.id) === String(id));
                console.log('selectedTree:', state.selectedTree);
                if (state.selectedTree) {
                    state.selectedTree.displayId = displayId;
                }
                state.view = 'FORM';
                render().catch(error => {
                    console.error('Erro ao renderizar:', error);
                });
            }
        });

    }

    if (state.view === 'FORM') {
        $('#btn-back').addEventListener('click', async () => { state.view = 'LIST'; await render(); });
        $('#btn-cancel').addEventListener('click', () => {
            if (state.config.onCancel) {
                state.config.onCancel();
            }
        });

        const selectIntervention = $('#interventionType');
        const techContainer = $('#techniques-container');
        if (selectIntervention) {
            selectIntervention.addEventListener('change', (e) => {
                if (e.target.value === 'Poda') {
                    techContainer.style.display = 'block';
                } else {
                    techContainer.style.display = 'none';
                }
            });
        }

        const wasteSelect = $('#wasteSelect');
        const customInput = $('#customWaste');
        if (wasteSelect) {
            wasteSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Outro') {
                    customInput.style.display = 'block';
                } else {
                    customInput.style.display = 'none';
                }
            });
        }

        $('#planning-form').addEventListener('submit', Actions.handleFormSubmit);

        // Lógica de Cálculo de Datas (Adicionar em bindEvents)
        const dateInputs = $$('#startDate, .duration-input');
        const endDateInput = $('#endDate');

        function calculateEndDate() {
            const startStr = $('#startDate').value;
            if (!startStr) return;

            const start = new Date(startStr);
            const daysMob = parseInt($('#dur_mob').value) || 0;
            const daysExec = parseInt($('#dur_exec').value) || 0;
            const daysDemob = parseInt($('#dur_demob').value) || 0;

            // Soma total de dias (subtrai 1 pois se começa hoje e dura 1 dia, termina hoje)
            const totalDays = daysMob + daysExec + daysDemob;

            // Clona a data para não alterar a original
            const end = new Date(start);
            end.setDate(end.getDate() + (totalDays > 0 ? totalDays - 1 : 0)); // Ajuste matemático de datas

            endDateInput.value = end.toISOString().split('T')[0];
        }

        // Attach listeners
        dateInputs.forEach(input => input.addEventListener('change', calculateEndDate));
        dateInputs.forEach(input => input.addEventListener('input', calculateEndDate)); // Para atualizar enquanto digita
        // Roda uma vez para inicializar
        calculateEndDate();

        // Lógica de Preview de Procedimento
        const interventionSelect = $('#interventionType');
        const techChecks = $$('input[name="techniques"]');
        const previewDiv = $('#procedure-preview');

        function updateProcedurePreview() {
            if (!interventionSelect || !previewDiv) return;

            const type = interventionSelect.value;
            const techs = [];
            $$('input[name="techniques"]:checked').forEach(c => techs.push(c.value));

            // Usa a mesma função helper criada anteriormente
            const steps = getOperationalSteps(type, techs);

            previewDiv.innerHTML = `<ol style="margin-left: 15px;">${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
        }

        if (interventionSelect) {
            interventionSelect.addEventListener('change', updateProcedurePreview);
            techChecks.forEach(ch => ch.addEventListener('change', updateProcedurePreview));
            // Inicializa
            updateProcedurePreview();
        }

        // Preencher campos do formulário com dados do plano existente, se houver
        if (state.plan) {
            // Preencher campos específicos do formulário com dados do plano existente
            const interventionType = $('#interventionType');
            if (interventionType && state.plan.interventionType) {
                interventionType.value = state.plan.interventionType;
                // Atualizar visibilidade do container de técnicas baseado no tipo de intervenção
                if (state.plan.interventionType === 'Poda') {
                    techContainer.style.display = 'block';
                } else {
                    techContainer.style.display = 'none';
                }
            }

            // Preencher campos TRAQ - Falha provável e Alvo
            const failureProbSelect = $('#failure-prob');
            if (failureProbSelect && state.plan.failureProb) {
                failureProbSelect.value = state.plan.failureProb;
            }

            const targetTypeSelect = $('#target-type');
            if (targetTypeSelect && state.plan.targetType) {
                targetTypeSelect.value = state.plan.targetType;
            }

            // Preencher técnicas de poda se for o tipo de intervenção
            if (state.plan.techniques && state.plan.techniques.length > 0) {
                state.plan.techniques.forEach(tech => {
                    const techCheck = $(`input[name="techniques"][value="${tech}"]`);
                    if (techCheck) techCheck.checked = true;
                });
            }

            // Preencher justificativa
            const justification = $('#justification');
            if (justification && state.plan.justification) {
                justification.value = state.plan.justification;
            }

            // Preencher ferramentas
            if (state.plan.tools && state.plan.tools.length > 0) {
                state.plan.tools.forEach(tool => {
                    const toolCheck = $(`input[name="tools"][value="${tool}"]`);
                    if (toolCheck) toolCheck.checked = true;
                });
            }

            // Preencher EPIs
            if (state.plan.epis && state.plan.epis.length > 0) {
                state.plan.epis.forEach(epi => {
                    const epiCheck = $(`input[name="epis"][value="${epi}"]`);
                    if (epiCheck) epiCheck.checked = true;
                });
            }

            // Preencher composição da equipe
            if (state.plan.teamComposition) {
                const foremen = $('#foremen');
                const chainsawOperators = $('#chainsawOperators');
                const auxiliaries = $('#auxiliaries');

                if (foremen && state.plan.teamComposition.foremen !== undefined) {
                    foremen.value = state.plan.teamComposition.foremen;
                }
                if (chainsawOperators && state.plan.teamComposition.chainsawOperators !== undefined) {
                    chainsawOperators.value = state.plan.teamComposition.chainsawOperators;
                }
                if (auxiliaries && state.plan.teamComposition.auxiliaries !== undefined) {
                    auxiliaries.value = state.plan.teamComposition.auxiliaries;
                }
            }

            // Preencher cronograma
            if (state.plan.schedule) {
                const startDate = $('#startDate');
                const endDate = $('#endDate');

                if (startDate && state.plan.schedule.startDate) {
                    startDate.value = state.plan.schedule.startDate;
                }
                if (endDate && state.plan.schedule.endDate) {
                    endDate.value = state.plan.schedule.endDate;
                }
            }

            if (state.plan.durations) {
                const durMob = $('#dur_mob');
                const durExec = $('#dur_exec');
                const durDemob = $('#dur_demob');

                if (durMob && state.plan.durations.mobilization !== undefined) {
                    durMob.value = state.plan.durations.mobilization;
                }
                if (durExec && state.plan.durations.execution !== undefined) {
                    durExec.value = state.plan.durations.execution;
                }
                if (durDemob && state.plan.durations.demobilization !== undefined) {
                    durDemob.value = state.plan.durations.demobilization;
                }

                // Recalcular data de término após preencher durações
                calculateEndDate();
            }

            // Preencher responsável técnico
            if (state.plan.responsible) {
                const responsible = $('#responsible');
                if (responsible) responsible.value = state.plan.responsible;
            }
            if (state.plan.responsibleTitle) {
                const responsibleTitle = $('#responsibleTitle');
                if (responsibleTitle) responsibleTitle.value = state.plan.responsibleTitle;
            }

            // Preencher destinação de resíduos
            if (state.plan.wasteDestination) {
                const wasteSelect = $('#wasteSelect');
                const customWaste = $('#customWaste');

                if (wasteSelect) {
                    if (CONSTANTS.WASTE.includes(state.plan.wasteDestination)) {
                        wasteSelect.value = state.plan.wasteDestination;
                        if (customWaste) {
                            customWaste.style.display = 'none';
                        }
                    } else {
                        // Se não for uma das opções padrão, assume que é um valor personalizado
                        wasteSelect.value = 'Outro';
                        if (customWaste) {
                            customWaste.style.display = 'block';
                            customWaste.value = state.plan.wasteDestination; // O valor personalizado
                        }
                    }
                }
            }

            // Preencher instruções de execução
            if (state.plan.executionInstructions) {
                const executionInstructions = $('#executionInstructions');
                if (executionInstructions) executionInstructions.value = state.plan.executionInstructions;
            }
            // Atualizar o estado da árvore com os dados de metodologia do plano, se disponíveis
            if (state.plan.failureProb) {
                state.selectedTree.failureProb = state.plan.failureProb;
            }

            if (state.plan.targetType) {
                state.selectedTree.targetType = state.plan.targetType;
            }
        }
    }


    if (state.view === 'DOCUMENT') {
        $('#btn-back-edit').addEventListener('click', async () => { state.view = 'FORM'; await render(); });
        $('#btn-download-pdf').addEventListener('click', Actions.generatePDF);

        // Novos botões de save/load
        $('#btn-save-plan')?.addEventListener('click', saveCurrentPlan);
        $('#btn-load-plans')?.addEventListener('click', () => {
            loadSavedPlans().then(() => showPlansModal());
        });
        $('#btn-new-plan')?.addEventListener('click', () => {
            if (confirm('Criar um novo plano? As alterações não salvas serão perdidas.')) {
                state.plan = null;
                state.view = 'FORM';
                (async () => {
                    await render();
                })();
            }
        });

        // Modal handlers
        $('.modal-close')?.addEventListener('click', hidePlansModal);
        $('#plans-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'plans-modal') {
                hidePlansModal();
            }
        });

        // Plan item handlers (usando event delegation)
        $('#plans-modal')?.addEventListener('click', (e) => {
            const loadBtn = e.target.closest('.btn-load-plan');
            const deleteBtn = e.target.closest('.btn-delete-plan');

            if (loadBtn) {
                const planId = loadBtn.dataset.planId;
                hidePlansModal();
                loadPlan(planId);
            } else if (deleteBtn) {
                const planId = deleteBtn.dataset.planId;
                deletePlan(planId);
            }
        });

        // This logic now runs inside the print preview, triggered by a callback.
        // It's kept here to ensure the map on the non-print view still works.
        requestAnimationFrame(() => {
            Actions.initMap(state.selectedTree);
            initGanttChart(state.plan);
        });
    }
}

/**
 * Inicializa o Gráfico de Gantt Customizado (Vanilla JS / CSS Puro).
 * SUBSTITUIÇÃO TOTAL: Não depende de bibliotecas externas (Frappe/JSGantt).
 */
function initGanttChart(plan, containerSelector = '#gantt-chart') {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    // Limpa e define estilo base
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = '100%';

    // --- Lógica de Datas (Simplificada para Visualização) ---
    // Vamos criar um grid visual de 100% de largura representando o período total

    // Calcula duração total em dias
    const durMob = plan.durations?.mobilization || 0;
    const durExec = plan.durations?.execution || 0;
    const durDemob = plan.durations?.demobilization || 0;
    const totalDays = durMob + durExec + durDemob;

    // Se totalDays for 0, evita divisão por zero
    const safeTotal = totalDays || 1;

    // Gera HTML das barras usando Porcentagem (Mais seguro que pixels para PDF)
    const createBar = (label, days, color, offsetDays) => {
        const widthPct = (days / safeTotal) * 100;
        const leftPct = (offsetDays / safeTotal) * 100;

        return `<div style="
        position: relative;
        height: 25px;
        margin-bottom: 5px;
        background: #f5f5f5;
        border-radius: 4px;
        overflow: hidden;">
            <div style="
                position: absolute;
                left: ${leftPct}%;
                width: ${widthPct}%;
                height: 100%;
                background: var(${color});
                display: flex;
                align-items: center;
                padding-left: 8px;
                color: white;
                font-size: 0.7rem;
                font-weight: bold;
                white-space: nowrap;">
                ${label} (${days}d)
            </div>
    </div>`;
    };

    let html = '';
    let currentOffset = 0;

    if (durMob > 0) {
        html += createBar('Mobilização', durMob, '--arb-blue', currentOffset);
        currentOffset += durMob;
    }
    if (durExec > 0) {
        html += createBar('Execução', durExec, '--arb-green', currentOffset);
        currentOffset += durExec;
    }
    if (durDemob > 0) {
        html += createBar('Desmob.', durDemob, '--arb-blue', currentOffset);
    }

    // Adiciona uma régua de dias simples abaixo
    let ruler = '';
    if (totalDays > 0) {
        ruler = '<div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid #ccc; padding-top: 2px;">';
        for (let i = 0; i < totalDays; i++) {
            if (i % 2 === 0 || totalDays <= 10) { // Mostra todos os dias se totalDays <= 10, senão mostra a cada 2 dias
                ruler += `<div style="font-size: 0.6rem; color: #888;">D${i + 1}</div>`;
            }
        }
        ruler += '</div>';
    }

    container.innerHTML = html + ruler;
}

// Redesenha ao redimensionar a tela para manter alinhamento
window.addEventListener('resize', () => {
    if (state.plan && state.view === 'DOCUMENT') {
        initGanttChart(state.plan, '#gantt-chart');
    }
});
async function render() {
    if (!state.container) return;
    state.container.innerHTML = '';
    let content = '';

    console.log('PlanningModule render: view', state.view, 'selectedTree', state.selectedTree);

    if (state.view === 'LIST') content = await renderTreeList(state.config.trees);
    else if (state.view === 'FORM' && state.selectedTree) content = renderForm(state.selectedTree);
    else if (state.view === 'DOCUMENT' && state.selectedTree) content = renderDocumentView(state.plan, state.selectedTree);
    else {
        // Fallback para LIST se FORM ou DOCUMENT sem selectedTree
        content = await renderTreeList(state.config.trees);
        state.view = 'LIST';
    }

    state.container.innerHTML = content;
    bindEvents();
}

// --- API PÚBLICA ---
export const PlanningModule = {
    mount: async (containerId, config, initialTreeId = null) => {
        const el = document.getElementById(containerId);
        if (!el) {

            return;
        }
        state.container = el;
        state.config = config;

        // Carregar planos sincronizados do localStorage
        const syncedPlans = localStorage.getItem('syncedPlans');
        if (syncedPlans) {
            try {
                state.savedPlans = JSON.parse(syncedPlans);
            } catch (error) {
                console.error('Erro ao carregar planos sincronizados:', error);
                state.savedPlans = [];
            }
        }

        if (initialTreeId) {
            state.selectedTree = state.config.trees.find(t => String(t.id) === String(initialTreeId));
            console.log('PlanningModule mount: initialTreeId', initialTreeId, 'selectedTree', state.selectedTree, 'trees ids:', state.config.trees.map(t => t.id));
            if (state.selectedTree) {
                state.view = 'FORM';
            } else {
                console.warn('Árvore não encontrada para ID:', initialTreeId);
                state.view = 'LIST';
            }
        } else {
            state.view = 'LIST';
        }
        await render();

    },

    /**
     * Carrega um plano existente por ID para edição
     * @param {string} planId - ID do plano a carregar
     */
    loadPlanById: async (planId) => {
        console.log('[PlanningModule] 📝 Carregando plano para edição:', planId);

        if (!state.config || !state.config.apiService) {
            showToast('ApiService não está disponível', 'error');
            return false;
        }

        try {
            // 1. Carregar o plano do banco
            const planResult = await state.config.apiService.getPlan(planId);
            if (!planResult.data) {
                showToast('Plano não encontrado', 'error');
                return false;
            }

            const planData = planResult.data;
            console.log('[PlanningModule] Plano carregado:', planData);

            // 2. Carregar dados da árvore associada
            const treeResult = await state.config.apiService.getTree(planData.treeId);
            if (!treeResult.data) {
                showToast('Árvore associada não encontrada', 'error');
                return false;
            }

            const treeData = treeResult.data;
            console.log('[PlanningModule] Árvore carregada:', treeData);

            // 3. Transformar dados da árvore para formato do módulo
            // Atualizar os dados da árvore com os dados do plano carregado, se disponíveis
            const tree = {
                id: treeData.id,
                species: treeData.especie,
                location: treeData.local,
                riskLevel: treeData.riskLevel || 'Não Avaliado',
                residualRisk: treeData.residualRisk || treeData.riskLevel,
                failureProb: planData.failureProb || treeData.failureProb || '-', // Priorizar dados do plano se disponíveis
                targetType: planData.targetType || treeData.targetType || '-', // Priorizar dados do plano se disponíveis
                mitigation: treeData.mitigation || 'nenhuma',
                riskFactorsCode: treeData.riskFactors ? treeData.riskFactors.join(',') : '',
                defects: treeData.observacoes ? [treeData.observacoes] : [],
                riskScore: treeData.pontuacao,
                date: treeData.data,
                dap: treeData.dap,
                height: treeData.altura,
                suggestedIntervention: treeData.mitigation,
                image: treeData.photoUrl || null,
                // Coordenadas para renderização do mapa
                coordX: treeData.coordX,
                coordY: treeData.coordY,
                utmZoneNum: treeData.utmZoneNum,
                utmZoneLetter: treeData.utmZoneLetter
            };

            // 4. Atualizar estado com árvore e plano
            state.selectedTree = tree;

            // 5. Transformar dados do plano para formato do módulo
            state.plan = {
                id: planData.id,
                treeId: planData.treeId,
                interventionType: planData.interventionType,
                techniques: planData.techniques || [],
                justification: planData.justification || '',
                tools: planData.tools || [],
                epis: planData.epis || [],
                teamComposition: planData.teamComposition || {},
                schedule: planData.schedule || {},
                durations: planData.durations || {},
                responsible: planData.responsible || '',
                responsibleTitle: planData.responsibleTitle || '',
                wasteDestination: planData.wasteDestination || '',
                executionInstructions: planData.executionInstructions || '',
                failureProb: planData.failureProb,  // Incluindo campo de falha provável
                targetType: planData.targetType     // Incluindo campo de alvo
            };

            console.log('[PlanningModule] Estado atualizado com plano:', state.plan);

            // 6. Mudar para view de formulário
            state.view = 'FORM';
            await render();

            showToast('Plano carregado para edição', 'success');
            return true;

        } catch (error) {
            console.error('[PlanningModule] Erro ao carregar plano:', error);
            showToast('Erro ao carregar plano: ' + error.message, 'error');
            return false;
        }
    },

    unmount: () => {
        if (state.container) state.container.innerHTML = '';
        state = { container: null, config: null, view: 'LIST', selectedTree: null, plan: null, mapInstance: null, savedPlans: [], isLoadingPlans: false };
    }
};
