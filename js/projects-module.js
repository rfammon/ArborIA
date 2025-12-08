/**
 * INTERVENTION PLANS MANAGER - Gestor de Planos de Intervenção
 * Painel de controle para gerenciar planos de intervenção salvos
 *
 * CSS necessário para transições suaves (adicionar ao CSS global do projeto):
 * .mini-badge {
 *   transition: background-color 0.3s ease, color 0.3s ease;
 * }
 * .urgency-overdue { background-color: #d32f2f !important; }
 * .urgency-soon { background-color: #ff9800 !important; }
 * .urgency-normal { background-color: #4caf50 !important; }
 *
 * CSS necessário para o gráfico de Gantt (adicionar ao CSS global do projeto):
 * #gantt-chart-container {
 *   transition: all 0.3s ease;
 * }
 * .gantt-bar {
 *   transition: width 0.5s ease, background-color 0.3s ease;
 * }
 * .gantt-row:hover {
 *   background-color: #f9f9f9;
 * }
 */

'use strict';

// --- ESTADO DO MÓDULO ---
const state = {
    container: null,
    apiService: null,
    onCancel: null,
    view: 'DASHBOARD', // DASHBOARD, TIMELINE, PLAN_DETAIL
    selectedPlan: null,
    plans: [],
    stats: null,
    isLoading: false
};

// --- UTILITÁRIOS ---
const $ = (selector) => state.container ? state.container.querySelector(selector) : null;
const $$ = (selector) => state.container ? state.container.querySelectorAll(selector) : [];

function showToast(message, type = 'info') {
    if (window.utils && window.utils.showToast) {
        window.utils.showToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

function formatDate(dateInput) {
    if (!dateInput) return 'Não definida';

    // Se for objeto JSONB do schedule (ex: {start: '2025-01-15', end: '2025-01-20'} ou {startDate: '2025-01-15', endDate: '2025-01-17'})
    if (typeof dateInput === 'object') {
        // Tenta extrair a data usando a função auxiliar
        const extractedDate = extractScheduleDate(dateInput);
        if (extractedDate) {
            dateInput = extractedDate;
        } else {
            return 'Formato inválido';
        }
    }

    // Se ainda não for string, tentar converter
    if (typeof dateInput !== 'string') {
        return 'Formato inválido';
    }

    const [y, m, d] = dateInput.split('-');
    return `${d}/${m}/${y}`;
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('pt-BR');
}

function extractScheduleDate(schedule) {
    // Retorna a data de início do schedule (JSONB ou string)
    if (!schedule) return null;
    if (typeof schedule === 'string') return schedule;
    if (typeof schedule === 'object' && schedule.start) return schedule.start;
    if (typeof schedule === 'object' && schedule.startDate) return schedule.startDate;  // Correção para lidar com o formato correto
    return null;
}

// Mapeamento de tipos de intervenção para ícones
const INTERVENTION_ICONS = {
    'poda': '✂️',
    'supressao': '🪓',
    'transplante': '🌱',
    'tratamento': '💊',
    'monitoramento': '👁️'
};

// Mapeamento de tipos para cores
const INTERVENTION_COLORS = {
    'poda': '#4caf50',
    'supressao': '#d32f2f',
    'transplante': '#ff9800',
    'tratamento': '#2196f3',
    'monitoramento': '#9c27b0'
};

// --- CLASSE PRINCIPAL ---
export class ProjectsModule {
    constructor(config) {
        state.container = config.container;
        state.apiService = config.apiService;
        state.onCancel = config.onCancel;

        if (!state.container || !state.apiService) {
            throw new Error('[InterventionPlansManager] Container e ApiService são obrigatórios');
        }

        console.log('[InterventionPlansManager] ✓ Módulo inicializado');
    }

    async render() {
        if (!state.container) return;

        // Parar monitoramento anterior antes de renderizar nova view
        this.stopUrgencyBadgeMonitoring();

        state.container.innerHTML = '<div class="loading-spinner">Carregando planos...</div>';

        try {
            let content = '';
            switch (state.view) {
                case 'DASHBOARD':
                    content = await this.renderDashboard();
                    break;
                case 'TIMELINE':
                    content = await this.renderTimeline();
                    break;
                case 'PLAN_DETAIL':
                    content = await this.renderPlanDetail();
                    break;
                default:
                    content = await this.renderDashboard();
            }

            state.container.innerHTML = content;
            this.attachEventListeners();

            // Iniciar monitoramento após renderizar as views que contêm badges
            if (state.view === 'DASHBOARD' || state.view === 'TIMELINE') {
                this.startUrgencyBadgeMonitoring();
            }

        } catch (error) {
            console.error('[InterventionPlansManager] Erro no render:', error);
            state.container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <p style="color: #d32f2f;"><strong>Erro ao carregar módulo</strong></p>
                    <p>${error.message}</p>
                    <button id="btn-back-to-menu" class="btn btn-secondary">Voltar ao Menu</button>
                </div>
            `;
        }
    }

    async renderDashboard() {
        state.isLoading = true;

        // Carregar planos de intervenção
        const plansResult = await state.apiService.getUserPlans();
        state.plans = plansResult.data || [];

        // Carregar dependências salvas
        await this.loadDependencies();

        // Calcular estatísticas
        state.stats = this.calculateStats(state.plans);

        state.isLoading = false;

        const stats = state.stats;

        return `
            <div style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h2 style="margin: 0;">📋 Gestão de Planos de Intervenção</h2>
                        <p style="margin: 0.5rem 0 0 0; color: #666;">Acompanhamento de intervenções programadas</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="btn-view-timeline" class="btn btn-primary">
                            <i class="fas fa-calendar"></i> Ver Cronograma
                        </button>
                    </div>
                </div>

                <!-- KPIs Dashboard -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div class="project-kpi-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        <div class="kpi-value">${stats.totalPlans}</div>
                        <div class="kpi-label">Planos Cadastrados</div>
                    </div>
                    <div class="project-kpi-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                        <div class="kpi-value">${stats.pendingInterventions}</div>
                        <div class="kpi-label">Intervenções Pendentes</div>
                    </div>
                    <div class="project-kpi-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                        <div class="kpi-value">${stats.thisWeek}</div>
                        <div class="kpi-label">Programadas Esta Semana</div>
                    </div>
                    <div class="project-kpi-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                        <div class="kpi-value">${stats.thisMonth}</div>
                        <div class="kpi-label">Programadas Este Mês</div>
                    </div>
                </div>

                <!-- Distribuição por Tipo -->
                <div style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                    <h3 style="margin-top: 0;">📊 Distribuição por Tipo de Intervenção</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                        ${Object.entries(stats.byType).map(([type, count]) => `
                            <div style="flex: 1; min-width: 150px; padding: 1rem; background: #f5f5f5; border-radius: 8px; border-left: 4px solid ${INTERVENTION_COLORS[type] || '#666'};">
                                <div style="font-size: 1.5rem;">${INTERVENTION_ICONS[type] || '📌'}</div>
                                <div style="font-size: 1.2rem; font-weight: bold; margin: 0.5rem 0;">${count}</div>
                                <div style="font-size: 0.85rem; color: #666; text-transform: capitalize;">${type}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Gráfico de Gantt -->
                ${state.plans.length > 0 ? this.renderGanttChart(state.plans) : ''}

                <!-- Lista de Planos -->
                <div style="margin-top: 3rem;">
                    <h3 style="margin-top: 0;">📝 Planos de Intervenção Cadastrados (${state.plans.length})</h3>
                    ${state.plans.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; background: white; border-radius: 8px;">
                            <p style="color: #999; margin: 0;">Nenhum plano de intervenção cadastrado ainda</p>
                            <p style="color: #666; font-size: 0.9rem; margin-top: 0.5rem;">Cadastre planos através do módulo "Plano de Intervenção"</p>
                        </div>
                    ` : `
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
                            ${state.plans.map(plan => this.renderPlanCard(plan)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderPlanCard(plan) {
        const icon = INTERVENTION_ICONS[plan.interventionType] || '📌';
        const color = INTERVENTION_COLORS[plan.interventionType] || '#666';

        // Calcular dias até a execução e obter configuração de urgência
        const daysUntil = this.getDaysUntilExecution(plan.schedule);
        const urgencyConfig = this.getUrgencyBadgeConfig(daysUntil);

        // Extrair o ID do plano no formato PI-2025-002
        const planIdDisplay = plan.id.startsWith('PI-') ? plan.id : `PI-${new Date().getFullYear()}-${plan.id.slice(0, 3)}`;
        // Se o ID não estiver no formato esperado, tentar extrair ou gerar um ID legível
        const readablePlanId = plan.id.match(/^PI-\d{4}-\d{3}/) ? plan.id : `PI-${new Date().getFullYear()}-${String(plan.id).padStart(3, '0')}`;

        return `
            <div class="project-card" style="border-left-color: ${color};" data-plan-id="${plan.id}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <span style="font-size: 1.5rem;">${icon}</span>
                        <div>
                            <h4 style="margin: 0; font-size: 0.95rem; text-transform: capitalize;">${plan.interventionType}</h4>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: #666;">${readablePlanId}</p>
                        </div>
                    </div>
                    ${daysUntil !== null ? `
                        <span class="mini-badge ${urgencyConfig.cssClass}" style="background: ${urgencyConfig.color}; transition: background-color 0.3s ease;">
                            ${urgencyConfig.label}
                        </span>
                    ` : ''}
                </div>

                ${plan.justification ? `
                    <p style="font-size: 0.85rem; color: #666; margin-bottom: 1rem; line-height: 1.4;">
                        ${plan.justification.substring(0, 120)}${plan.justification.length > 120 ? '...' : ''}
                    </p>
                ` : ''}

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.8rem;">
                    <div>
                        <strong>📅 Programado:</strong><br>
                        ${formatDate(extractScheduleDate(plan.schedule))}
                    </div>
                    <div>
                        <strong>👤 Responsável:</strong><br>
                        ${plan.responsible || 'Não definido'}
                    </div>
                </div>

                ${plan.techniques && plan.techniques.length > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.25rem;">Técnicas:</div>
                        <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                            ${plan.techniques.map(t => `
                                <span class="mini-badge" style="background: #e0e0e0; color: #333; font-size: 0.7rem;">${t}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-primary btn-view-plan-detail" data-plan-id="${plan.id}">
                        <i class="fas fa-eye"></i> Detalhes
                    </button>
                    <button class="btn btn-sm btn-secondary btn-edit-plan" data-plan-id="${plan.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </div>

                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee; font-size: 0.75rem; color: #999;">
                    Criado em ${formatDate(plan.createdAt?.split('T')[0])}
                </div>
            </div>
        `;
    }

    async renderTimeline() {
        if (state.plans.length === 0) {
            const plansResult = await state.apiService.getUserPlans();
            state.plans = plansResult.data || [];
        }

        // Ordenar planos por data
        const sortedPlans = [...state.plans].sort((a, b) => {
            const dateA = new Date(extractScheduleDate(a.schedule) || '9999-12-31');
            const dateB = new Date(extractScheduleDate(b.schedule) || '9999-12-31');
            return dateA - dateB;
        });

        return `
            <div style="padding: 1.5rem;">
                <button id="btn-back-dashboard" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem;">
                    <i class="fas fa-arrow-left"></i> Voltar ao Dashboard
                </button>

                <h2>📅 Cronograma de Intervenções</h2>
                <div style="overflow-x: auto;">
                    <table class="activities-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <thead style="background: #f5f5f5;">
                            <tr>
                                <th style="width: 50px;">Ícone</th>
                                <th style="width: 200px;">Plano</th>
                                <th style="width: 120px;">Data</th>
                                <th style="width: 150px;">Responsável</th>
                                <th style="width: 100px;">Status</th>
                                <th style="width: 80px;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedPlans.map(plan => {
            const daysUntil = this.getDaysUntilExecution(plan.schedule);
            const urgencyConfig = this.getUrgencyBadgeConfig(daysUntil);
            const icon = INTERVENTION_ICONS[plan.interventionType] || '📌';
            const color = INTERVENTION_COLORS[plan.interventionType] || '#666';

            // Formatar ID do plano para exibição na tabela
            const readablePlanId = plan.id.startsWith('PI-') ? plan.id : `PI-${new Date().getFullYear()}-${String(plan.id).padStart(3, '0')}`;

            return `
                            <tr data-plan-id="${plan.id}" style="cursor: pointer;">
                                <td style="text-align: center; font-size: 1.5rem;">${icon}</td>
                                <td>
                                    <div style="font-weight: 600; text-transform: capitalize;">${readablePlanId}</div>
                                    <div style="font-size: 0.85rem; color: #666;">
                                        ${plan.justification?.substring(0, 80) || 'Sem justificativa'}${(plan.justification?.length || 0) > 80 ? '...' : ''}
                                    </div>
                                </td>
                                <td>
                                    <div>${formatDate(extractScheduleDate(plan.schedule))}</div>
                                    ${daysUntil !== null ? `
                                        <div style="font-size: 0.75rem; color: ${urgencyConfig.color}; transition: color 0.3s ease;">
                                            ${daysUntil === 0 ? 'Hoje!' : daysUntil > 0 ? `em ${daysUntil}d` : `${Math.abs(daysUntil)}d atrasado`}
                                        </div>
                                    ` : ''}
                                </td>
                                <td>${plan.responsible || '-'}</td>
                                <td>
                                    <span class="mini-badge" style="background: ${urgencyConfig.color}; transition: background-color 0.3s ease;">
                                        ${urgencyConfig.label}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-primary btn-view-plan-detail" data-plan-id="${plan.id}">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div >
            `;
    }

    async renderPlanDetail() {
        if (!state.selectedPlan) {
            return '<p>Plano não selecionado</p>';
        }

        const plan = state.selectedPlan;
        const icon = INTERVENTION_ICONS[plan.interventionType] || '📌';
        const color = INTERVENTION_COLORS[plan.interventionType] || '#666';

        return `
            <div style="padding: 1.5rem;">
                <button id="btn-back-dashboard" class="btn btn-secondary btn-sm" style="margin-bottom: 1.5rem;">
                    <i class="fas fa-arrow-left"></i> Voltar
                </button>

                <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid ${color};">
                        <span style="font-size: 3rem;">${icon}</span>
                        <div>
                            <h2 style="margin: 0; text-transform: capitalize;">${plan.interventionType}</h2>
                            <p style="margin: 0.25rem 0 0 0; color: #666;">ID do Plano: ${plan.id.startsWith('PI-') ? plan.id : `PI-${new Date().getFullYear()}-${String(plan.id).padStart(3, '0')}`}</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem;">📅 Data Programada</h4>
                            <p style="margin: 0; font-size: 1.1rem; font-weight: 600;">${formatDate(extractScheduleDate(plan.schedule))}</p>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem;">👤 Responsável pela Execução</h4>
                            <p style="margin: 0; font-size: 1.1rem;">${plan.responsible || 'Não definido'}</p>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem;">✍️ Cargo/Função</h4>
                            <p style="margin: 0; font-size: 1.1rem;">${plan.responsibleTitle || 'Não definido'}</p>
                        </div>
                    </div>

                    ${plan.justification ? `
                        <div style="margin-bottom: 2rem;">
                            <h4 style="margin: 0 0 0.5rem 0;">📝 Justificativa</h4>
                            <p style="margin: 0; background: #f5f5f5; padding: 1rem; border-radius: 4px; line-height: 1.6;">
                                ${plan.justification}
                            </p>
                        </div>
                    ` : ''}

                    ${plan.techniques && plan.techniques.length > 0 ? `
                        <div style="margin-bottom: 2rem;">
                            <h4 style="margin: 0 0 0.5rem 0;">🔧 Técnicas Previstas</h4>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${plan.techniques.map(t => `
                                    <span class="mini-badge" style="background: ${color}; color: white; padding: 0.5rem 1rem;">${t}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${plan.tools && plan.tools.length > 0 ? `
                        <div style="margin-bottom: 2rem;">
                            <h4 style="margin: 0 0 0.5rem 0;">🛠️ Ferramentas</h4>
                            <div style="background: #f5f5f5; padding: 1rem; border-radius: 4px;">
                                <ul style="margin: 0; padding-left: 1.5rem;">
                                    ${plan.tools.map(tool => `<li>${tool}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}

                    ${plan.epis && plan.epis.length > 0 ? `
                        <div style="margin-bottom: 2rem;">
                            <h4 style="margin: 0 0 0.5rem 0;">🦺 EPIs Necessários</h4>
                            <div style="background: #f5f5f5; padding: 1rem; border-radius: 4px;">
                                <ul style="margin: 0; padding-left: 1.5rem;">
                                    ${plan.epis.map(epi => `<li>${epi}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}

                    ${plan.teamComposition ? `
                        <div style="margin-bottom: 2rem;">
                            <h4 style="margin: 0 0 0.5rem 0;">👥 Composição da Equipe</h4>
                            <div style="background: #f5f5f5; padding: 1rem; border-radius: 4px;">
                                ${typeof plan.teamComposition === 'object' ?
                    Object.entries(plan.teamComposition)
                        .map(([key, value]) => `<div style="margin-bottom: 0.5rem;"><strong>${key}:</strong> ${value}</div>`)
                        .join('')
                    : plan.teamComposition}
                            </div>
                        </div>
                    ` : ''}

                    <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #999; font-size: 0.85rem;">
                        Criado em ${formatDateTime(plan.createdAt)} • Última atualização: ${formatDateTime(plan.updatedAt)}
                    </div>
                </div>
            </div>
            `;
    }

    // --- FUNÇÕES AUXILIARES ---

    calculateStats(plans) {
        const now = new Date();
        const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const stats = {
            totalPlans: plans.length,
            pendingInterventions: 0,
            thisWeek: 0,
            thisMonth: 0,
            byType: {}
        };

        plans.forEach(plan => {
            // Contar por tipo
            const type = plan.interventionType || 'outro';
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // Analisar datas
            if (plan.schedule) {
                const scheduleDateStr = extractScheduleDate(plan.schedule);
                if (scheduleDateStr) {
                    const scheduleDate = new Date(scheduleDateStr);

                    if (scheduleDate >= now) {
                        stats.pendingInterventions++;

                        if (scheduleDate <= oneWeek) {
                            stats.thisWeek++;
                        }

                        if (scheduleDate <= oneMonth) {
                            stats.thisMonth++;
                        }
                    }
                }
            }
        });

        return stats;
    }

    getDaysUntilExecution(schedule) {
        if (!schedule) return null;

        const scheduleDate = extractScheduleDate(schedule);
        if (!scheduleDate) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const target = new Date(scheduleDate);
        target.setHours(0, 0, 0, 0);

        const diffTime = target - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    /**
     * Determina a cor do badge de urgência com base na data de execução
     * @param {number} daysUntil - Número de dias até a execução
     * @returns {Object} Objeto com cor e classe CSS para o badge
     */
    getUrgencyBadgeConfig(daysUntil) {
        if (daysUntil === null) {
            return {
                color: '#666',
                cssClass: 'urgency-normal',
                label: 'N/A'
            };
        }

        let color, cssClass, label;

        if (daysUntil < 0) {
            // Tarefa atrasada
            color = '#d32f2f'; // vermelho
            cssClass = 'urgency-overdue';
            label = 'Atrasado';
        } else if (daysUntil === 0) {
            // Tarefa para hoje
            color = '#d32f2f'; // vermelho
            cssClass = 'urgency-overdue';
            label = 'Hoje';
        } else if (daysUntil <= 7) {
            // Tarefa vence esta semana
            color = '#ff9800'; // amarelo
            cssClass = 'urgency-soon';
            label = `${daysUntil} d`;
        } else {
            // Tarefa com prazo normal
            color = '#4caf50'; // verde
            cssClass = 'urgency-normal';
            label = `${daysUntil} d`;
        }

        return {
            color,
            cssClass,
            label
        };
    }

    /**
     * Calcula dias úteis entre duas datas, excluindo fins de semana
     * @param {Date} startDate - Data de início
     * @param {Date} endDate - Data de término
     * @returns {number} Número de dias úteis
     */
    getBusinessDays(startDate, endDate) {
        let count = 0;
        const currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            // 0 = domingo, 6 = sábado, então 1-5 são dias úteis
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                count++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return count;
    }

    /**
     * Determina a cor do badge considerando dias úteis e feriados
     * @param {string} scheduleDate - Data do agendamento
     * @param {Array} holidays - Array de datas de feriados (opcional)
     * @returns {Object} Configuração do badge de urgência
     */
    getAdvancedUrgencyConfig(scheduleDate, holidays = []) {
        if (!scheduleDate) return this.getUrgencyBadgeConfig(null);

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const targetDate = new Date(scheduleDate);
        targetDate.setHours(0, 0, 0, 0);

        // Calcular dias corridos
        const diffTime = targetDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Se for negativo ou zero, usar lógica padrão
        if (diffDays <= 0) {
            return this.getUrgencyBadgeConfig(diffDays);
        }

        // Calcular dias úteis
        const businessDays = this.getBusinessDays(now, targetDate);
        // Remover feriados dos dias úteis
        const holidaysInPeriod = holidays.filter(holiday => {
            const holidayDate = new Date(holiday);
            return holidayDate >= now && holidayDate <= targetDate;
        }).length;

        const adjustedBusinessDays = businessDays - holidaysInPeriod;

        // Aplicar lógica baseada em dias úteis
        if (adjustedBusinessDays <= 0) {
            // Considerar como atrasado se não houver dias úteis restantes
            return this.getUrgencyBadgeConfig(-1);
        } else if (adjustedBusinessDays <= 5) { // Uma semana útil
            // Tarefa vence esta semana útil
            return {
                color: '#ff9800', // amarelo
                cssClass: 'urgency-soon',
                label: `${adjustedBusinessDays}d úteis`
            };
        } else {
            // Tarefa com prazo normal
            return {
                color: '#4caf50', // verde
                cssClass: 'urgency-normal',
                label: `${adjustedBusinessDays}d úteis`
            };
        }
    }

    // --- EVENT LISTENERS ---
    attachEventListeners() {
        // Navegação
        const btnBackDashboard = $('#btn-back-dashboard');
        if (btnBackDashboard) {
            btnBackDashboard.addEventListener('click', () => {
                state.view = 'DASHBOARD';
                state.selectedPlan = null;
                this.render();
            });
        }

        const btnBackToMenu = $('#btn-back-to-menu');
        if (btnBackToMenu) {
            btnBackToMenu.addEventListener('click', () => {
                if (state.onCancel) state.onCancel();
            });
        }

        // Ver cronograma
        const btnViewTimeline = $('#btn-view-timeline');
        if (btnViewTimeline) {
            btnViewTimeline.addEventListener('click', () => {
                state.view = 'TIMELINE';
                this.render();
            });
        }

        // Ver detalhes do plano
        const btnsViewDetail = $$('.btn-view-plan-detail');
        btnsViewDetail.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const planId = btn.getAttribute('data-plan-id');
                const result = await state.apiService.getPlan(planId);
                if (result.data) {
                    state.selectedPlan = result.data;
                    state.view = 'PLAN_DETAIL';
                    this.render();
                } else {
                    showToast('Erro ao carregar detalhes do plano', 'error');
                }
            });
        });

        // Editar plano (abrir módulo de planos com plano específico)
        const btnsEdit = $$('.btn-edit-plan');
        btnsEdit.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const planId = btn.getAttribute('data-plan-id');

                // Navegar para a view de planos de intervenção
                const planningBtn = document.querySelector('.topico-btn[data-target="plano-intervencao-view"]');
                if (planningBtn) {
                    planningBtn.click();

                    // Aguardar um pouco para a view carregar, depois abrir o plano para edição
                    setTimeout(() => {
                        if (window.openPlanningModule) {
                            window.openPlanningModule(null, planId);
                        }
                    }, 300);
                }
            });
        });

        // Click na linha da tabela
        const tableRows = $$('.activities-table tbody tr[data-plan-id]');
        tableRows.forEach(row => {
            row.addEventListener('click', async () => {
                const planId = row.getAttribute('data-plan-id');
                const result = await state.apiService.getPlan(planId);
                if (result.data) {
                    state.selectedPlan = result.data;
                    state.view = 'PLAN_DETAIL';
                    this.render();
                }
            });
        });

        // Habilitar seleção de dependências no gráfico de Gantt, se estiver visível
        if (state.view === 'DASHBOARD' && $('#gantt-chart-container')) {
            this.enableDependencySelection();
        }

        // Atualizar as dependências visuais no gráfico
        setTimeout(() => {
            this.updateGanttDependencies();
        }, 100);
    }

    /**
     * Atualiza dinamicamente os badges de urgência para todos os planos na view atual
     * Esta função pode ser chamada periodicamente para atualizar as cores dos badges
     */
    updateUrgencyBadges() {
        // Atualizar badges na view de dashboard
        if (state.view === 'DASHBOARD') {
            const planCards = $$('.project-card');
            planCards.forEach(card => {
                const planId = card.getAttribute('data-plan-id');
                const plan = state.plans.find(p => p.id === planId);

                if (plan) {
                    const daysUntil = this.getDaysUntilExecution(plan.schedule);
                    const urgencyConfig = this.getUrgencyBadgeConfig(daysUntil);

                    const badge = card.querySelector('.mini-badge');
                    if (badge) {
                        badge.className = `mini-badge ${urgencyConfig.cssClass}`;
                        badge.style.backgroundColor = urgencyConfig.color;
                        badge.style.transition = 'background-color 0.3s ease';
                        badge.textContent = urgencyConfig.label;
                    }
                }
            });
        }

        // Atualizar badges na view de timeline
        if (state.view === 'TIMELINE') {
            const tableRows = $$('.activities-table tbody tr[data-plan-id]');
            tableRows.forEach(row => {
                const planId = row.getAttribute('data-plan-id');
                const plan = state.plans.find(p => p.id === planId);

                if (plan) {
                    const daysUntil = this.getDaysUntilExecution(plan.schedule);
                    const urgencyConfig = this.getUrgencyBadgeConfig(daysUntil);

                    // Atualizar o badge na coluna de status
                    const statusCell = row.querySelector('td:nth-child(5) .mini-badge');
                    if (statusCell) {
                        statusCell.style.backgroundColor = urgencyConfig.color;
                        statusCell.style.transition = 'background-color 0.3s ease';
                        statusCell.textContent = urgencyConfig.label;
                    }

                    // Atualizar o texto informativo sobre dias restantes
                    const daysInfo = row.querySelector('td:nth-child(3) div:last-child');
                    if (daysInfo) {
                        daysInfo.style.color = urgencyConfig.color;
                        daysInfo.style.transition = 'color 0.3s ease';
                        daysInfo.textContent = daysUntil === 0 ? 'Hoje!' : daysUntil > 0 ? `em ${daysUntil} d` : `${Math.abs(daysUntil)}d atrasado`;
                    }
                }
            });
        }
    }

    /**
     * Inicia o monitoramento automático para atualizar os badges de urgência
     * Verifica e atualiza as cores dos badges periodicamente
     */
    startUrgencyBadgeMonitoring() {
        // Atualizar badges a cada 10 minutos (600000 ms) ou quando necessário
        const updateInterval = setInterval(() => {
            this.updateUrgencyBadges();
        }, 600000); // 10 minutos

        // Permitir limpeza do intervalo quando necessário
        state.urgencyBadgeInterval = updateInterval;
    }

    /**
     * Para o monitoramento automático dos badges de urgência
     */
    stopUrgencyBadgeMonitoring() {
        if (state.urgencyBadgeInterval) {
            clearInterval(state.urgencyBadgeInterval);
            state.urgencyBadgeInterval = null;
        }
    }

    /**
     * Renderiza o gráfico de Gantt com os planos de intervenção
     * @param {Array} plans - Array de planos para exibir no Gantt
     * @returns {string} HTML do contêiner do gráfico de Gantt
     */
    renderGanttChart(plans) {
        // Converter planos para o formato necessário para o Gantt
        const ganttTasks = plans.map((plan, index) => {
            const scheduleDate = extractScheduleDate(plan.schedule);
            const daysUntil = this.getDaysUntilExecution(plan.schedule);
            const urgencyConfig = this.getUrgencyBadgeConfig(daysUntil);

            // Determinar a data de início e término com base na duração prevista
            const startDate = scheduleDate ? new Date(scheduleDate) : new Date();
            const endDate = new Date(startDate);

            // Adicionar dias baseado na duração se disponível
            if (plan.durations) {
                const totalDays = (plan.durations.mobilization || 0) +
                    (plan.durations.execution || 0) +
                    (plan.durations.demobilization || 0);
                endDate.setDate(endDate.getDate() + totalDays);
            } else {
                // Padrão: 1 dia se não houver duração definida
                endDate.setDate(endDate.getDate() + 1);
            }

            // Determinar o progresso com base no status (simulado)
            let progress = 0;
            if (daysUntil < 0) progress = 100; // Atrasado
            else if (daysUntil === 0) progress = 90; // Hoje
            else if (daysUntil <= 7) progress = 50; // Urgente
            else progress = 20; // Normal

            // Formatar ID do plano
            const readablePlanId = plan.id.startsWith('PI-') ? plan.id : `PI - ${new Date().getFullYear()} -${String(index + 1).padStart(3, '0')} `;

            return {
                id: plan.id,
                text: `${readablePlanId} - ${plan.interventionType} `,
                start_date: startDate,
                end_date: endDate,
                progress: progress / 100,
                color: urgencyConfig.color,
                type: 'task',
                parent: null,
                plan: plan
            };
        });

        // Determinar o intervalo de datas para o cabeçalho do Gantt
        let minDate, maxDate;
        if (ganttTasks.length > 0) {
            minDate = new Date(Math.min(...ganttTasks.map(task => task.start_date)));
            maxDate = new Date(Math.max(...ganttTasks.map(task => task.end_date)));

            // Expandir um pouco o intervalo para melhor visualização
            minDate.setDate(minDate.getDate() - 2);
            maxDate.setDate(maxDate.getDate() + 2);
        } else {
            minDate = new Date();
            maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30);
        }

        // Calcular a largura total do timeline com base no intervalo de datas
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
        const dayWidth = 40; // pixels por dia
        const totalWidth = totalDays * dayWidth;

        // Gerar o cabeçalho com as datas
        const dateHeaders = [];
        const currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            dateHeaders.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Gerar o HTML para o gráfico de Gantt clássico
        return `
            <div id="gantt-chart-container" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem; overflow-x: auto; position: relative;">
                <h3 style="margin-top: 0; margin-bottom: 1.5rem;">📊 Cronograma de Execução</h3>
                <div style="min-width: ${Math.max(800, totalWidth)}px;">
                    <!-- Cabeçalho de datas -->
                    <div style="display: flex; border-bottom: 2px solid #333; margin-bottom: 5px;">
                        <div style="width: 250px; height: 30px;"></div>
                        <div style="flex: 1; display: flex;">
                            ${dateHeaders.map(date => `
                                <div style="width: ${dayWidth}px; text-align: center; font-size: 0.7rem; padding: 2px; border-left: 1px solid #ddd;">
                                    ${date.getDate()}/${String(date.getMonth() + 1).padStart(2, '0')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Tarefas e Linha do tempo atual -->
                    <div class="gantt-main-container" style="position: relative; overflow: hidden;">
                        <!-- Linha do tempo atual -->
                        <div id="today-line" class="today-indicator"
                             style="position: absolute; top: 0; bottom: 0; width: 2px; background: #ff5722; z-index: 10; pointer-events: none;"
                             data-today-position="${Math.max(0, Math.floor((new Date() - minDate) / (1000 * 60 * 60 * 24)) * dayWidth + 250)}px">
                        </div>
                        
                        <!-- Tarefas -->
                        <div id="gantt-timeline" style="display: flex; flex-direction: column; gap: 15px;">
                            ${ganttTasks.map(task => {
            // Calcular posição e largura da barra com base nas datas
            const startOffset = Math.max(0, Math.floor((task.start_date - minDate) / (1000 * 60 * 60 * 24)));
            const duration = Math.ceil((task.end_date - task.start_date) / (1000 * 60 * 60 * 24));
            const leftPos = startOffset * dayWidth;
            const barWidth = Math.max(20, duration * dayWidth); // Mínimo de 20px para visibilidade

            return `
                                    <div class="gantt-row" style="display: flex; align-items: center; min-height: 40px;">
                                        <div style="width: 250px; font-weight: bold; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${task.text}
                                        </div>
                                        <div class="gantt-bar-container" style="flex: 1; position: relative; height: 30px; min-width: ${totalWidth}px;">
                                            <div class="gantt-bar"
                                                 style="position: absolute; left: ${leftPos}px; height: 24px; width: ${barWidth}px; background: ${task.color}; border-radius: 3px; transition: all 0.3s ease;"
                                                 data-task-id="${task.id}">
                                                <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${task.progress * 100}%; background: rgba(255,255,255,0.3); border-radius: 3px;"></div>
                                                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-size: 0.7rem; text-shadow: 0 0 2px rgba(0,0,0,0.5); width: 100%;">
                                                    ${Math.round(task.progress * 100)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 20px; height: 20px; background: #d32f2f; border-radius: 3px;"></div>
                        <span style="font-size: 0.8rem;">Atrasado (≤ 0 dias)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 20px; height: 20px; background: #ff9800; border-radius: 3px;"></div>
                        <span style="font-size: 0.8rem;">Urgente (≤ 7 dias)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 20px; height: 20px; background: #4caf50; border-radius: 3px;"></div>
                        <span style="font-size: 0.8rem;">Normal (> 7 dias)</span>
                    </div>
                </div>
                
                <!--Indicador de hoje-- >
            <div id="today-indicator" style="position: absolute; width: 2px; height: 100%; background: #ff5722; z-index: 5; pointer-events: none;"
                data-update-today="true"></div>
            </div >
            `;
    }

    /**
     * Atualiza o gráfico de Gantt com novos dados
     * @param {Array} plans - Array de planos para atualizar o Gantt
     */
    updateGanttChart(plans) {
        const container = $('#gantt-chart-container');
        if (container) {
            const newContent = this.renderGanttChart(plans);
            // Substituir o conteúdo mantendo o ID do container
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newContent;
            const newContainer = tempDiv.firstChild;

            container.innerHTML = newContainer.innerHTML;
            container.setAttribute('id', 'gantt-chart-container');

            // Atualizar a posição do indicador de hoje após um pequeno delay para garantir que o DOM esteja pronto
            setTimeout(() => {
                this.updateTodayIndicator();

                // Atualizar as dependências visuais no gráfico
                this.updateGanttDependencies();
            }, 100);
        }
    }

    /**
     * DOCUMENTAÇÃO DA FUNCIONALIDADE DEPENDÊNCIA DE CRONOGRAMA
     *
     * Esta implementação adiciona ao dashboard de gestão de planos uma funcionalidade avançada
     * de dependência de cronograma com interface semelhante ao MS Project, permitindo que o
     * gestor estabeleça relações de dependência entre tarefas e planos diretamente na tela
     * principal.
     *
     * FUNCIONALIDADES IMPLEMENTADAS:
     *
     * 1. Interface de Seleção de Dependências:
     *    - Botão "Modo Dependência" para ativar a seleção visual
     *    - Seleção de tarefas com destaque visual
     *    - Modal para escolha do tipo de dependência (FS, SS, FF, SF)
     *    - Botão para visualizar dependências existentes
     *    - Clique direito para ver dependências de uma tarefa específica
     *
     * 2. Tipos de Dependência Suportados:
     *    - FS (Finish-to-Start): O sucessor começa após o predecessor terminar
     *    - SS (Start-to-Start): O sucessor começa ao mesmo tempo que o predecessor
     *    - FF (Finish-to-Finish): O sucessor termina ao mesmo tempo que o predecessor
     *    - SF (Start-to-Finish): O sucessor termina quando o predecessor começa
     *
     * 3. Recursos Visuais:
     *    - Linhas de dependência desenhadas com SVG no gráfico de Gantt
     *    - Cores diferentes para cada tipo de dependência
     *    - Setas indicando direção da dependência
     *    - Linhas tracejadas para melhor distinção
     *
     * 4. Cálculo Automático de Datas:
     *    - Recálculo automático das datas quando dependências são criadas
     *    - Consideração de tipos de dependência e atrasos (lag/lead)
     *    - Prevenção de ciclos com algoritmo de detecção
     *    - Atualização em tempo real do gráfico de Gantt
     *
     * 5. Gerenciamento de Dependências:
     *    - Adição e remoção de dependências
     *    - Visualização de todas as dependências existentes
     *    - Visualização de dependências por tarefa
     *    - Contador de dependências no botão de visualização
     *
     * 6. Integração com Backend:
     *    - Atualização automática das datas no backend
     *    - Persistência das dependências
     *
     * 7. Interface Avançada:
     *    - Painel de criação de dependências com seleção visual de tarefas
     *    - Interface intuitiva com ícones representativos para cada tipo de dependência
     *    - Validação visual dos vínculos criados
     *    - Feedback imediato sobre a integridade das dependências
     *    - Sistema de resolução de conflitos e dependências cíclicas
     *
     * COMO USAR:
     *
     * 1. Ative o "Modo Dependência" clicando no botão correspondente
     * 2. Clique em uma tarefa para selecioná-la (origem da dependência)
     * 3. Clique em outra tarefa para definir o destino da dependência
     * 4. Selecione o tipo de dependência no modal que aparece
     * 5. As datas serão recalculadas automaticamente e o gráfico atualizado
     *
     * Para visualizar dependências existentes, clique no botão "Ver Dependências"
     * Para ver as dependências de uma tarefa específica, clique com o botão direito
     * Para criar uma nova dependência usando a interface avançada, clique em "Nova Dependência"
     *
     * A funcionalidade garante uma gestão integrada e dinâmica entre múltiplos planos
     * de forma centralizada, como solicitado.
     */

    /**
     * Atualiza a posição do indicador de hoje no gráfico de Gantt
     */
    updateTodayIndicator() {
        const todayElement = document.getElementById('today-line');
        if (todayElement) {
            // Obter a posição calculada do atributo data
            const position = todayElement.getAttribute('data-today-position');
            if (position) {
                // Aplicar a posição com verificação de limites
                const container = document.querySelector('.gantt-main-container');
                if (container) {
                    // Calcular largura máxima permitida
                    const containerRect = container.getBoundingClientRect();
                    const maxLeft = containerRect.width;

                    // Extrair valor numérico da posição
                    const positionValue = parseFloat(position);

                    // Ajustar posição para não ultrapassar os limites
                    // Subtrair 2px para evitar overflow da linha
                    const clampedPosition = Math.max(250, Math.min(positionValue, maxLeft - 2));

                    todayElement.style.left = `${clampedPosition} px`;
                } else {
                    // Se não encontrar o container, aplicar a posição original
                    todayElement.style.left = position;
                }
            }
        }
    }

    /**
     * Adiciona suporte para dependências entre tarefas no Gantt
     * @param {Array} tasks - Array de tarefas
     * @param {Array} dependencies - Array de dependências
     * @returns {string} HTML das linhas de dependência
     */
    renderDependencies(tasks, dependencies) {
        // Esta função renderizaria as linhas de dependência entre tarefas
        // Implementação simplificada para mostrar a estrutura
        if (!dependencies || dependencies.length === 0) {
            return '';
        }

        // Exemplo de renderização de dependências (implementação futura)
        return dependencies.map(dep => `
            < div class="dependency-line" style = "position: absolute; height: 2px; background: #999; z-index: 1;"
        data - from="${dep.from}" data - to="${dep.to}" data - type="${dep.type}" ></div >
            `).join('');
    }

    /**
     * Adiciona funcionalidade para definir dependências entre tarefas
     * @param {string} taskIdFrom - ID da tarefa predecessora
     * @param {string} taskIdTo - ID da tarefa sucessora
     * @param {string} type - Tipo de dependência (FS, SS, FF, SF)
     * @param {number} lag - Atraso em dias entre as tarefas (pode ser negativo para lead)
     */
    addDependency(taskIdFrom, taskIdTo, type = 'FS', lag = 0) {
        // Armazenar dependências no estado ou em uma estrutura separada
        if (!state.dependencies) {
            state.dependencies = [];
        }

        // Verificar se a dependência já existe para evitar duplicatas
        const exists = state.dependencies.some(dep =>
            dep.from === taskIdFrom && dep.to === taskIdTo && dep.type === type && dep.lag === lag);

        if (exists) {
            showToast('Dependência já existe', 'warning');
            return false;
        }

        // Verificar se criar esta dependência causaria um ciclo (loop)
        if (this.wouldCreateCycle(taskIdFrom, taskIdTo)) {
            showToast('Esta dependência criaria um ciclo, o que não é permitido', 'error');
            return false;
        }

        // Adicionar nova dependência
        const newDependency = {
            from: taskIdFrom,
            to: taskIdTo,
            type: type, // FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
            lag: lag, // Atraso em dias (pode ser negativo para lead)
            createdAt: new Date()
        };

        state.dependencies.push(newDependency);

        // Recalcular datas automaticamente após adicionar a dependência
        this.calculateDependencies();
        this.updateGanttChart(state.plans);

        showToast('Dependência adicionada com sucesso', 'success');

        // Atualizar as dependências visuais no gráfico
        this.updateGanttDependencies();

        return true;
    }

    /**
     * Verifica se adicionar uma dependência criaria um ciclo no grafo de dependências
     * @param {string} fromId - ID da tarefa predecessora
     * @param {string} toId - ID da tarefa sucessora
     * @returns {boolean} - Verdadeiro se a dependência criaria um ciclo
     */
    wouldCreateCycle(fromId, toId) {
        // Usar busca em profundidade para detectar ciclos
        const visited = new Set();
        const recStack = new Set();

        // Adicionar temporariamente a nova dependência para testar
        const tempDependency = { from: fromId, to: toId };
        const allDeps = [...(state.dependencies || []), tempDependency];

        // Função auxiliar para DFS
        function dfs(node, dependencies) {
            if (!recStack.has(node)) {
                if (visited.has(node)) return false;

                visited.add(node);
                recStack.add(node);

                // Encontrar todos os nós que dependem deste
                const dependents = dependencies.filter(dep => dep.from === node).map(dep => dep.to);

                for (const dependent of dependents) {
                    if (recStack.has(dependent) || dfs(dependent, dependencies)) {
                        return true;
                    }
                }
            }
            recStack.delete(node);
            return false;
        }

        return dfs(toId, allDeps);
    }

    /**
     * Calcula os impactos das dependências nas datas dos planos
     * Implementa o cálculo de datas baseado nas dependências
     */
    calculateDependencies() {
        if (!state.dependencies || state.dependencies.length === 0) return;

        // Criar um mapa de dependências para facilitar o cálculo
        const dependencyMap = {};
        state.dependencies.forEach(dep => {
            if (!dependencyMap[dep.to]) dependencyMap[dep.to] = [];
            dependencyMap[dep.to].push(dep);
        });

        // Ordenar os planos por dependências para calcular corretamente
        const sortedPlans = this.topologicalSort(state.plans, state.dependencies);

        // Calcular as datas com base nas dependências
        for (const planId of sortedPlans) {
            const plan = state.plans.find(p => p.id === planId);
            if (!plan) continue;

            // Verificar se este plano tem dependências que o afetam
            const incomingDeps = state.dependencies.filter(dep => dep.to === planId);

            if (incomingDeps.length > 0) {
                // Calcular a nova data com base nas dependências
                const maxStartDate = this.calculateMaxStartDateFromDependencies(incomingDeps, plan);

                // Atualizar a data do plano se necessário
                if (maxStartDate) {
                    const currentStartDate = new Date(extractScheduleDate(plan.schedule));
                    if (maxStartDate > currentStartDate) {
                        // Atualizar a data do plano para respeitar a dependência
                        const newSchedule = { ...plan.schedule };

                        // Atualizar a data de início
                        if (newSchedule.start) {
                            newSchedule.start = maxStartDate.toISOString().split('T')[0];
                        } else if (newSchedule.startDate) {
                            newSchedule.startDate = maxStartDate.toISOString().split('T')[0];
                        } else {
                            // Se não tiver formato conhecido, criar um objeto padrão
                            newSchedule.start = maxStartDate.toISOString().split('T')[0];
                        }

                        // Atualizar o plano com o novo schedule
                        const planIndex = state.plans.findIndex(p => p.id === planId);
                        if (planIndex !== -1) {
                            state.plans[planIndex].schedule = newSchedule;

                            // Atualizar o plano no backend também
                            if (state.apiService && state.apiService.updatePlan) {
                                state.apiService.updatePlan(planId, { schedule: newSchedule })
                                    .catch(error => {
                                        console.error('Erro ao atualizar plano no backend:', error);
                                    });
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Calcula a data de início máxima com base nas dependências
     * @param {Array} dependencies - Array de dependências que afetam o plano
     * @param {Object} plan - O plano alvo
     * @returns {Date|null} - A data de início calculada ou null se não houver dependências
     */
    calculateMaxStartDateFromDependencies(dependencies, plan) {
        let maxStartDate = null;

        for (const dep of dependencies) {
            const predecessorPlan = state.plans.find(p => p.id === dep.from);
            if (!predecessorPlan) continue;

            const predecessorStartDate = new Date(extractScheduleDate(predecessorPlan.schedule));
            const predecessorEndDate = this.getPlanEndDate(predecessorPlan);
            if (!predecessorStartDate || !predecessorEndDate) continue;

            let newStartDate = new Date();

            // Aplicar o tipo de dependência
            switch (dep.type) {
                case 'FS': // Finish-to-Start: o sucessor começa após o predecessor terminar
                    newStartDate = new Date(predecessorEndDate);
                    newStartDate.setDate(newStartDate.getDate() + 1 + dep.lag);
                    break;
                case 'SS': // Start-to-Start: o sucessor começa ao mesmo tempo que o predecessor
                    newStartDate = new Date(predecessorStartDate);
                    newStartDate.setDate(newStartDate.getDate() + dep.lag);
                    break;
                case 'FF': // Finish-to-Finish: o sucessor termina ao mesmo tempo que o predecessor
                    const planDuration = this.getPlanDuration(plan);
                    newStartDate = new Date(predecessorEndDate);
                    newStartDate.setDate(newStartDate.getDate() - planDuration + dep.lag);
                    break;
                case 'SF': // Start-to-Finish: o sucessor termina quando o predecessor começa
                    const planDurationSF = this.getPlanDuration(plan);
                    newStartDate = new Date(predecessorStartDate);
                    newStartDate.setDate(newStartDate.getDate() - planDurationSF + dep.lag);
                    break;
            }

            // Atualizar a data máxima se esta for maior
            if (!maxStartDate || newStartDate > maxStartDate) {
                maxStartDate = newStartDate;
            }
        }

        return maxStartDate;
    }

    /**
     * Obtém a data de término de um plano
     * @param {Object} plan - O plano para obter a data de término
     * @returns {Date|null} - A data de término ou null se não disponível
     */
    getPlanEndDate(plan) {
        const startDateStr = extractScheduleDate(plan.schedule);
        if (!startDateStr) return null;

        const startDate = new Date(startDateStr);
        const duration = this.getPlanDuration(plan);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);

        return endDate;
    }

    /**
     * Obtém a duração de um plano em dias
     * @param {Object} plan - O plano para obter a duração
     * @returns {number} - A duração em dias
     */
    getPlanDuration(plan) {
        if (plan.durations) {
            return (plan.durations.mobilization || 0) +
                (plan.durations.execution || 0) +
                (plan.durations.demobilization || 0);
        }
        return 1; // Padrão: 1 dia se não houver duração definida
    }

    /**
     * Recalcula automaticamente as datas de todos os planos com base nas dependências
     */
    recalculateAllPlanDates() {
        if (!state.dependencies || state.dependencies.length === 0) {
            // Se não houver dependências, manter as datas originais
            showToast('Nenhuma dependência para recalcular', 'info');
            return;
        }

        // Fazer uma cópia dos planos originais para cálculo
        const originalPlans = JSON.parse(JSON.stringify(state.plans));

        // Recalcular as datas com base nas dependências
        this.calculateDependencies();

        // Atualizar o gráfico de Gantt
        this.updateGanttChart(state.plans);

        // Atualizar as dependências visuais
        this.updateGanttDependencies();

        showToast('Datas recalculadas com base nas dependências', 'success');
    }

    /**
     * Função para testar a funcionalidade de dependências
     */
    testDependencyFunctionality() {
        // Criar dependências de teste se não existirem
        if (!state.dependencies) {
            state.dependencies = [];
        }

        // Verificar se já existem dependências de teste
        const hasTestDeps = state.dependencies.some(dep => dep.from && dep.to);

        if (!hasTestDeps && state.plans && state.plans.length >= 2) {
            // Criar algumas dependências de teste entre os primeiros planos
            const plan1 = state.plans[0];
            const plan2 = state.plans[1];

            // Verificar se os planos têm IDs válidos
            if (plan1 && plan2 && plan1.id && plan2.id) {
                // Adicionar dependência de teste
                this.addDependency(plan1.id, plan2.id, 'FS', 1); // Finish-to-Start com 1 dia de atraso

                showToast(`Dependência de teste criada: ${plan1.id} → ${plan2.id}`, 'success');
            } else {
                showToast('Não foi possível criar dependência de teste - IDs inválidos', 'error');
            }
        } else {
            showToast('Dependências de teste já existem ou não há planos suficientes', 'info');
        }
    }

    /**
     * Ordenação topológica para processar dependências sem ciclos
     * @param {Array} plans - Array de planos
     * @param {Array} dependencies - Array de dependências
     * @returns {Array} - Array ordenado de IDs de planos
     */
    topologicalSort(plans, dependencies) {
        const graph = {};
        const inDegree = {};

        // Inicializar grafos
        plans.forEach(plan => {
            const id = plan.id;
            graph[id] = [];
            inDegree[id] = 0;
        });

        // Construir o grafo e calcular graus de entrada
        dependencies.forEach(dep => {
            if (graph[dep.from] && graph[dep.to]) {
                graph[dep.from].push(dep.to);
                inDegree[dep.to]++;
            }
        });

        // Encontrar nós com grau de entrada 0
        const queue = [];
        for (const id in inDegree) {
            if (inDegree[id] === 0) {
                queue.push(id);
            }
        }

        const result = [];
        while (queue.length > 0) {
            const current = queue.shift();
            result.push(current);

            // Reduzir o grau de entrada dos vizinhos
            graph[current].forEach(neighbor => {
                inDegree[neighbor]--;
                if (inDegree[neighbor] === 0) {
                    queue.push(neighbor);
                }
            });
        }

        // Verificar se há ciclos
        if (result.length !== Object.keys(graph).length) {
            console.error('Ciclo detectado no grafo de dependências');
            return plans.map(p => p.id); // Retornar ordem original em caso de ciclo
        }

        return result;
    }

    /**
     * Remove uma dependência existente
     * @param {string} taskIdFrom - ID da tarefa predecessora
     * @param {string} taskIdTo - ID da tarefa sucessora
     */
    removeDependency(taskIdFrom, taskIdTo) {
        if (!state.dependencies) return;

        const initialLength = state.dependencies.length;
        state.dependencies = state.dependencies.filter(dep =>
            !(dep.from === taskIdFrom && dep.to === taskIdTo));

        if (state.dependencies.length < initialLength) {
            // Recalcular após remoção
            this.calculateDependencies();
            this.updateGanttChart(state.plans);
            showToast('Dependência removida com sucesso', 'success');

            // Atualizar as dependências visuais no gráfico
            this.updateGanttDependencies();
        } else {
            showToast('Dependência não encontrada', 'warning');
        }
    }

    /**
     * Obtém todas as dependências de um plano específico
     * @param {string} planId - ID do plano
     * @returns {Array} - Array de dependências
     */
    getDependenciesForPlan(planId) {
        if (!state.dependencies) return [];
        return state.dependencies.filter(dep => dep.from === planId || dep.to === planId);
    }

    /**
     * Obtém as dependências de entrada para um plano (planos que afetam este)
     * @param {string} planId - ID do plano
     * @returns {Array} - Array de dependências de entrada
     */
    getIncomingDependencies(planId) {
        if (!state.dependencies) return [];
        return state.dependencies.filter(dep => dep.to === planId);
    }

    /**
     * Obtém as dependências de saída para um plano (planos afetados por este)
     * @param {string} planId - ID do plano
     * @returns {Array} - Array de dependências de saída
     */
    getOutgoingDependencies(planId) {
        if (!state.dependencies) return [];
        return state.dependencies.filter(dep => dep.from === planId);
    }

    /**
     * Renderiza linhas de dependência entre tarefas no gráfico de Gantt
     * @param {Array} tasks - Array de tarefas
     * @param {Array} dependencies - Array de dependências
     * @returns {string} HTML das linhas de dependência
     */
    renderGanttDependencies(tasks, dependencies) {
        if (!dependencies || dependencies.length === 0) {
            return '';
        }

        // Mapear tarefas por ID para facilitar o acesso
        const taskMap = {};
        tasks.forEach((task, index) => {
            taskMap[task.id] = { task, index };
        });

        // Obter os elementos do DOM para cálculo de posição
        const container = document.getElementById('gantt-chart-container');
        if (!container) {
            return '';
        }

        // Obter informações de dimensionamento do gráfico
        const minDate = new Date(Math.min(...tasks.map(task => task.start_date)));
        const maxDate = new Date(Math.max(...tasks.map(task => task.end_date)));
        minDate.setDate(minDate.getDate() - 2);
        maxDate.setDate(maxDate.getDate() + 2);
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
        const dayWidth = 40; // pixels por dia

        // Gerar linhas de dependência SVG
        let svgLines = '<svg class="gantt-dependency-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2;">';

        for (const dep of dependencies) {
            if (!taskMap[dep.from] || !taskMap[dep.to]) {
                continue; // Ignorar dependências com tarefas inexistentes
            }

            const fromTask = taskMap[dep.from].task;
            const toTask = taskMap[dep.to].task;
            const fromIndex = taskMap[dep.from].index;
            const toIndex = taskMap[dep.to].index;

            // Calcular posições das tarefas
            const fromStartOffset = Math.max(0, Math.floor((fromTask.start_date - minDate) / (1000 * 60 * 60 * 24)));
            const fromDuration = Math.ceil((fromTask.end_date - fromTask.start_date) / (1000 * 60 * 60 * 24));
            const fromLeftPos = fromStartOffset * dayWidth;
            const fromBarWidth = Math.max(20, fromDuration * dayWidth);

            const toStartOffset = Math.max(0, Math.floor((toTask.start_date - minDate) / (1000 * 60 * 60 * 24)));
            const toDuration = Math.ceil((toTask.end_date - toTask.start_date) / (1000 * 60 * 60 * 24));
            const toLeftPos = toStartOffset * dayWidth;
            const toBarWidth = Math.max(20, toDuration * dayWidth);

            // Calcular posições X (tempo) e Y (tarefas)
            // Considerar o offset de 250px para o nome da tarefa
            const fromX = fromLeftPos + fromBarWidth; // Final da barra de origem
            const toX = toLeftPos; // Início da barra de destino
            const fromY = 60 + fromIndex * 55 + 12; // Posição vertical da tarefa de origem (centro da barra)
            const toY = 60 + toIndex * 55 + 12; // Posição vertical da tarefa de destino (centro da barra)

            // Desenhar linha de dependência com curva suave
            let path;
            if (fromIndex === toIndex) {
                // Dependência na mesma linha - desenhar uma curva pequena
                path = `M ${fromX + 250} ${fromY} C ${fromX + 250 + 50} ${fromY}, ${toX + 250 - 50} ${toY}, ${toX + 250} ${toY}`;
            } else if (fromIndex < toIndex) {
                // Dependência para baixo - desenhar uma curva com um caminho intermediário
                const midX = fromX + 250 + Math.abs(toX - fromX) / 2;
                const midY = fromY + Math.abs(toY - fromY) / 2;
                path = `M ${fromX + 250} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX + 250} ${toY}`;
            } else {
                // Dependência para cima - desenhar uma curva com um caminho intermediário
                const midX = fromX + 250 + Math.abs(toX - fromX) / 2;
                path = `M ${fromX + 250} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX + 250} ${toY}`;
            }

            // Definir cor com base no tipo de dependência
            let color;
            switch (dep.type) {
                case 'FS': // Finish-to-Start (padrão)
                    color = '#2196F3'; // Azul
                    break;
                case 'SS': // Start-to-Start
                    color = '#FF9800'; // Laranja
                    break;
                case 'FF': // Finish-to-Finish
                    color = '#4CAF50'; // Verde
                    break;
                case 'SF': // Start-to-Finish
                    color = '#9C27B0'; // Roxo
                    break;
                default:
                    color = '#2196F3'; // Azul padrão
            }

            svgLines += `<path d="${path}" stroke="${color}" stroke-width="2" fill="none" stroke-dasharray="5,5" marker-end="url(#arrowhead-${dep.type})" />`;
        }

        svgLines += `
            <!-- Definições de marcadores (setas) -->
            <defs>
                <marker id="arrowhead-FS" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#2196F3" />
                </marker>
                <marker id="arrowhead-SS" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#FF9800" />
                </marker>
                <marker id="arrowhead-FF" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#4CAF50" />
                </marker>
                <marker id="arrowhead-SF" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#9C27B0" />
                </marker>
            </defs>
        `;

        svgLines += '</svg>';

        return svgLines;
    }

    /**
     * Atualiza a renderização das dependências no gráfico de Gantt
     */
    updateGanttDependencies() {
        // Esta função atualiza visualmente as dependências no gráfico
        // quando o usuário adiciona ou remove dependências
        if (state.dependencies && state.dependencies.length > 0) {
            // Obter o container de dependências
            const dependenciesContainer = document.getElementById('gantt-dependencies-container');
            if (dependenciesContainer) {
                // Converter planos para o formato necessário para o Gantt
                const ganttTasks = state.plans.map((plan, index) => {
                    const scheduleDate = extractScheduleDate(plan.schedule);
                    const daysUntil = this.getDaysUntilExecution(plan.schedule);
                    const urgencyConfig = this.getUrgencyBadgeConfig(daysUntil);

                    // Determinar a data de início e término com base na duração prevista
                    const startDate = scheduleDate ? new Date(scheduleDate) : new Date();
                    const endDate = new Date(startDate);

                    // Adicionar dias baseado na duração se disponível
                    if (plan.durations) {
                        const totalDays = (plan.durations.mobilization || 0) +
                            (plan.durations.execution || 0) +
                            (plan.durations.demobilization || 0);
                        endDate.setDate(endDate.getDate() + totalDays);
                    } else {
                        // Padrão: 1 dia se não houver duração definida
                        endDate.setDate(endDate.getDate() + 1);
                    }

                    return {
                        id: plan.id,
                        start_date: startDate,
                        end_date: endDate,
                        plan: plan
                    };
                });

                // Renderizar as dependências
                const dependenciesHtml = this.renderGanttDependencies(ganttTasks, state.dependencies);
                dependenciesContainer.innerHTML = dependenciesHtml;
            }
        } else {
            // Se não houver dependências, limpar o container
            const dependenciesContainer = document.getElementById('gantt-dependencies-container');
            if (dependenciesContainer) {
                dependenciesContainer.innerHTML = '';
            }
        }
    }

    /**
     * Habilita a interação para adicionar dependências entre tarefas no Gantt
     */
    enableDependencySelection() {
        console.log('[enableDependencySelection] Iniciando configuração de seleção de dependências');

        // Adiciona eventos de clique para selecionar tarefas e criar dependências
        const ganttBars = $$('.gantt-bar');
        console.log(`[enableDependencySelection] Encontradas ${ganttBars.length} barras no Gantt`);

        let selectedTask = null;
        let dependencyMode = false;

        // Função para ativar o modo de dependência
        const activateDependencyMode = () => {
            dependencyMode = true;
            console.log('[enableDependencySelection] Modo de dependência ATIVADO');
            showToast('Modo de dependência ativado. Clique em uma tarefa para selecionar, depois clique em outra para criar uma dependência.', 'info');

            // Adicionar indicador visual de modo de dependência
            const ganttContainer = $('#gantt-chart-container');
            if (ganttContainer) {
                let indicator = document.getElementById('dependency-mode-indicator');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.id = 'dependency-mode-indicator';
                    indicator.innerHTML = `
                        <div style="position: absolute; top: 10px; right: 10px; background: #2196F3; color: white; padding: 5px 10px; border-radius: 4px; z-index: 100; font-size: 0.8em;">
                            Modo Dependência Ativo
                        </div>
                    `;
                    ganttContainer.appendChild(indicator);
                }
            }
        };

        // Função para desativar o modo de dependência
        const deactivateDependencyMode = () => {
            dependencyMode = false;
            selectedTask = null;
            console.log('[enableDependencySelection] Modo de dependência DESATIVADO');

            // Remover destaque das tarefas
            const allBars = $$('.gantt-bar');
            allBars.forEach(bar => {
                bar.style.border = '';
                bar.style.boxSizing = '';
                bar.style.cursor = '';
            });

            // Remover indicador visual
            const indicator = document.getElementById('dependency-mode-indicator');
            if (indicator) {
                indicator.remove();
            }
        };

        // Adicionar botão para ativar o modo de dependência
        const ganttContainer = $('#gantt-chart-container');
        if (ganttContainer) {
            console.log('[enableDependencySelection] Container do Gantt encontrado, criando botões...');

            // Remover botão existente se houver
            let oldBtn = document.getElementById('dependency-mode-btn');
            if (oldBtn) oldBtn.remove();

            let dependencyBtn = document.createElement('button');
            dependencyBtn.id = 'dependency-mode-btn';
            dependencyBtn.innerHTML = '🔗 Modo Dependência';
            dependencyBtn.className = 'btn btn-secondary btn-sm';
            dependencyBtn.style.cssText = `
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 100;
                background: #2196F3;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8em;
                font-weight: 500;
            `;

            dependencyBtn.addEventListener('click', () => {
                if (dependencyMode) {
                    deactivateDependencyMode();
                } else {
                    activateDependencyMode();
                }
            });

            ganttContainer.appendChild(dependencyBtn);
            console.log('[enableDependencySelection] Botão "Modo Dependência" criado e adicionado');
        } else {
            console.warn('[enableDependencySelection] Container do Gantt NÃO encontrado!');
        }


        // Adicionar botão para visualizar dependências existentes
        if (ganttContainer) {
            // Remover botão existente se houver
            let oldViewBtn = document.getElementById('view-dependencies-btn');
            if (oldViewBtn) oldViewBtn.remove();

            if (state.dependencies && state.dependencies.length > 0) {
                let viewDepsBtn = document.createElement('button');
                viewDepsBtn.id = 'view-dependencies-btn';
                viewDepsBtn.innerHTML = `📋 Ver Dependências (${state.dependencies.length})`;
                viewDepsBtn.className = 'btn btn-secondary btn-sm';
                viewDepsBtn.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 170px;
                    z-index: 100;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8em;
                    font-weight: 500;
                `;

                viewDepsBtn.addEventListener('click', () => {
                    this.showDependenciesList();
                });

                ganttContainer.appendChild(viewDepsBtn);
                console.log('[enableDependencySelection] Botão "Ver Dependências" criado');
            }

            // Remover botão existente se houver
            let oldCreateBtn = document.getElementById('create-dependencies-btn');
            if (oldCreateBtn) oldCreateBtn.remove();

            // Adicionar botão para criar nova dependência com interface avançada
            let createDepsBtn = document.createElement('button');
            createDepsBtn.id = 'create-dependencies-btn';
            createDepsBtn.innerHTML = '➕ Nova Dependência';
            createDepsBtn.className = 'btn btn-primary btn-sm';
            createDepsBtn.style.cssText = `
                position: absolute;
                top: 10px;
                left: ${state.dependencies && state.dependencies.length > 0 ? '350px' : '170px'};
                z-index: 100;
                background: #FF9800;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8em;
                font-weight: 500;
            `;

            createDepsBtn.addEventListener('click', () => {
                this.showAdvancedDependencyCreation();
            });

            ganttContainer.appendChild(createDepsBtn);
            console.log('[enableDependencySelection] Botão "Nova Dependência" criado');
        }

        ganttBars.forEach(bar => {
            // Adicionar estilo de cursor quando no modo de dependência
            bar.addEventListener('mouseenter', () => {
                if (dependencyMode) {
                    bar.style.cursor = 'pointer';
                }
            });

            bar.addEventListener('mouseleave', () => {
                if (dependencyMode) {
                    bar.style.cursor = 'pointer';
                }
            });

            bar.addEventListener('click', (e) => {
                if (!dependencyMode) return; // Só funciona no modo de dependência

                e.stopPropagation();
                const taskId = bar.getAttribute('data-task-id');

                if (!selectedTask) {
                    // Primeira seleção
                    selectedTask = taskId;
                    bar.style.border = '3px solid #000';
                    bar.style.boxSizing = 'border-box';
                    showToast(`Tarefa selecionada: ${taskId}. Agora selecione a tarefa dependente.`, 'info');
                } else if (selectedTask === taskId) {
                    // Desselecionar a mesma tarefa
                    bar.style.border = '';
                    selectedTask = null;
                    showToast('Seleção cancelada', 'info');
                } else {
                    // Criar dependência entre as tarefas
                    // Mostrar opções de tipo de dependência
                    this.showDependencyTypeSelection(selectedTask, taskId, () => {
                        // Remover destaque das tarefas após criar a dependência
                        const firstTaskBar = document.querySelector(`.gantt-bar[data-task-id="${selectedTask}"]`);
                        if (firstTaskBar) {
                            firstTaskBar.style.border = '';
                        }
                        bar.style.border = '3px solid #4CAF50';
                        bar.style.boxSizing = 'border-box';
                        selectedTask = null;
                    });
                }
            });

            // Adicionar evento de contexto (clique direito) para visualizar dependências de uma tarefa
            bar.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const taskId = bar.getAttribute('data-task-id');
                this.showTaskDependencies(taskId);
            });
        });

        // Adicionar evento para desfazer seleção ao clicar fora (quando não está no modo de dependência)
        document.addEventListener('click', (e) => {
            if (!dependencyMode) return;

            if (!e.target.closest('.gantt-bar') && !e.target.closest('#dependency-mode-btn')) {
                const selectedBars = $$('.gantt-bar[style*="border: 3px solid"]');
                selectedBars.forEach(bar => {
                    bar.style.border = '';
                    bar.style.boxSizing = '';
                });
                selectedTask = null;
            }
        });
    }

    /**
     * Mostra interface avançada para criação de dependências
     */
    showAdvancedDependencyCreation() {
        // Criar modal com interface avançada para criação de dependências
        const modal = document.createElement('div');
        modal.id = 'advanced-dependency-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 500px; max-width: 700px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                        <h3 style="margin: 0; color: #333;">➕ Criar Nova Dependência</h3>
                        <button id="close-advanced-deps" style="background: #f44336; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: bold;">×</button>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tarefa Predecessora:</label>
                        <select id="from-task-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Selecione uma tarefa...</option>
                            ${state.plans.map(plan => {
            const readableId = plan.id.startsWith('PI-') ? plan.id : `PI-${new Date().getFullYear()}-${String(plan.id).padStart(3, '0')}`;
            return `<option value="${plan.id}">${readableId} - ${plan.interventionType}</option>`;
        }).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo de Dependência:</label>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="dependency-type-option" data-type="FS" style="padding: 10px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <div style="font-size: 1.2em; margin-bottom: 5px;">🏁→</div>
                                <div><strong>FS</strong><br><small>Finish-to-Start</small></div>
                            </div>
                            <div class="dependency-type-option" data-type="SS" style="padding: 10px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <div style="font-size: 1.2em; margin-bottom: 5px;">▶️→</div>
                                <div><strong>SS</strong><br><small>Start-to-Start</small></div>
                            </div>
                            <div class="dependency-type-option" data-type="FF" style="padding: 10px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <div style="font-size: 1.2em; margin-bottom: 5px;">🏁→🏁</div>
                                <div><strong>FF</strong><br><small>Finish-to-Finish</small></div>
                            </div>
                            <div class="dependency-type-option" data-type="SF" style="padding: 10px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <div style="font-size: 1.2em; margin-bottom: 5px;">▶️→🏁</div>
                                <div><strong>SF</strong><br><small>Start-to-Finish</small></div>
                            </div>
                        </div>
                        <input type="hidden" id="selected-dependency-type" value="FS">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Atraso (dias):</label>
                        <input type="number" id="dependency-lag" value="0" min="-30" max="30" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <div style="font-size: 0.8em; color: #666; margin-top: 5px;">Valores negativos indicam lead (adiantamento), positivos indicam lag (atraso)</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tarefa Sucessora:</label>
                        <select id="to-task-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Selecione uma tarefa...</option>
                            ${state.plans.map(plan => {
            const readableId = plan.id.startsWith('PI-') ? plan.id : `PI-${new Date().getFullYear()}-${String(plan.id).padStart(3, '0')}`;
            return `<option value="${plan.id}">${readableId} - ${plan.interventionType}</option>`;
        }).join('')}
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="create-dependency-btn" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Criar Dependência</button>
                        <button id="cancel-advanced-deps" style="flex: 1; background: #f44336; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Adicionar eventos para seleção de tipo de dependência
        const typeOptions = modal.querySelectorAll('.dependency-type-option');
        typeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                // Remover seleção de todos
                typeOptions.forEach(opt => {
                    opt.style.borderColor = '#ddd';
                    opt.style.backgroundColor = '#fff';
                });

                // Adicionar seleção ao atual
                option.style.borderColor = '#2196F3';
                option.style.backgroundColor = '#e3f2fd';

                // Atualizar o tipo selecionado
                const type = option.getAttribute('data-type');
                document.getElementById('selected-dependency-type').value = type;
            });
        });

        // Selecionar o primeiro tipo por padrão
        if (typeOptions[0]) {
            typeOptions[0].click();
        }

        // Adicionar evento de criação de dependência
        const createBtn = modal.querySelector('#create-dependency-btn');
        createBtn.addEventListener('click', () => {
            const fromTaskId = document.getElementById('from-task-select').value;
            const toTaskId = document.getElementById('to-task-select').value;
            const type = document.getElementById('selected-dependency-type').value;
            const lag = parseInt(document.getElementById('dependency-lag').value) || 0;

            if (!fromTaskId || !toTaskId) {
                showToast('Selecione ambas as tarefas', 'error');
                return;
            }

            if (fromTaskId === toTaskId) {
                showToast('A tarefa predecessora e sucessora não podem ser a mesma', 'error');
                return;
            }

            // Validar se a dependência criaria um ciclo
            if (this.wouldCreateCycle(fromTaskId, toTaskId)) {
                showToast('Esta dependência criaria um ciclo, o que não é permitido', 'error');
                return;
            }

            // Criar a dependência
            this.addDependency(fromTaskId, toTaskId, type, lag);
            document.body.removeChild(modal);
        });

        // Adicionar eventos de fechamento
        const closeBtn = modal.querySelector('#close-advanced-deps');
        const cancelBtn = modal.querySelector('#cancel-advanced-deps');
        const closeButtons = [closeBtn, cancelBtn];
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });
    }

    /**
     * Mostra opções de tipo de dependência para o usuário
     * @param {string} fromTaskId - ID da tarefa predecessora
     * @param {string} toTaskId - ID da tarefa sucessora
     * @param {function} callback - Função a ser chamada após criar a dependência
     */
    showDependencyTypeSelection(fromTaskId, toTaskId, callback) {
        // Criar um modal para seleção do tipo de dependência
        const modal = document.createElement('div');
        modal.id = 'dependency-type-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 300px; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">Tipo de Dependência</h3>
                    <p>Selecione o tipo de dependência entre as tarefas:</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                        <button class="dependency-type-btn" data-type="FS" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: #f9f9f9; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 1.5em; margin-bottom: 5px;">🏁→</div>
                            <strong>FS</strong><br>
                            <small>Finish-to-Start</small>
                        </button>
                        <button class="dependency-type-btn" data-type="SS" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: #f9f9f9; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 1.5em; margin-bottom: 5px;">▶️→</div>
                            <strong>SS</strong><br>
                            <small>Start-to-Start</small>
                        </button>
                        <button class="dependency-type-btn" data-type="FF" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: #f9f9f9; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 1.5em; margin-bottom: 5px;">🏁→🏁</div>
                            <strong>FF</strong><br>
                            <small>Finish-to-Finish</small>
                        </button>
                        <button class="dependency-type-btn" data-type="SF" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: #f9f9f9; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 1.5em; margin-bottom: 5px;">▶️→🏁</div>
                            <strong>SF</strong><br>
                            <small>Start-to-Finish</small>
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="cancel-dependency" style="flex: 1; background: #f44336; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Adicionar eventos aos botões
        const typeButtons = modal.querySelectorAll('.dependency-type-btn');
        typeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.getAttribute('data-type') || e.target.parentElement.getAttribute('data-type');
                this.addDependency(fromTaskId, toTaskId, type);
                document.body.removeChild(modal);
                if (callback) callback();
            });

            // Adicionar efeito hover
            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = '#2196F3';
                btn.style.backgroundColor = '#e3f2fd';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.borderColor = '#ddd';
                btn.style.backgroundColor = '#f9f9f9';
            });
        });

        // Adicionar evento de cancelamento
        const cancelBtn = modal.querySelector('#cancel-dependency');
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    /**
     * Mostra lista de todas as dependências existentes
     */
    showDependenciesList() {
        if (!state.dependencies || state.dependencies.length === 0) {
            showToast('Nenhuma dependência criada', 'info');
            return;
        }

        // Criar modal com lista de dependências
        const modal = document.createElement('div');
        modal.id = 'dependencies-list-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 600px; max-width: 900px; max-height: 85vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                        <h3 style="margin: 0; color: #333;">🔗 Gerenciador de Dependências</h3>
                        <button id="close-deps-list" style="background: #f44336; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: bold;">×</button>
                    </div>
                    <div style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px; border-left: 4px solid #2196F3;">
                        <strong>Total de dependências:</strong> ${state.dependencies.length}
                    </div>
                    <div id="dependencies-list-content">
                        ${state.dependencies.map(dep => {
            const fromPlan = state.plans.find(p => p.id === dep.from);
            const toPlan = state.plans.find(p => p.id === dep.to);
            const fromName = fromPlan ? `${fromPlan.id} - ${fromPlan.interventionType}` : dep.from;
            const toName = toPlan ? `${toPlan.id} - ${toPlan.interventionType}` : dep.to;

            // Determinar cor e ícone com base no tipo de dependência
            let typeInfo = { color: '#2196F3', icon: '🏁→', label: 'Finish-to-Start' };
            switch (dep.type) {
                case 'FS':
                    typeInfo = { color: '#2196F3', icon: '🏁→', label: 'Finish-to-Start' };
                    break;
                case 'SS':
                    typeInfo = { color: '#FF9800', icon: '▶️→', label: 'Start-to-Start' };
                    break;
                case 'FF':
                    typeInfo = { color: '#4CAF50', icon: '🏁→🏁', label: 'Finish-to-Finish' };
                    break;
                case 'SF':
                    typeInfo = { color: '#9C27B0', icon: '▶️→🏁', label: 'Start-to-Finish' };
                    break;
            }

            return `
                                <div class="dependency-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee; transition: background-color 0.2s;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                            <span style="font-weight: bold; color: #333;">${fromName}</span>
                                            <span style="color: ${typeInfo.color}; font-size: 1.2em;">${typeInfo.icon}</span>
                                            <span style="font-weight: bold; color: #333;">${toName}</span>
                                        </div>
                                        <div style="display: flex; gap: 15px; font-size: 0.85em; color: #666;">
                                            <span style="background: ${typeInfo.color}20; padding: 2px 6px; border-radius: 3px;">${typeInfo.label}</span>
                                            <span>Atraso: ${dep.lag}d</span>
                                            <span>Criado: ${new Date(dep.createdAt).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                    </div>
                                    <button class="remove-dependency-btn" data-from="${dep.from}" data-to="${dep.to}"
                                        style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                                        <i class="fas fa-trash"></i> Remover
                                    </button>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Adicionar evento de fechamento
        const closeBtn = modal.querySelector('#close-deps-list');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Adicionar eventos para remover dependências
        const removeBtns = modal.querySelectorAll('.remove-dependency-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fromId = e.target.closest('.remove-dependency-btn').getAttribute('data-from');
                const toId = e.target.closest('.remove-dependency-btn').getAttribute('data-to');
                this.removeDependency(fromId, toId);

                // Atualizar a lista
                this.showDependenciesList();
            });
        });
    }

    /**
     * Mostra as dependências de uma tarefa específica
     * @param {string} taskId - ID da tarefa
     */
    showTaskDependencies(taskId) {
        const incomingDeps = this.getIncomingDependencies(taskId);
        const outgoingDeps = this.getOutgoingDependencies(taskId);

        if (incomingDeps.length === 0 && outgoingDeps.length === 0) {
            showToast('Esta tarefa não tem dependências', 'info');
            return;
        }

        // Obter informações da tarefa atual
        const currentPlan = state.plans.find(p => p.id === taskId);
        const currentPlanName = currentPlan ? `${currentPlan.id} - ${currentPlan.interventionType}` : taskId;

        // Criar modal com dependências da tarefa
        const modal = document.createElement('div');
        modal.id = 'task-dependencies-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 500px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                        <h3 style="margin: 0; color: #333;">🔗 Dependências: ${currentPlanName}</h3>
                        <button id="close-task-deps" style="background: #f44336; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: bold;">×</button>
                    </div>
                    <div>
                        ${incomingDeps.length > 0 ? `
                        <div style="margin-bottom: 20px;">
                            <h4 style="color: #f44336; margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-arrow-down"></i> Dependências de Entrada (Predecessoras)
                            </h4>
                            <div style="background: #fff5f5; border-radius: 6px; padding: 10px;">
                                ${incomingDeps.map(dep => {
            const fromPlan = state.plans.find(p => p.id === dep.from);
            const fromName = fromPlan ? `${fromPlan.id} - ${fromPlan.interventionType}` : dep.from;

            // Determinar ícone e cor com base no tipo de dependência
            let typeInfo = { color: '#2196F3', icon: '🏁→', label: 'FS' };
            switch (dep.type) {
                case 'FS':
                    typeInfo = { color: '#2196F3', icon: '🏁→', label: 'FS' };
                    break;
                case 'SS':
                    typeInfo = { color: '#FF9800', icon: '▶️→', label: 'SS' };
                    break;
                case 'FF':
                    typeInfo = { color: '#4CAF50', icon: '🏁→🏁', label: 'FF' };
                    break;
                case 'SF':
                    typeInfo = { color: '#9C27B0', icon: '▶️→🏁', label: 'SF' };
                    break;
            }

            return `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #ffebee; background: white; border-radius: 4px; margin-bottom: 5px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="color: ${typeInfo.color}; font-weight: bold;">${typeInfo.icon}</span>
                                                <span style="font-weight: 500;">${fromName}</span>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 10px;">
                                                <span style="background: ${typeInfo.color}20; color: ${typeInfo.color}; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">${typeInfo.label}</span>
                                                <span style="color: #666; font-size: 0.8em;">Atraso: ${dep.lag}d</span>
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        </div>
                        ` : `
                        <div style="margin-bottom: 20px; padding: 10px; background: #f1f8e9; border-radius: 6px; text-align: center; color: #689f38;">
                            <i class="fas fa-check-circle"></i> Nenhuma dependência de entrada
                        </div>
                        `}
                        
                        ${outgoingDeps.length > 0 ? `
                        <div>
                            <h4 style="color: #4CAF50; margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-arrow-up"></i> Dependências de Saída (Sucessoras)
                            </h4>
                            <div style="background: #f1f8e9; border-radius: 6px; padding: 10px;">
                                ${outgoingDeps.map(dep => {
            const toPlan = state.plans.find(p => p.id === dep.to);
            const toName = toPlan ? `${toPlan.id} - ${toPlan.interventionType}` : dep.to;

            // Determinar ícone e cor com base no tipo de dependência
            let typeInfo = { color: '#2196F3', icon: '🏁→', label: 'FS' };
            switch (dep.type) {
                case 'FS':
                    typeInfo = { color: '#2196F3', icon: '🏁→', label: 'FS' };
                    break;
                case 'SS':
                    typeInfo = { color: '#FF9800', icon: '▶️→', label: 'SS' };
                    break;
                case 'FF':
                    typeInfo = { color: '#4CAF50', icon: '🏁→🏁', label: 'FF' };
                    break;
                case 'SF':
                    typeInfo = { color: '#9C27B0', icon: '▶️→🏁', label: 'SF' };
                    break;
            }

            return `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #e8f5e9; background: white; border-radius: 4px; margin-bottom: 5px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="color: ${typeInfo.color}; font-weight: bold;">${typeInfo.icon}</span>
                                                <span style="font-weight: 500;">${toName}</span>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 10px;">
                                                <span style="background: ${typeInfo.color}20; color: ${typeInfo.color}; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">${typeInfo.label}</span>
                                                <span style="color: #666; font-size: 0.8em;">Atraso: ${dep.lag}d</span>
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        </div>
                        ` : `
                        <div style="padding: 10px; background: #f1f8e9; border-radius: 6px; text-align: center; color: #689f38;">
                            <i class="fas fa-check-circle"></i> Nenhuma dependência de saída
                        </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Adicionar evento de fechamento
        const closeBtn = modal.querySelector('#close-task-deps');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    /**
     * Atualiza visualmente as dependências no gráfico de Gantt
     */
    updateGanttDependencies() {
        console.log('[updateGanttDependencies] Atualizando dependências visuais');

        // Remover SVG antigo se existir
        const oldSvg = document.getElementById('gantt-dependencies-svg');
        if (oldSvg) {
            oldSvg.remove();
        }

        // Verificar se há dependências
        if (!state.dependencies || state.dependencies.length === 0) {
            console.log('[updateGanttDependencies] Nenhuma dependência para renderizar');
            return;
        }

        // Encontrar container do Gantt
        const ganttContainer = $('#gantt-chart-container');
        if (!ganttContainer) {
            console.warn('[updateGanttDependencies] Container do Gantt não encontrado');
            return;
        }

        // Criar SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'gantt-dependencies-svg';
        svg.style.cssText = 'position: absolute; top: 120px; left: 0; width: 100%; height: calc(100% - 120px); pointer-events: none; z-index: 3; overflow: visible;';

        // Definir marcadores de seta
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const colors = {
            'FS': '#2196F3',
            'SS': '#FF9800',
            'FF': '#4CAF50',
            'SF': '#9C27B0'
        };

        Object.entries(colors).forEach(([type, color]) => {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', `arrow-${type}`);
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
            polygon.setAttribute('fill', color);

            marker.appendChild(polygon);
            defs.appendChild(marker);
        });
        svg.appendChild(defs);

        // Desenhar linhas para cada dependência
        state.dependencies.forEach((dep, index) => {
            const fromBar = document.querySelector(`.gantt-bar[data-task-id="${dep.from}"]`);
            const toBar = document.querySelector(`.gantt-bar[data-task-id="${dep.to}"]`);

            if (!fromBar || !toBar) {
                console.warn(`[updateGanttDependencies] Barras não encontradas para ${dep.from} -> ${dep.to}`);
                return;
            }

            // Obter posições
            const ganttRect = ganttContainer.getBoundingClientRect();
            const fromRect = fromBar.getBoundingClientRect();
            const toRect = toBar.getBoundingClientRect();

            const x1 = fromRect.right - ganttRect.left;
            const y1 = fromRect.top + fromRect.height / 2 - ganttRect.top - 120;
            const x2 = toRect.left - ganttRect.left;
            const y2 = toRect.top + toRect.height / 2 - ganttRect.top - 120;

            // Criar linha
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            path.setAttribute('x1', x1.toString());
            path.setAttribute('y1', y1.toString());
            path.setAttribute('x2', x2.toString());
            path.setAttribute('y2', y2.toString());
            path.setAttribute('stroke', colors[dep.type] || colors['FS']);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-dasharray', '5,3');
            path.setAttribute('marker-end', `url(#arrow-${dep.type || 'FS'})`);

            svg.appendChild(path);
        });

        ganttContainer.appendChild(svg);
        console.log(`[updateGanttDependencies] ${state.dependencies.length} dependências renderizadas`);
    }

    /**
     * Adiciona uma dependência entre dois planos
     */
    addDependency(fromId, toId, type = 'FS', lag = 0) {
        console.log(`[addDependency] Adicionando dependência: ${fromId} -> ${toId} (${type})`);

        if (!state.dependencies) {
            state.dependencies = [];
        }

        // Verificar se já existe
        const exists = state.dependencies.some(d => d.from === fromId && d.to === toId);
        if (exists) {
            showToast('Dependência já existe', 'warning');
            return false;
        }

        // Adicionar
        const newDep = {
            from: fromId,
            to: toId,
            type: type,
            lag: lag,
            createdAt: new Date()
        };

        state.dependencies.push(newDep);

        // Salvar no banco de dados
        if (state.apiService && state.apiService.saveDependency) {
            state.apiService.saveDependency(newDep).then(result => {
                if (result.error) {
                    console.error('[addDependency] Erro ao salvar no banco:', result.error);
                } else {
                    console.log('[addDependency] ✓ Salvo no banco de dados');
                }
            });
        } else {
            console.warn('[addDependency] API Service não disponível para salvar');
        }

        showToast('Dependência criada com sucesso', 'success');

        // Recalcular datas automaticamente
        this.recalculatePlanDates();

        // Atualizar visualização
        this.updateGanttDependencies();
        this.render(); // Re-renderizar para atualizar botão de contador

        return true;
    }

    /**
     * Remove uma dependência
     */
    removeDependency(fromId, toId) {
        console.log(`[removeDependency] Removendo dependência: ${fromId} -> ${toId}`);

        if (!state.dependencies) return false;

        const before = state.dependencies.length;
        state.dependencies = state.dependencies.filter(d => !(d.from === fromId && d.to === toId));

        if (state.dependencies.length < before) {
            // Deletar do banco de dados
            if (state.apiService && state.apiService.deleteDependency) {
                state.apiService.deleteDependency(fromId, toId).then(result => {
                    if (result.error) {
                        console.error('[removeDependency] Erro ao deletar do banco:', result.error);
                    } else {
                        console.log('[removeDependency] ✓ Deletado do banco de dados');
                    }
                });
            }

            showToast('Dependência removida', 'success');
            this.updateGanttDependencies();
            this.render(); // Re-renderizar para atualizar botão
            return true;
        }

        showToast('Dependência não encontrada', 'warning');
        return false;
    }

    /**
     * Obtém dependências de um plano
     */
    getDependenciesForPlan(planId) {
        if (!state.dependencies) return [];
        return state.dependencies.filter(d => d.from === planId || d.to === planId);
    }

    /**
     * Habilita a seleção de dependências no Gantt
     */
    enableDependencySelection() {
        console.log('[enableDependencySelection] Habilitando seleção');

        const ganttContainer = $('#gantt-chart-container');
        if (!ganttContainer) return;

        // Criar botão "Nova Dependência"
        let btn = document.getElementById('new-dep-btn');
        if (btn) btn.remove();

        btn = document.createElement('button');
        btn.id = 'new-dep-btn';
        btn.innerHTML = '➕ Nova Dependência';
        btn.className = 'btn btn-primary btn-sm';
        btn.style.cssText = 'position: absolute; top: 15px; right: 150px; z-index: 100; background: #FF9800; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500;';
        btn.onclick = () => this.showDependencyCreation();
        ganttContainer.appendChild(btn);

        // Criar botão "Ver Dependências" se houver
        if (state.dependencies && state.dependencies.length > 0) {
            let viewBtn = document.getElementById('view-deps-btn');
            if (viewBtn) viewBtn.remove();

            viewBtn = document.createElement('button');
            viewBtn.id = 'view-deps-btn';
            viewBtn.innerHTML = `📋 Ver (${state.dependencies.length})`;
            viewBtn.className = 'btn btn-secondary btn-sm';
            viewBtn.style.cssText = 'position: absolute; top: 15px; right: 15px; z-index: 100; background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500;';
            viewBtn.onclick = () => this.showDependenciesList();
            ganttContainer.appendChild(viewBtn);
        }

        console.log('[enableDependencySelection] Botões criados');
    }

    /**
     * Mostra interface de criação de dependência
     */
    showDependencyCreation() {
        console.log('[showDependencyCreation] Abrindo interface');

        if (state.plans.length < 2) {
            showToast('É necessário ter pelo menos 2 planos para criar dependências', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'dep-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <h3 style="margin: 0 0 15px 0;">➕ Nova Dependência</h3>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Plano Origem:</label>
                        <select id="from-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Selecione...</option>
                            ${state.plans.map(p => `<option value="${p.id}">${p.id} - ${p.interventionType}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Plano Destino:</label>
                        <select id="to-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">Selecione...</option>
                            ${state.plans.map(p => `<option value="${p.id}">${p.id} - ${p.interventionType}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo:</label>
                        <select id="type-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="FS">FS - Finish to Start (Padrão)</option>
                            <option value="SS">SS - Start to Start</option>
                            <option value="FF">FF - Finish to Finish</option>
                            <option value="SF">SF - Start to Finish</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Dias de Folga (Lag):</label>
                        <input type="number" id="lag-input" value="0" min="-30" max="30" 
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <small style="color: #666; font-size: 0.85em;">
                            Positivo = atraso, Negativo = adiantamento. Fins de semana são excluídos.
                        </small>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="create-btn" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Criar</button>
                        <button id="cancel-btn" style="flex: 1; background: #f44336; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Eventos
        modal.querySelector('#create-btn').onclick = () => {
            const from = document.getElementById('from-select').value;
            const to = document.getElementById('to-select').value;
            const type = document.getElementById('type-select').value;
            const lag = parseInt(document.getElementById('lag-input').value) || 0;

            if (!from || !to) {
                showToast('Selecione ambos os planos', 'error');
                return;
            }

            if (from === to) {
                showToast('Os planos devem ser diferentes', 'error');
                return;
            }

            this.addDependency(from, to, type, lag);
            document.body.removeChild(modal);
        };

        modal.querySelector('#cancel-btn').onclick = () => {
            document.body.removeChild(modal);
        };
    }

    /**
     * Lista todas as dependências
     */
    showDependenciesList() {
        if (!state.dependencies || state.dependencies.length === 0) {
            showToast('Nenhuma dependência criada', 'info');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'deps-list-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 600px; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin: 0 0 15px 0;">📋 Dependências (${state.dependencies.length})</h3>
                    ${state.dependencies.map(dep => {
            const from = state.plans.find(p => p.id === dep.from);
            const to = state.plans.find(p => p.id === dep.to);
            const colors = { FS: '#2196F3', SS: '#FF9800', FF: '#4CAF50', SF: '#9C27B0' };
            return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee;">
                                <div style="flex: 1;">
                                    <div><strong>${from ? from.id : dep.from}</strong> → <strong>${to ? to.id : dep.to}</strong></div>
                                    <div style="font-size: 0.85em; color: #666;">
                                        Tipo: <span style="color: ${colors[dep.type]}; font-weight: bold;">${dep.type}</span>
                                        ${dep.lag ? ` | Lag: ${dep.lag > 0 ? '+' : ''}${dep.lag} dias` : ''}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="window.currentModule.editDependency('${dep.from}', '${dep.to}')" 
                                        style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">
                                        ✏️ Editar
                                    </button>
                                    <button onclick="window.currentModule.removeDependency('${dep.from}', '${dep.to}')" 
                                        style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">
                                        🗑️ Remover
                                    </button>
                                </div>
                            </div>
                        `;
        }).join('')}
                    <button id="close-list-btn" style="width: 100%; margin-top: 15px; background: #2196F3; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Fechar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Armazenar referência para o módulo atual
        window.currentModule = this;

        modal.querySelector('#close-list-btn').onclick = () => {
            document.body.removeChild(modal);
        };
    }

    /**
     * Edita uma dependência existente
     */
    editDependency(fromId, toId) {
        console.log(`[editDependency] Editando: ${fromId} -> ${toId}`);

        // Encontrar dependência
        const dep = state.dependencies.find(d => d.from === fromId && d.to === toId);
        if (!dep) {
            showToast('Dependência não encontrada', 'error');
            return;
        }

        // Criar modal de edição
        const modal = document.createElement('div');
        modal.id = 'edit-dep-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; min-width: 500px;">
                    <h3 style="margin: 0 0 15px 0;">✏️ Editar Dependência</h3>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">De:</label>
                        <input type="text" value="${fromId}" disabled style="width: 100%; padding: 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Para:</label>
                        <input type="text" value="${toId}" disabled style="width: 100%; padding: 8px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo:</label>
                        <select id="edit-type-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="FS" ${dep.type === 'FS' ? 'selected' : ''}>FS - Finish to Start</option>
                            <option value="SS" ${dep.type === 'SS' ? 'selected' : ''}>SS - Start to Start</option>
                            <option value="FF" ${dep.type === 'FF' ? 'selected' : ''}>FF - Finish to Finish</option>
                            <option value="SF" ${dep.type === 'SF' ? 'selected' : ''}>SF - Start to Finish</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Dias de Folga (Lag):</label>
                        <input type="number" id="edit-lag-input" value="${dep.lag || 0}" min="-30" max="30" 
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <small style="color: #666; font-size: 0.85em;">Positivo = atraso, Negativo = adiantamento</small>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="save-edit-btn" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Salvar</button>
                        <button id="cancel-edit-btn" style="flex: 1; background: #999; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Eventos
        modal.querySelector('#save-edit-btn').onclick = () => {
            const newType = document.getElementById('edit-type-select').value;
            const newLag = parseInt(document.getElementById('edit-lag-input').value) || 0;

            // Atualizar dependência localmente
            const depIndex = state.dependencies.findIndex(d => d.from === fromId && d.to === toId);
            if (depIndex !== -1) {
                state.dependencies[depIndex].type = newType;
                state.dependencies[depIndex].lag = newLag;

                // Salvar no banco de dados
                if (state.apiService && state.apiService.saveDependency) {
                    state.apiService.saveDependency(state.dependencies[depIndex]).then(result => {
                        if (result.error) {
                            console.error('[editDependency] Erro ao salvar:', result.error);
                        } else {
                            console.log('[editDependency] ✓ Atualizado no banco');
                        }
                    });
                }

                showToast('Dependência atualizada com sucesso', 'success');

                // Recalcular datas
                this.recalculatePlanDates();
                this.updateGanttDependencies();

                // Fechar modal de edição
                document.body.removeChild(modal);

                // Fechar e reabrir lista se estiver aberta
                const listModal = document.getElementById('deps-list-modal');
                if (listModal) {
                    document.body.removeChild(listModal);
                    setTimeout(() => this.showDependenciesList(), 100);
                }
            }
        };

        modal.querySelector('#cancel-edit-btn').onclick = () => {
            document.body.removeChild(modal);
        };
    }

    /**
     * Carrega dependências do banco de dados
     */
    async loadDependencies() {
        console.log('[loadDependencies] Carregando dependências do banco');

        if (!state.apiService || !state.apiService.getUserDependencies) {
            console.warn('[loadDependencies] API não disponível');
            return;
        }

        try {
            const result = await state.apiService.getUserDependencies();

            if (result.error) {
                console.error('[loadDependencies] Erro ao carregar:', result.error);
                return;
            }

            state.dependencies = result.data || [];
            console.log(`[loadDependencies] ✓ ${state.dependencies.length} dependências carregadas`);

            if (state.dependencies.length > 0) {
                this.updateGanttDependencies();
            }
        } catch (error) {
            console.error('[loadDependencies] Exceção:', error);
        }
    }

    /**
     * Adiciona dias úteis a uma data (excluindo fins de semana)
     */
    addBusinessDays(date, days) {
        const result = new Date(date);
        let remaining = Math.abs(days);
        const direction = days >= 0 ? 1 : -1;

        while (remaining > 0) {
            result.setDate(result.getDate() + direction);
            const dayOfWeek = result.getDay();
            // 0 = domingo, 6 = sábado
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                remaining--;
            }
        }

        return result;
    }

    /**
     * Obtém a data de término de um plano
     */
    getPlanEndDate(plan) {
        const scheduleDate = extractScheduleDate(plan.schedule);
        if (!scheduleDate) return null;

        const startDate = new Date(scheduleDate);

        // Calcular duração total em dias
        let duration = 1; // Padrão: 1 dia
        if (plan.durations) {
            duration = (plan.durations.mobilization || 0) +
                (plan.durations.execution || 0) +
                (plan.durations.demobilization || 0);
        }

        return this.addBusinessDays(startDate, duration);
    }

    /**
     * Recalcula as datas dos planos baseado nas dependências
     */
    recalculatePlanDates() {
        console.log('[recalculatePlanDates] Iniciando recálculo de datas');

        if (!state.dependencies || state.dependencies.length === 0) {
            console.log('[recalculatePlanDates] Nenhuma dependência para processar');
            return;
        }

        // Processar cada dependência
        state.dependencies.forEach(dep => {
            const fromPlan = state.plans.find(p => p.id === dep.from);
            const toPlan = state.plans.find(p => p.id === dep.to);

            if (!fromPlan || !toPlan) {
                console.warn(`[recalculatePlanDates] Planos não encontrados: ${dep.from} -> ${dep.to}`);
                return;
            }

            const fromStartDate = new Date(extractScheduleDate(fromPlan.schedule));
            const fromEndDate = this.getPlanEndDate(fromPlan);

            if (!fromStartDate || !fromEndDate) {
                console.warn(`[recalculatePlanDates] Datas inválidas para plano ${dep.from}`);
                return;
            }

            let newToStartDate;

            // Calcular nova data baseada no tipo de dependência
            switch (dep.type) {
                case 'FS': // Finish-to-Start: destino começa após origem terminar
                    newToStartDate = this.addBusinessDays(fromEndDate, dep.lag || 0);
                    break;
                case 'SS': // Start-to-Start: destino começa quando origem começa
                    newToStartDate = this.addBusinessDays(fromStartDate, dep.lag || 0);
                    break;
                case 'FF': // Finish-to-Finish: destino termina quando origem termina
                    // Calcular data de início baseado na duração do destino
                    const toDuration = toPlan.durations ?
                        ((toPlan.durations.mobilization || 0) +
                            (toPlan.durations.execution || 0) +
                            (toPlan.durations.demobilization || 0)) : 1;
                    const toEndDate = this.addBusinessDays(fromEndDate, dep.lag || 0);
                    newToStartDate = this.addBusinessDays(toEndDate, -toDuration);
                    break;
                case 'SF': // Start-to-Finish: destino termina quando origem começa
                    const toDurationSF = toPlan.durations ?
                        ((toPlan.durations.mobilization || 0) +
                            (toPlan.durations.execution || 0) +
                            (toPlan.durations.demobilization || 0)) : 1;
                    const toEndDateSF = this.addBusinessDays(fromStartDate, dep.lag || 0);
                    newToStartDate = this.addBusinessDays(toEndDateSF, -toDurationSF);
                    break;
                default:
                    console.warn(`[recalculatePlanDates] Tipo de dependência desconhecido: ${dep.type}`);
                    return;
            }

            // Atualizar data do plano
            const newDateStr = newToStartDate.toISOString().split('T')[0];
            console.log(`[recalculatePlanDates] Atualizando ${dep.to}: ${extractScheduleDate(toPlan.schedule)} -> ${newDateStr}`);

            // Atualizar no state
            const planIndex = state.plans.findIndex(p => p.id === dep.to);
            if (planIndex !== -1) {
                // Atualizar schedule mantendo estrutura
                if (typeof state.plans[planIndex].schedule === 'object') {
                    if (state.plans[planIndex].schedule.start) {
                        state.plans[planIndex].schedule.start = newDateStr;
                    } else if (state.plans[planIndex].schedule.startDate) {
                        state.plans[planIndex].schedule.startDate = newDateStr;
                    }
                } else {
                    state.plans[planIndex].schedule = newDateStr;
                }

                // Atualizar no backend
                if (state.apiService && state.apiService.updatePlan) {
                    state.apiService.updatePlan(dep.to, {
                        schedule: state.plans[planIndex].schedule
                    }).catch(err => {
                        console.error(`[recalculatePlanDates] Erro ao atualizar plano ${dep.to}:`, err);
                    });
                }
            }
        });

        console.log('[recalculatePlanDates] Recálculo concluído');

        // Forçar re-render completo
        this.render();
    }
}
