/**
 * ARBORIA - Módulo de Planejamento (Vanilla JS Edition)
 * Versão: 2.1 (Clean & Integrated)
 */

(function (window) {
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
            console.error("proj4 library not found.");
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
            console.error("Coordinate conversion failed:", e);
            return null;
        }
    }

    // --- TEMPLATES ---

    function renderTreeList(trees) {
    if (!trees || trees.length === 0) {
        return `
            <div style="text-align: center; padding: 2rem;">
                <h3>Nenhuma árvore encontrada</h3>
                <p class="text-muted">Aguardando dados do Levantamento de Dados.</p>
            </div>
        `;
    }

    const cards = trees.map(tree => {
        const riskClass = (tree.riskLevel || '').includes('Alto') ? 'risk-high' : (tree.riskLevel || '').includes('Médio') ? 'risk-medium' : 'risk-low';
        const riskFactorsCount = tree.riskFactorsCode ? tree.riskFactorsCode.split(',').filter(x => x === '1').length : 0;

        return `
        <div class="tree-card" data-id="${tree.id}">
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
                    <span class="tree-card-id">ID: ${tree.id}</span>
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
        <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
            ${cards}
        </div>
    `;
}

    function renderForm(tree) {
    const isHighRisk = (tree.riskLevel || '').includes('Alto');
    const defaultIntervention = isHighRisk ? 'Supressão (Corte)' : 'Poda';
    const today = new Date().toISOString().split('T')[0];

    const preSelectedTools = [];
    if (tree.dap > 15) preSelectedTools.push('Motosserra (Sabre > 30cm)');
    if (tree.height > 4) preSelectedTools.push('Motopoda (Haste telescópica)');
    
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Voltar à Lista
                </button>
            </div>
            <form id="planning-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">⚠️</span>
                        <h3>Avaliação de Risco: ${tree.species} (ID: ${tree.id})</h3>
                    </div>
                    <div style="background: ${isHighRisk ? 'var(--risk-high)' : 'var(--risk-medium)'}; padding: 1rem; border-radius: var(--radius-md); color: white;">
                        <h4 style="font-weight: bold; margin: 0;">
                            Nível de Risco: ${tree.riskLevel} (Pontuação: ${tree.riskScore})
                        </h4>
                        <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">
                            <strong>Observações:</strong> ${tree.defects && tree.defects.length ? tree.defects.join(', ') : 'Nenhuma.'}
                        </p>
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
                                <option value="Supressão (Corte)" ${defaultIntervention !== 'Poda' ? 'selected' : ''}>Supressão (Corte)</option>
                                <option value="Monitoramento">Monitoramento</option>
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
                        <textarea name="justification" id="justification" required placeholder="Descreva o motivo da intervenção..."></textarea>
                    </div>
                </div>

                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">👷</span>
                        <h3>2. Recursos e SMS</h3>
                    </div>
                    <div class="form-grid">
                        <div>
                            <label>Ferramentas</label>
                            <div class="checkbox-container-box">
                                ${renderChecks(CONSTANTS.TOOLS, 'tools', preSelectedTools)}
                            </div>
                            <input type="text" name="toolsJustification" placeholder="Outras ferramentas..." style="margin-top: 1rem;">
                        </div>
                        <div>
                            <label>EPIs Obrigatórios</label>
                            <div class="checkbox-container-box">
                                ${renderChecks(CONSTANTS.EPIS, 'epis', CONSTANTS.EPIS.slice(0, 6))}
                            </div>
                            <input type="text" name="episJustification" placeholder="Outros EPIs..." style="margin-top: 1rem;">
                        </div>
                    </div>
                </div>

<div class="planning-box" style="background: #f1f8e9; border: 1px solid #c5e1a5;">
    <div class="planning-box-header">
        <span class="icon">📜</span>
        <h3>Procedimento Padrão (Pré-visualização)</h3>
    </div>
    <div style="padding: 1rem;">
        <p style="font-size: 0.9rem; color: #558b2f; margin-bottom: 0.5rem;">
            O procedimento abaixo será incluído automaticamente no relatório com base na sua seleção de intervenção (Poda/Supressão).
        </p>
        <div id="procedure-preview" style="font-size: 0.85rem; background: #fff; padding: 10px; border-radius: 4px; border: 1px dashed #aaa;">
            Selecione o tipo de intervenção acima para visualizar o passo-a-passo.
        </div>
    </div>
</div>

<div class="planning-box">
    <div class="planning-box-header">
        <span class="icon">⏱️</span>
        <h3>3. Cronograma Operacional</h3>
    </div>
    <div class="form-grid">
        <div>
            <label for="startDate">Data de Início</label>
            <input type="date" id="startDate" name="startDate" value="${today}" required>
        </div>
        
        <div>
            <label>Mobilização (dias)</label>
            <input type="number" id="dur_mob" name="durationMobilization" value="1" min="0" class="duration-input">
        </div>
        <div>
            <label>Execução (dias)</label>
            <input type="number" id="dur_exec" name="durationExecution" value="1" min="1" class="duration-input">
        </div>
        <div>
            <label>Desmobilização (dias)</label>
            <input type="number" id="dur_demob" name="durationDemobilization" value="1" min="0" class="duration-input">
        </div>

        <div>
            <label for="endDate">Previsão de Término</label>
            <input type="date" id="endDate" name="endDate" value="${today}" readonly style="background-color: #f5f5f5; cursor: not-allowed;">
        </div>
    </div>
</div>

                <div class="planning-box">
                    <div class="planning-box-header">
                        <span class="icon">🏁</span>
                        <h3>4. Encerramento</h3>
                    </div>
                    <div>
                        <label for="wasteSelect">Destinação de Resíduos</label>
                        <select name="wasteDestination" id="wasteSelect">
                            ${CONSTANTS.WASTE.map(w => `<option value="${w}">${w}</option>`).join('')}
                        </select>
                        <input type="text" id="customWaste" name="customWaste" placeholder="Especifique o destino..." style="display: none; margin-top: 1rem;">
                    </div>
                    <div class="form-grid" style="margin-top: 1.5rem;">
                        <div>
                            <label for="responsible">Responsável Técnico</label>
                            <input type="text" id="responsible" name="responsible" value="${state.config.currentUser}">
                        </div>
                        <div>
                            <label for="responsibleTitle">Cargo</label>
                            <input type="text" id="responsibleTitle" name="responsibleTitle" value="Engenheiro Responsável">
                        </div>
                    </div>
                    <div style="margin-top: 1.5rem;">
                        <label for="executionInstructions">Orientações de Execução</label>
                        <textarea id="executionInstructions" name="executionInstructions" placeholder="Instruções adicionais para a equipe de campo..."></textarea>
                    </div>
                </div>

                <div class="risk-buttons-area" style="justify-content: flex-end; padding: 0 1rem 1rem 1rem;">
                    <button type="button" id="btn-cancel" class="btn btn-clear">Cancelar</button>
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

function renderDocumentView(plan, tree) {
    const start = new Date(plan.schedule.startDate);
    const end = new Date(plan.schedule.endDate);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Lógica de Dados
    const countTeam = (parseInt(plan.teamComposition?.foremen) || 0) + 
                      (parseInt(plan.teamComposition?.chainsawOperators) || 0) + 
                      (parseInt(plan.teamComposition?.auxiliaries) || 0);
    const steps = getOperationalSteps(plan.interventionType, plan.techniques);

    // Imagem e Mapa (Altura Reduzida para 140px para caber na página)
    const imgHeight = "140px";
    const photoHTML = tree.image 
        ? `<img src="${tree.image}" style="width: 100%; height: ${imgHeight}; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" crossorigin="anonymous">`
        : `<div style="height:${imgHeight}; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.7rem; border:1px solid #ddd; border-radius:4px;">Sem Foto</div>`;

    return `
        <div>
            <div class="risk-buttons-area" style="padding: 15px; background: #fff; border-bottom: 1px solid #eee; margin-bottom: 20px; display: flex; justify-content: space-between;">
                <button type="button" id="btn-back-edit" class="btn btn-secondary">Editar</button>
                <button type="button" id="btn-download-pdf" class="btn btn-primary" style="background: var(--arb-green); border-color: var(--arb-green);">Baixar Relatório</button>
            </div>

            <div style="background: #555; padding: 20px; display: flex; justify-content: center;"> <div id="printable-area">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; border-bottom: 4px solid; border-image: var(--arb-gradient) 1;">
                        <div style="padding-bottom: 5px;">
                            <h1 style="font-size: 2.2rem; font-weight: 800; letter-spacing: -1px; line-height: 1;">
                                <span style="color: var(--arb-blue);">Arbor</span><span style="color: var(--arb-green);">IA</span>
                            </h1>
                            <div style="font-size: 0.8rem; color: #666; margin-left: 2px;">Sistema de Manejo Integrado</div>
                        </div>
                        <div style="text-align: right; padding-bottom: 8px;">
                            <div style="font-size: 1.1rem; font-weight: bold; color: #333;">PI-${plan.id.split('-').slice(1).join('-')}</div>
                            <div style="font-size: 0.8rem; color: #666;">Expedição: ${new Date().toLocaleDateString('pt-BR')}</div>
                        </div>
                    </div>

                    <div class="arb-card">
                        <div class="arb-card-header" style="border-color: var(--arb-blue);">
                            <span>📍</span> Identificação e Localização
                        </div>
                        <div class="arb-card-body">
                            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed #eee; font-size: 0.9rem;">
                                <div>
                                    <span style="color:#888; font-size:0.75rem; text-transform:uppercase;">Espécie / ID</span><br>
                                    <strong>${tree.species}</strong> <small>(#${tree.id})</small>
                                </div>
                                <div>
                                    <span style="color:#888; font-size:0.75rem; text-transform:uppercase;">Biometria</span><br>
                                    DAP: <strong>${tree.dap}cm</strong> • Alt: <strong>${tree.height}m</strong>
                                </div>
                                <div style="text-align: right;">
                                    <span style="color:#888; font-size:0.75rem; text-transform:uppercase;">Risco</span><br>
                                    <strong style="color:${tree.riskLevel.includes('Alto') ? '#d32f2f' : '#2e7d32'}">${tree.riskLevel}</strong>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>${photoHTML}</div>
                                <div id="map-container" style="width: 100%; height: ${imgHeight}; background: #eee; border: 1px solid #ddd; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 0.8rem; color: #666; margin-top: 5px;"><strong>Local:</strong> ${tree.location}</div>
                        </div>
                    </div>

                    <div class="arb-card">
                        <div class="arb-card-header" style="border-color: var(--arb-green);">
                            <span>📅</span> Planejamento Operacional
                        </div>
                        <div class="arb-card-body" style="padding-bottom: 5px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9rem;">
                                <div>
                                    <strong>${plan.interventionType}</strong> 
                                    <span style="color:#666; font-size: 0.85rem;"> — ${plan.justification}</span>
                                </div>
                                <div>
                                    Duração Estimada: <strong>${diffDays} dias</strong>
                                </div>
                            </div>
                            <div id="gantt-chart"></div>
                        </div>
                    </div>

                    <div class="arb-card">
                        <div class="arb-card-header" style="border-color: #ffa000;"> <span>🛠️</span> Recursos e Procedimentos
                        </div>
                        <div class="arb-card-body">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div>
                                    <h4 style="font-size: 0.8rem; color: var(--arb-blue); margin-bottom: 5px; text-transform: uppercase;">Recursos Alocados</h4>
                                    <div style="font-size: 0.85rem; margin-bottom: 5px;"><strong>Equipe:</strong> ${countTeam} profissionais</div>
                                    
                                    <div style="font-size: 0.8rem; font-weight:bold; margin-top:8px;">Ferramentas:</div>
                                    <ul class="compact-list" style="color:#444;">${plan.tools.map(t => `<li>${t}</li>`).join('')}</ul>

                                    <div style="font-size: 0.8rem; font-weight:bold; margin-top:8px;">EPIs Principais:</div>
                                    <ul class="compact-list" style="color:#444;">
                                        ${plan.epis.slice(0, 4).map(e => `<li>${e}</li>`).join('')}
                                        ${plan.epis.length > 4 ? `<li style="font-style:italic;">+ ${plan.epis.length - 4} itens</li>` : ''}
                                    </ul>
                                </div>

                                <div style="border-left: 1px solid #eee; padding-left: 15px;">
                                    <h4 style="font-size: 0.8rem; color: var(--arb-green); margin-bottom: 5px; text-transform: uppercase;">Procedimento (${plan.interventionType})</h4>
                                    <ol class="compact-list" style="color:#333;">
                                        ${steps.map(s => `<li style="margin-bottom: 3px;">${s}</li>`).join('')}
                                    </ol>
                                    ${plan.executionInstructions ? `
                                    <div style="margin-top: 10px; padding: 8px; background: #fff3e0; border: 1px solid #ffe0b2; border-radius: 4px; font-size: 0.75rem;">
                                        <strong>Nota de Campo:</strong> ${plan.executionInstructions}
                                    </div>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
                            <div>
                                <div style="border-bottom: 1px solid #333; margin-bottom: 5px; width: 80%; margin-left: auto; margin-right: auto;"></div>
                                <strong style="font-size: 0.9rem;">${plan.responsible}</strong><br>
                                <span style="font-size: 0.75rem; color: #666;">Engenheiro Responsável</span>
                            </div>
                            <div>
                                <div style="border-bottom: 1px solid #333; margin-bottom: 5px; width: 80%; margin-left: auto; margin-right: auto;"></div>
                                <strong style="font-size: 0.9rem;">Segurança do Trabalho</strong><br>
                                <span style="font-size: 0.75rem; color: #666;">Liberação de Serviço</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;
}
    // --- CONTROLLER ---

    const Actions = {
        initMap: (tree) => {
            const coords = convertToLatLon(tree);
            if (!window.L || !coords) {
                console.error("Cannot initialize map: Missing Leaflet or invalid coordinates for conversion.");
                const container = $('#map-container');
                if (container) {
                    container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: 1rem;">Coordenadas inválidas ou não especificadas.</p>';
                }
                return;
            }

            const container = $('#map-container');
            if (!container) return;

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

            let color;
            if ((tree.riskLevel || '').includes('Alto')) {
                color = '#d32f2f';
            } else if ((tree.riskLevel || '').includes('Médio')) {
                color = '#f57c00';
            } else {
                color = '#388e3c';
            }
            const treeHeight = parseFloat(tree.height);
            const radiusInMeters = (treeHeight > 0) ? treeHeight : 5;

            const circle = L.circle(coords, {
                color: color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.5,
                radius: radiusInMeters,
            });

            circle.bindTooltip(`${tree.id}`, {
                permanent: true,
                direction: 'center',
                className: 'map-label-clean'
            });

            circle.addTo(map);
            state.mapInstance = map;

            if (radiusInMeters > 0) {
                map.fitBounds(circle.getBounds(), { padding: [40, 40] });
            }
            
            map.invalidateSize();
        },

        generatePDF: async () => {
            const btn = $('#btn-download-pdf');
            if (btn) {
                btn.originalText = btn.innerHTML;
                btn.innerHTML = 'Processando...';
                btn.disabled = true;
            }

            try {
                const content = $('#printable-area');
                if (!content) throw new Error("Área de impressão não encontrada.");

                const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();   // ~210mm
                const pdfHeight = pdf.internal.pageSize.getHeight(); // ~297mm
                const margin = 12; // Margem padrão (ajustado de 10)
                const contentWidth = pdfWidth - (margin * 2);
                
                let cursorY = margin;

                // Seleciona os Blocos Lógicos (Header + Boxes)
                const blocks = Array.from(content.querySelectorAll('#printable-area > div'))
                                    .filter(el => el.offsetHeight > 0 && !el.classList.contains('risk-buttons-area'));

                for (const block of blocks) {
                    
                    // Se o bloco contém o mapa, dê um tempo extra para os tiles carregarem
                    if (block.querySelector('#map-container')) {
                        await new Promise(r => setTimeout(r, 500)); // Espera 500ms tiles
                    }

                    const canvas = await window.html2canvas(block, { 
                        scale: 2, 
                        backgroundColor: '#ffffff',
                        useCORS: true // Essencial para carregar tiles do mapa e fotos externas
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const imgHeight = (canvas.height * contentWidth) / canvas.width;

                    // Lógica Anti-Página-Branca
                    // Só quebra página se NÃO for o primeiro bloco E se não couber
                    if (cursorY > margin && (cursorY + imgHeight > pdfHeight - margin)) {
                        pdf.addPage();
                        cursorY = margin;
                    }

                    pdf.addImage(imgData, 'JPEG', margin, cursorY, contentWidth, imgHeight);
                    cursorY += imgHeight + 4; // Espaço menor entre blocos (ajustado de 5)
                }

                pdf.save(`${state.plan.id}_Plano.pdf`);

            } catch (err) {
                console.error("PDF Error:", err);
                alert("Erro ao gerar PDF.");
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
                    chainsawOperators: formData.get('operators'),
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
            $$('.tree-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Check if the click originated from the "Plano de Intervenção" button
                    if (e.target.closest('.btn-plan-intervencion')) {
                        const id = e.target.closest('.btn-plan-intervencion').dataset.id;
                        if (state.config.onNavigateToPlanningForm) {
                            state.config.onNavigateToPlanningForm(parseInt(id, 10));
                        }
                        return; // Prevent normal card click behavior
                    }
                    const id = parseInt(card.dataset.id, 10);
                    state.selectedTree = state.config.trees.find(t => t.id === id);
                    state.view = 'FORM';
                    render();
                });
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
            
            // Função de polling para garantir que o mapa carregue
            let attempts = 0;
            function checkAndInitMap() {
                const container = $('#map-container');
                
                // Verifica se o container existe E tem altura definida (CSS inline que colocamos)
                if (container && container.offsetHeight > 0) {
                    
                    // 1. Inicializa o Mapa
                    Actions.initMap(state.selectedTree);
                    
                    // 2. CRUCIAL: Força o Leaflet a entender o tamanho da div
                    if (state.mapInstance) {
                        setTimeout(() => {
                            state.mapInstance.invalidateSize();
                            
                            // Centraliza novamente para garantir
                            const coords = convertToLatLon(state.selectedTree);
                            if(coords) state.mapInstance.setView(coords, 18);
                        }, 200);
                    }
                } else if (attempts < 20) { 
                    attempts++;
                    setTimeout(checkAndInitMap, 200); // Tenta a cada 200ms
                } else {
                    console.error("Map container falhou ao renderizar dimensões.");
                }
            }

            // Inicia o processo
            // Usamos um pequeno requestAnimationFrame para garantir que o HTML foi pintado
            requestAnimationFrame(() => {
                checkAndInitMap();
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
    
    // Fail-Fast: Se não tem container ou data, aborta sem erro.
    if (!container) return;

    // --- 1. LÓGICA DE DATAS ---
    const addDays = (dStr, days) => {
        if (!dStr) return new Date().toISOString().split('T')[0];
        const d = new Date(dStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    // Recupera dados do plano
    const startBase = plan.schedule.startDate.split('T')[0];
    const durMob = plan.durations?.mobilization || 0;
    const durExec = plan.durations?.execution || 1;
    const durDemob = plan.durations?.demobilization || 0;

    // Calcula Início e Fim Lógico de cada fase
    // O fim é visualmente inclusivo para o cálculo de largura
    const startMob = startBase;
    const endMob = addDays(startMob, Math.max(0, durMob - 1));
    
    // Execução começa após Mob (ou no início se Mob=0)
    const startExec = durMob > 0 ? addDays(endMob, 1) : startBase;
    const endExec = addDays(startExec, Math.max(0, durExec - 1));
    
    const startDemob = durDemob > 0 ? addDays(endExec, 1) : endExec;
    const endDemob = addDays(startDemob, Math.max(0, durDemob - 1));

    // Define o intervalo total do calendário (Margem de 1 dia antes e 2 depois para respiro)
    const calendarStart = addDays(startBase, -1);
    const finalDate = durDemob > 0 ? endDemob : endExec;
    const calendarEnd = addDays(finalDate, 2);

    // --- 2. GERAR HTML (HEADER - DIAS) ---
    let headerHTML = '';
    let curr = calendarStart;
    const maxLoops = 60; // Trava de segurança para evitar loops infinitos
    let loopCount = 0;
    
    // Loop para criar as colunas de dias
    while (curr <= calendarEnd && loopCount < maxLoops) {
        const dObj = new Date(curr);
        // Formata dia da semana (S, T, Q...) e dia numérico (01, 02...)
        const dayName = dObj.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase(); 
        const dayNum = String(dObj.getDate()).padStart(2, '0');
        
        // data-date é a chave para o posicionamento
        headerHTML += `<li data-date="${curr}">
            <div style="font-size:0.7em; opacity:0.7">${dayName}</div>
            <div>${dayNum}</div>
        </li>`;
        
        curr = addDays(curr, 1);
        loopCount++;
    }

    // --- 3. GERAR HTML (TASKS - BARRAS) ---
    let tasksHTML = '';
    let rowIndex = 0;
    
    // Helper para criar string da barra
    const addTask = (label, start, end, colorVar) => {
        const top = rowIndex * 45; // 45px de altura por linha (fixo no CSS)
        rowIndex++;
        return `<li data-start="${start}" data-end="${end}" 
                    style="background-color: var(${colorVar}); top: ${top}px;">
                    ${label}
                </li>`;
    };

    if (durMob > 0) {
        tasksHTML += addTask(`Mobilização (${durMob}d)`, startMob, endMob, '--color-mob');
    }
    tasksHTML += addTask(`Execução (${durExec}d)`, startExec, endExec, '--color-exec');
    if (durDemob > 0) {
        tasksHTML += addTask(`Desmobilização (${durDemob}d)`, startDemob, endDemob, '--color-demob');
    }

    // --- 4. RENDERIZAÇÃO E CÁLCULO DE GEOMETRIA ---
    // Limpa o container e injeta a estrutura nova
    container.innerHTML = `
        <div class="chart-wrapper">
            <ul class="chart-values">${headerHTML}</ul>
            <ul class="chart-bars">${tasksHTML}</ul>
        </div>
    `;

    // Timeout: Espera o navegador desenhar o HTML (Paint) para calcular as larguras
    setTimeout(() => {
        const wrapper = container.querySelector('.chart-wrapper');
        if (!wrapper) return;

        const headerItems = Array.from(wrapper.querySelectorAll('.chart-values li'));
        const bars = wrapper.querySelectorAll('.chart-bars li');

        // Mapeia: Data String -> Elemento DOM (para busca O(1))
        const domMap = {};
        headerItems.forEach(el => domMap[el.dataset.date] = el);

        bars.forEach(bar => {
            const sDate = bar.dataset.start;
            const eDate = bar.dataset.end;
            
            const elStart = domMap[sDate];
            const elEnd = domMap[eDate];

            if (elStart && elEnd) {
                // Lógica de Posicionamento Absoluto
                const leftPos = elStart.offsetLeft;
                
                // A largura da barra vai do início do dia 'start' até o fim do dia 'end'
                // offsetLeft do fim + offsetWidth do fim = Borda direita do último dia
                const rightEdge = elEnd.offsetLeft + elEnd.offsetWidth;
                const widthVal = rightEdge - leftPos;

                // Aplica coordenadas finais
                bar.style.left = `${leftPos}px`;
                bar.style.width = `${widthVal}px`;
                bar.style.opacity = '1'; // Ativa transição CSS
            }
        });
    }, 100);
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
    window.ArborIA = window.ArborIA || {};
    window.ArborIA.PlanningModule = {
        mount: (containerId, config, initialTreeId = null) => {
            const el = document.getElementById(containerId);
            if (!el) {
                console.error(`ArborIA: Container #${containerId} not found.`);
                return;
            }
            state.container = el;
            state.config = config;
            
            if (initialTreeId) {
                state.selectedTree = state.config.trees.find(t => t.id === initialTreeId);
                if (state.selectedTree) {
                    state.view = 'FORM';
                } else {
                    console.warn(`ArborIA: Tree with ID ${initialTreeId} not found in config. Falling back to LIST view.`);
                    state.view = 'LIST';
                }
            } else {
                state.view = 'LIST';
            }
            render();
            console.log("ArborIA Planning Module (Vanilla) mounted.");
        },
        unmount: () => {
            if (state.container) state.container.innerHTML = '';
            state = { container: null, config: null, view: 'LIST', selectedTree: null, plan: null, mapInstance: null };
        }
    };

})(window);