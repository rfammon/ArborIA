/**
 * ARBORIA - Módulo de Planejamento (ESM Edition)
 * Versão: 2.2 (Refactored to ES Module)
 */
import { RISK_LABELS } from './constants.js';

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
    mapInstance: null
};

// --- UTILITÁRIOS ---
const $ = (selector) => state.container ? state.container.querySelector(selector) : null;
const $$ = (selector) => state.container ? state.container.querySelectorAll(selector) : [];

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

function renderTreeList(trees) {
// Navigation Buttons (Added via update script)
    const navHeader = `
        <div style="padding: 1rem 1rem 0 1rem;">
            <div class="risk-buttons-area" style="display: flex; gap: 10px; margin-bottom: 5px;">
                <button id="btn-nav-table" class="btn btn-primary" style="flex: 1; font-size: 0.85rem; padding: 10px;">
                    <span style="margin-right:5px;">📋</span> Tabela (Resumo)
                </button>
                <button id="btn-nav-calc" class="btn btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 10px;">
                    <span style="margin-right:5px;">🔙</span> Voltar ao Cadastro
                </button>
            </div>
        </div>
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

const cards = treesWithDisplayId.map(tree => {
    const riskClass = (tree.riskLevel || '').includes('Alto') ? 'risk-high' : (tree.riskLevel || '').includes('Médio') ? 'risk-medium' : 'risk-low';
    const riskFactorsCount = tree.riskFactorsCode ? tree.riskFactorsCode.split(',').filter(x => x === '1').length : 0;

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
                <button type="button" class="btn btn-sm btn-icon-only btn-plan-intervencion" data-id="${tree.id}" title="Plano de Intervenção">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clipboard"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                </button>
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
    
    // Lógica de Mapeamento: Sugestão TRAQ -> Opção do Select
    let defaultIntervention = 'Monitoramento';
    const mit = (tree.mitigation || '').toLowerCase();
    
    if (mit.includes('supressao')) defaultIntervention = 'Supressão (Corte)';
    else if (mit.includes('poda')) defaultIntervention = 'Poda';
    else if (mit.includes('isolamento')) defaultIntervention = 'Monitoramento'; // Isolamento geralmente implica monitorar
    
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
                <button type="button" id="btn-back" class="btn-back" style="display: inline-flex; align-items: center; gap: 8px;">
                    Voltar à Lista
                </button>
            </div>
            <form id="planning-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">⚠️</span>
                        <h3>Diagnóstico TRAQ (ID: ${tree.displayId})</h3>
                    </div>
                    <div style="background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: var(--radius-md);">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div style="text-align:center; padding: 10px; background: ${isHighRisk ? '#ffebee' : '#f1f8e9'}; border-radius: 6px;">
                                <small style="display:block; color: #666;">Risco Atual</small>
                                <strong style="font-size: 1.2rem; color: ${isHighRisk ? '#d32f2f' : '#2e7d32'};">${tree.riskLevel}</strong>
                            </div>
                            <div style="text-align:center; padding: 10px; background: #e3f2fd; border-radius: 6px;">
                                <small style="display:block; color: #666;">Risco Projetado</small>
                                <strong style="font-size: 1.2rem; color: #1565c0;">${tree.residualRisk || '-'}</strong>
                            </div>
                        </div>
                        <div style="font-size: 0.9rem; color: #555; border-top: 1px solid #eee; padding-top: 10px;">
                            <p style="margin:0;"><strong>Falha Provável:</strong> ${tree.failureProb}</p>
                            <p style="margin:5px 0 0 0;"><strong>Alvo:</strong> ${tree.targetType}</p>
                            <p style="margin:5px 0 0 0;"><strong>Recomendação:</strong> ${tree.mitigation || 'Não especificada'}</p>
                        </div>
                    </div>
                </div>

                <div class="planning-box green">
                    <div class="planning-box-header">
                        <span class="icon">🎯</span>
                        <h3>1. Definição da Intervenção</h3>
                    </div>
                    <div class="form-grid">
                        <div>
                            <label for="interventionType">Tipo de Intervenção</label>
                            <select name="interventionType" id="interventionType">
                                <option value="Poda" ${defaultIntervention === 'Poda' ? 'selected' : ''}>Poda</option>
                                <option value="Supressão (Corte)" ${defaultIntervention === 'Supressão (Corte)' ? 'selected' : ''}>Supressão (Corte)</option>
                                <option value="Monitoramento" ${defaultIntervention === 'Monitoramento' ? 'selected' : ''}>Monitoramento</option>
                            </select>
                        </div>
                        <div id="techniques-container" style="${defaultIntervention !== 'Poda' ? 'display: none;' : ''}">
                            <label>Técnicas de Poda</label>
                            <div class="checkbox-container">
                                ${renderChecks(['Limpeza', 'Elevação', 'Redução', 'Correção'], 'techniques')}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 1.5rem;">
                        <label for="justification">Justificativa Técnica</label>
                        <textarea name="justification" id="justification" required>${tree.mitigation ? `Intervenção recomendada para redução de risco (TRAQ). Alvo: ${tree.targetType}.` : ''}</textarea>
                    </div>
                </div>

                <div class="planning-box">
                    <div class="planning-box-header"><span class="icon">👷</span><h3>2. Recursos e SMS</h3></div>
                    <div class="form-grid">
                        <div><label>Ferramentas</label><div class="checkbox-container-box">${renderChecks(CONSTANTS.TOOLS, 'tools', preSelectedTools)}</div><input type="text" name="toolsJustification" placeholder="Outras..." style="margin-top: 1rem;"></div>
                        <div><label>EPIs Obrigatórios</label><div class="checkbox-container-box">${renderChecks(CONSTANTS.EPIS, 'epis', CONSTANTS.EPIS.slice(0, 6))}</div><input type="text" name="episJustification" placeholder="Outros..." style="margin-top: 1rem;"></div>
                    </div>
                    <div style="margin-top: 1.5rem; border-top: 1px solid #eee; padding-top: 1.5rem;"><label style="margin-bottom: 0.5rem; display: block;">Equipe de Campo</label><div class="form-grid" style="grid-template-columns: repeat(3, 1fr); gap: 1rem;"><div><label for="foremen" style="font-size: 0.8rem; color: #666;">Encarregados</label><input type="number" id="foremen" name="foremen" value="1" min="0" class="team-input" style="width: 100%;"></div><div><label for="chainsawOperators" style="font-size: 0.8rem; color: #666;">Operadores</label><input type="number" id="chainsawOperators" name="chainsawOperators" value="1" min="0" class="team-input" style="width: 100%;"></div><div><label for="auxiliaries" style="font-size: 0.8rem; color: #666;">Auxiliares</label><input type="number" id="auxiliaries" name="auxiliaries" value="2" min="0" class="team-input" style="width: 100%;"></div></div></div>
                </div>
                <div class="planning-box" style="background: #f1f8e9; border: 1px solid #c5e1a5;"><div class="planning-box-header"><span class="icon">📜</span><h3>Procedimento Padrão (Pré-visualização)</h3></div><div style="padding: 1rem;"><p style="font-size: 0.9rem; color: #558b2f; margin-bottom: 0.5rem;">O procedimento abaixo será incluído automaticamente no relatório.</p><div id="procedure-preview" style="font-size: 0.85rem; background: #fff; padding: 10px; border-radius: 4px; border: 1px dashed #aaa;">Selecione o tipo de intervenção acima.</div></div></div>
                <div class="planning-box"><div class="planning-box-header"><span class="icon">⏱️</span><h3>3. Cronograma Operacional</h3></div><div class="form-grid"><div><label for="startDate">Data de Início</label><input type="date" id="startDate" name="startDate" value="${today}" required></div><div><label>Mobilização (dias)</label><input type="number" id="dur_mob" name="durationMobilization" value="1" min="0" class="duration-input"></div><div><label>Execução (dias)</label><input type="number" id="dur_exec" name="durationExecution" value="1" min="0" class="duration-input"></div><div><label>Desmobilização (dias)</label><input type="number" id="dur_demob" name="durationDemobilization" value="1" min="0" class="duration-input"></div><div><label for="endDate">Previsão de Término</label><input type="date" id="endDate" name="endDate" value="${today}" readonly style="background-color: #f5f5f5; cursor: not-allowed;"></div></div></div>
                <div class="planning-box"><div class="planning-box-header"><span class="icon">🏁</span><h3>4. Encerramento</h3></div><div><label for="wasteSelect">Destinação de Resíduos</label><select name="wasteDestination" id="wasteSelect">${CONSTANTS.WASTE.map(w => `<option value="${w}">${w}</option>`).join('')}</select><input type="text" id="customWaste" name="customWaste" placeholder="Especifique..." style="display: none; margin-top: 1rem;"></div><div class="form-grid" style="margin-top: 1.5rem;"><div><label for="responsible">Responsável Técnico</label><input type="text" id="responsible" name="responsible" value="${state.config.currentUser}"></div><div><label for="responsibleTitle">Cargo</label><input type="text" id="responsibleTitle" name="responsibleTitle" value="Engenheiro Responsável"></div></div><div style="margin-top: 1.5rem;"><label for="executionInstructions">Orientações de Execução</label><textarea id="executionInstructions" name="executionInstructions" placeholder="Instruções adicionais..."></textarea></div></div>
                <div class="risk-buttons-area" style="justify-content: flex-end; padding: 0 1rem 1rem 1rem;"><button type="button" id="btn-cancel" class="btn btn-clear">Cancelar</button><button type="submit" class="btn btn-primary">Gerar Plano de Intervenção</button></div>
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
 */
function getPlanoDocumentHTML(plan, tree) {
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
                    <div style="text-align: center;"><div id="planning-map-container" style="width: ${size}; height: ${size}; background: #eee; border: 1px solid #ccc; border-radius: 4px; margin: 0 auto;"></div><div style="font-size:0.7rem; color:#666; margin-top:4px;">Localização: ${tree.location}</div></div>
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
                <div id="gantt-chart"></div>
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
                            <li><strong>EPIs:</strong> ${plan.epis.slice(0,3).join(', ')}...</li>
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
    const reportContent = getPlanoDocumentHTML(plan, tree);
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
        #gantt-chart { min-height: 100px; position: relative; }
        #planning-map-container {
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
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
    const reportContent = getPlanoDocumentHTML(plan, tree);
    return `
        <div>
            <div class="risk-buttons-area no-print" style="padding: 15px; background: #fff; border-bottom: 1px solid #eee; margin-bottom: 20px; display: flex; justify-content: space-between;">
                <button type="button" id="btn-back-edit" class="btn btn-secondary">Editar</button>
                <button type="button" id="btn-download-pdf" class="btn btn-primary" style="background: var(--arb-green); border-color: var(--arb-green);">Gerar Relatório para Impressão</button>
            </div>
            <div style="background: #555; padding: 20px; display: flex; justify-content: center;">
                <div id="printable-area">
                    ${reportContent}
                </div>
            </div>
        </div>
    `;
}

// --- CONTROLLER ---

const Actions = {
    initMap: (tree) => {
        const coords = convertToLatLon(tree);
        const container = $('#planning-map-container');
        if (!container) return;

        if (!window.L || !coords) {
            container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: 1rem;">Coordenadas inválidas.</p>';
            return;
        }

        if (state.mapInstance) {
            state.mapInstance.remove();
            state.mapInstance = null;
        }

        const map = window.L.map(container, {
            center: coords,
            zoom: 18,
            attributionControl: false,
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            preferCanvas: true
        });

        window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Esri',
            maxZoom: 20,
            maxNativeZoom: 19
        }).addTo(map);

        let color = (tree.riskLevel || '').includes('Alto') ? '#d32f2f' : (tree.riskLevel || '').includes('Médio') ? '#f57c00' : '#388e3c';
        const treeHeight = parseFloat(tree.height) || 5;
        
        const circle = L.circle(coords, {
            color: color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.5,
            radius: treeHeight,
        }).bindTooltip(`${tree.displayId}`, {
            permanent: true,
            direction: 'center',
            className: 'map-label-clean'
        }).addTo(map);

        state.mapInstance = map;

        if (treeHeight > 0) {
            map.fitBounds(circle.getBounds(), { padding: [40, 40] });
        }
        
        setTimeout(() => map.invalidateSize(), 100);
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
                Actions.initMap(state.selectedTree);
                // Also initialize Gantt chart in the preview
                initGanttChart(state.plan);
            };
            
            // This function is imported from utils.js and handles the print preview overlay
            window.openReportPreview(reportHTML, mapRenderCallback);

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

    handleFormSubmit: (e) => {
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
            executionInstructions: formData.get('executionInstructions')
        };

        state.view = 'DOCUMENT';
        render();
    }
};

function bindEvents() {
    if (state.view === 'LIST') {
        // Event delegation for tree cards
        state.container.addEventListener('click', (e) => {
            const target = e.target;
            const card = target.closest('.tree-card');

            if (!card) return; // Exit if click is not within a card

            const planButton = target.closest('.btn-plan-intervencion');

            if (planButton) {
                // Handle specific button click for "Plano de Intervenção"
                const id = parseInt(planButton.dataset.id, 10);
                if (state.config.onNavigateToPlanningForm) {
                    state.config.onNavigateToPlanningForm(id);
                }
            } else {
                // Handle general card click to open the form
                const id = parseInt(card.dataset.id, 10);
                const displayId = card.dataset.displayId;
                state.selectedTree = state.config.trees.find(t => t.id === id);
                if (state.selectedTree) {
                    state.selectedTree.displayId = displayId;
                }
                state.view = 'FORM';
                render();
            }
        });
    }

    if (state.view === 'FORM') {
        $('#btn-back').addEventListener('click', () => { state.view = 'LIST'; render(); });
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
    }

    if (state.view === 'DOCUMENT') {
        $('#btn-back-edit').addEventListener('click', () => { state.view = 'FORM'; render(); });
        $('#btn-download-pdf').addEventListener('click', Actions.generatePDF);
        
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
function initGanttChart(plan) {
const container = document.querySelector('#gantt-chart');
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
let ruler = '<div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid #ccc; padding-top: 2px;">';
for(let i=0; i < totalDays; i++) {
    ruler += `<div style="font-size: 0.6rem; color: #888;">D${i+1}</div>`;
}
ruler += '</div>';

container.innerHTML = html + ruler;
}

// Redesenha ao redimensionar a tela para manter alinhamento
window.addEventListener('resize', () => {
if (state.plan && state.view === 'DOCUMENT') {
    initGanttChart(state.plan);
}
});
function render() {
    if (!state.container) return;
    state.container.innerHTML = '';
    let content = '';

    if (state.view === 'LIST') content = renderTreeList(state.config.trees);
    else if (state.view === 'FORM') content = renderForm(state.selectedTree);
    else if (state.view === 'DOCUMENT') content = renderDocumentView(state.plan, state.selectedTree);

    state.container.innerHTML = content;
    bindEvents();
}

// --- API PÚBLICA ---
export const PlanningModule = {
    mount: (containerId, config, initialTreeId = null) => {
        const el = document.getElementById(containerId);
        if (!el) {
            
            return;
        }
        state.container = el;
        state.config = config;
        
        if (initialTreeId) {
            state.selectedTree = state.config.trees.find(t => t.id === initialTreeId);
            if (state.selectedTree) {
                state.view = 'FORM';
            } else {
                
                state.view = 'LIST';
            }
        } else {
            state.view = 'LIST';
        }
        render();
        
    },
    unmount: () => {
        if (state.container) state.container.innerHTML = '';
        state = { container: null, config: null, view: 'LIST', selectedTree: null, plan: null, mapInstance: null };
    }
};
