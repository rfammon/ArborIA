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

    // --- TEMPLATES ---

    function renderTreeList(trees) {
    if (!trees || trees.length === 0) {
        return `
            <div style="text-align: center; padding: 2rem;">
                <h3>Nenhuma árvore encontrada</h3>
                <p class="text-muted">Aguardando dados da Calculadora de Risco.</p>
            </div>
        `;
    }

    const cards = trees.map(tree => {
        const riskClass = tree.riskLevel.includes('Alto') ? 'risk-high' : tree.riskLevel.includes('Médio') ? 'risk-medium' : 'risk-low';
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
    const isHighRisk = tree.riskLevel.includes('Alto');
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
            <form id="planning-form">
                <fieldset class="risk-fieldset">
                    <legend>Avaliação de Risco: ${tree.species} (ID: ${tree.id})</legend>
                    <div class="${isHighRisk ? 'risk-high' : 'risk-medium'}" style="padding: 1rem; border-radius: var(--radius-md); color: white;">
                        <h4 style="font-weight: bold; margin: 0;">
                            Nível de Risco: ${tree.riskLevel} (Pontuação: ${tree.riskScore})
                        </h4>
                        <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">
                            <strong>Observações:</strong> ${tree.defects && tree.defects.length ? tree.defects.join(', ') : 'Nenhuma.'}
                        </p>
                    </div>
                </fieldset>

                <fieldset class="risk-fieldset">
                    <legend>1. Definição da Intervenção</legend>
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
                </fieldset>

                <fieldset class="risk-fieldset">
                    <legend>2. Recursos e SMS</legend>
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
                </fieldset>

                <fieldset class="risk-fieldset">
                    <legend>3. Equipe e Cronograma</legend>
                    <div class="form-grid">
                        <div>
                            <label for="foremen">Encarregados</label>
                            <input type="number" id="foremen" name="foremen" value="1" min="0">
                        </div>
                        <div>
                            <label for="operators">Operadores</label>
                            <input type="number" id="operators" name="operators" value="1" min="0">
                        </div>
                        <div>
                            <label for="auxiliaries">Auxiliares</label>
                            <input type="number" id="auxiliaries" name="auxiliaries" value="2" min="0">
                        </div>
                        <div>
                            <label for="startDate">Data de Início</label>
                            <input type="date" id="startDate" name="startDate" value="${today}">
                        </div>
                        <div>
                            <label for="endDate">Data de Término</label>
                            <input type="date" id="endDate" name="endDate" value="${today}">
                        </div>
                    </div>
                </fieldset>

                <fieldset class="risk-fieldset">
                    <legend>4. Encerramento</legend>
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
                </fieldset>

                <div class="risk-buttons-area">
                    <button type="button" id="btn-cancel" class="action-btn btn-clear">Cancelar</button>
                    <button type="submit" class="action-btn">Gerar Plano de Intervenção</button>
                </div>
            </form>
        </div>
    `;
}

    function renderDocumentView(plan, tree) {
        const start = new Date(plan.schedule.startDate);
        const end = new Date(plan.schedule.endDate);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

        let steps = [
            `Realizar o isolamento da área (Raio = Altura da árvore (${tree.height}m) + 50%).`,
            'Verificar ausência de fauna (ninhos/colmeias) antes do início.',
            'Posicionar equipe e sinalizar rotas de fuga.'
        ];
        if (tree.defects && tree.defects.some(d => d.toLowerCase().includes('elétrica'))) {
            steps.push('<strong>RISCO ELÉTRICO:</strong> Confirmar desligamento/bloqueio da rede.');
        }
        if (plan.interventionType.includes('Supressão')) {
            steps.push('Realizar entalhe direcional (45°-70°) na direção de queda.');
            steps.push('Executar corte de abate com filete de ruptura.');
        } else {
            steps.push(`Executar técnicas de poda: ${plan.techniques.join(', ')}.`);
        }
        steps.push(`Destinação: ${plan.wasteDestination}.`);
        steps.push('Limpeza final e desmobilização.');

        return `
            <div>
                <div class="risk-buttons-area" style="padding: 1rem; justify-content: space-between;">
                    <button type="button" id="btn-back-edit" class="action-btn btn-clear">Voltar e Editar</button>
                    <button type="button" id="btn-download-pdf" class="action-btn">Baixar PDF</button>
                </div>

                <div style="padding: 1rem;">
                    <div id="printable-area" style="background: white; padding: 2rem; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
                        
                        <div style="border-bottom: 4px solid var(--color-primary); padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h1 style="font-size: 2rem; font-weight: bold; color: var(--color-primary-dark); margin: 0;">
                                    Plano de Intervenção
                                </h1>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1rem; font-weight: bold; color: var(--color-primary-dark);">PI Nº ${plan.id}</div>
                                <div style="font-size: 0.8rem; color: var(--color-text-muted);">Emissão: ${new Date().toLocaleDateString()}</div>
                            </div>
                        </div>

                        <fieldset class="risk-fieldset">
                            <legend>1. Identificação da Árvore</legend>
                            <div class="form-grid">
                                <div>
                                    <p><strong>ID:</strong> ${tree.id}</p>
                                    <p><strong>Espécie:</strong> ${tree.species}</p>
                                    <p><strong>Local:</strong> ${tree.location}</p>
                                </div>
                                <div>
                                    <p><strong>DAP:</strong> ${tree.dap}cm</p>
                                    <p><strong>Altura:</strong> ${tree.height}m</p>
                                    <p><strong>Risco:</strong> ${tree.riskLevel}</p>
                                </div>
                                <div id="map-container" style="width: 100%; height: 150px; background-color: var(--color-light-gray); border-radius: var(--radius-sm); margin-top: 1rem;"></div>
                            </div>
                        </fieldset>

                        <fieldset class="risk-fieldset">
                            <legend>2. Escopo e Cronograma</legend>
                            <div style="background-color: var(--color-light-gray); padding: 1rem; border-radius: var(--radius-sm);">
                                <h4 style="font-weight: bold; color: var(--color-primary-dark); margin: 0;">${plan.interventionType}</h4>
                                <p style="margin: 0.5rem 0; font-style: italic;">"${plan.justification}"</p>
                                <p style="font-size: 0.9rem;"><strong>Técnicas:</strong> ${plan.techniques.join(', ')}</p>
                                <p style="font-size: 0.9rem;"><strong>Equipe:</strong> ${parseInt(plan.teamComposition.foremen) + parseInt(plan.teamComposition.chainsawOperators) + parseInt(plan.teamComposition.auxiliaries)} Pessoas</p>
                                <p style="font-size: 0.9rem;"><strong>Duração:</strong> ${diffDays} dias</p>
                            </div>
                        </fieldset>

                        <fieldset class="risk-fieldset">
                            <legend>3. Recursos e Procedimentos</legend>
                            <div class="form-grid">
                                <div>
                                    <h4 style="font-weight: bold;">Ferramentas</h4>
                                    <ul>${plan.tools.map(t => `<li>${t}</li>`).join('')}</ul>
                                </div>
                                <div>
                                    <h4 style="font-weight: bold;">EPIs</h4>
                                    <ul>${plan.epis.map(e => `<li>${e}</li>`).join('')}</ul>
                                </div>
                            </div>
                            <div style="margin-top: 1.5rem;">
                                <h4 style="font-weight: bold;">Procedimento Operacional</h4>
                                <ol style="padding-left: 1.5rem;">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
                            </div>
                            ${plan.executionInstructions ? `
                                <div style="margin-top: 1rem; padding: 1rem; background-color: #fffbe6; border: 1px solid #ffe58f; border-radius: var(--radius-sm);">
                                    <strong>Nota de Campo:</strong> ${plan.executionInstructions}
                                </div>` : ''}
                        </fieldset>

                        <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--color-border); display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; text-align: center;">
                            <div>
                                <p style="border-bottom: 1px solid var(--color-text-dark); margin-bottom: 0.5rem;">&nbsp;</p>
                                <p style="font-weight: bold; margin: 0;">${plan.responsible}</p>
                                <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0;">${plan.responsibleTitle}</p>
                            </div>
                            <div>
                                <p style="border-bottom: 1px solid var(--color-text-dark); margin-bottom: 0.5rem;">&nbsp;</p>
                                <p style="font-weight: bold; margin: 0;">Segurança do Trabalho</p>
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
            if (!window.L || !tree.coordinates) return;
            const container = $('#map-container');
            if (!container) return;

            if (state.mapInstance) {
                state.mapInstance.remove();
                state.mapInstance = null;
            }

            const { lat, lng } = tree.coordinates;
            const map = window.L.map(container, {
                center: [lat, lng],
                zoom: 19,
                attributionControl: false,
                zoomControl: false,
                dragging: false
            });

            window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri',
                maxZoom: 19
            }).addTo(map);

            window.L.marker([lat, lng]).addTo(map);
            state.mapInstance = map;
        },

        generatePDF: async () => {
            const btn = $('#btn-download-pdf');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Gerando...';
            btn.disabled = true;

            try {
                if (state.config.onSavePlan) {
                    state.config.onSavePlan(state.plan);
                }

                const element = $('#printable-area');
                await new Promise(r => setTimeout(r, 100));

                const canvas = await window.html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                const pdfWidth = 210;
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`${state.plan.id}.pdf`);
            } catch (err) {
                console.error("PDF Error", err);
                alert("Erro ao gerar PDF.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
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
                card.addEventListener('click', () => {
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
        }

        if (state.view === 'DOCUMENT') {
            $('#btn-back-edit').addEventListener('click', () => { state.view = 'FORM'; render(); });
            $('#btn-download-pdf').addEventListener('click', Actions.generatePDF);
            
            setTimeout(() => Actions.initMap(state.selectedTree), 100);
        }
    }

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
        mount: (containerId, config) => {
            const el = document.getElementById(containerId);
            if (!el) {
                console.error(`ArborIA: Container #${containerId} not found.`);
                return;
            }
            state.container = el;
            state.config = config;
            state.view = 'LIST';
            render();
            console.log("ArborIA Planning Module (Vanilla) mounted.");
        },
        unmount: () => {
            if (state.container) state.container.innerHTML = '';
            state = { container: null, config: null, view: 'LIST', selectedTree: null, plan: null, mapInstance: null };
        }
    };

})(window);