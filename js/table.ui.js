/* js/table.ui.js (vFinal)
   Gerenciador da Tabela de Resumo (Árvores Cadastradas).
   Responsável por: Renderizar HTML, Filtros e Eventos de Ação (Excluir/Visualizar).
*/

import Utils from './utils.js';
import State from './state.js';

const TableUI = {
    container: null,

    init() {
        this.container = document.getElementById('summary-table-container');
    },

    /**
     * Renderiza a tabela com base nos dados do State.
     * @param {string} filterText - Texto para filtrar (opcional)
     */
    update(filterText = '') {
        // Garante que pegou o container (caso init não tenha sido chamado)
        if (!this.container) {
            this.container = document.getElementById('summary-table-container');
            if (!this.container) return;
        }

        const trees = State.getAllTrees();

        // 1. Estado Vazio
        if (trees.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #90a4ae;">
                    <p style="font-size: 3rem; margin-bottom: 10px;">🌳</p>
                    <p>Nenhuma árvore cadastrada ainda.</p>
                    <p style="font-size: 0.9rem;">Use a aba "Registrar Árvore" para começar.</p>
                </div>
            `;
            return;
        }

        // 2. Filtragem
        const search = filterText.toLowerCase();
        const filtered = trees.filter(t => {
            if (!search) return true;
            return (t.especie && t.especie.toLowerCase().includes(search)) ||
                   (t.local && t.local.toLowerCase().includes(search)) ||
                   (t.riskLevel && t.riskLevel.toLowerCase().includes(search)) ||
                   (t.id && t.id.includes(search));
        });

        if (filtered.length === 0) {
            this.container.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">Nenhum resultado encontrado para o filtro.</p>';
            return;
        }

        // 3. Construção do HTML
        let html = `
            <div class="table-responsive">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Espécie / Local</th>
                            <th>Risco</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filtered.forEach(tree => {
            // Define estilo do Badge de Risco
            let badgeClass = 'badge-low';
            let riskLabel = tree.riskLevel || 'N/A';
            
            if (riskLabel === 'Alto Risco') badgeClass = 'badge-high';
            else if (riskLabel === 'Médio Risco') badgeClass = 'badge-medium';

            // Formatação de dados
            const dateStr = Utils.formatDate(tree.dataColeta);
            const especieStr = Utils.escapeHTML(tree.especie);
            const localStr = Utils.escapeHTML(tree.local || '-');

            html += `
                <tr class="fade-in-row">
                    <td>
                        <span style="font-weight:600; color:#546E7A;">${dateStr}</span>
                        <div style="font-size:0.75em; color:#b0bec5;">ID: ${tree.id.substr(0,6)}</div>
                    </td>
                    <td>
                        <div style="font-weight:700; color:#0277BD;">${especieStr}</div>
                        <div style="font-size:0.85em; color:#78909c;">${localStr}</div>
                    </td>
                    <td>
                        <span class="risk-badge ${badgeClass}">${riskLabel}</span>
                    </td>
                    <td style="text-align: right;">
                        <button class="action-btn view-btn" data-id="${tree.id}" title="Ver Detalhes" 
                                style="background: #e3f2fd; color: #0277BD; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; margin-right:5px;">
                            👁️
                        </button>
                        <button class="action-btn delete-btn" data-id="${tree.id}" title="Excluir" 
                                style="background: #ffebee; color: #c62828; border:none; border-radius:8px; padding:6px 10px; cursor:pointer;">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
            <div style="text-align: right; margin-top: 10px; font-size: 0.8rem; color: #90a4ae;">
                Exibindo ${filtered.length} de ${trees.length} registros
            </div>
        `;

        this.container.innerHTML = html;

        // 4. Reconectar Listeners (Event Delegation seria melhor, mas direto é mais seguro aqui)
        this.attachListeners(filtered);
    },

    attachListeners(trees) {
        // Botão Excluir
        this.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Evita triggers indesejados
                const id = e.target.closest('button').dataset.id;
                
                if (confirm('Tem certeza que deseja excluir este registro permanentemente?')) {
                    const success = State.removeTree(id);
                    if (success) {
                        // Recarrega a tabela mantendo o filtro atual? 
                        // Por simplicidade, recarrega tudo
                        this.update(); 
                        
                        // Atualiza badge da aba (via evento global ou callback se necessário)
                        // Dispara evento customizado para a CalculatorUI ouvir
                        document.dispatchEvent(new CustomEvent('arboria:tree-updated'));
                        
                        Utils.showToast('Registro excluído com sucesso.', 'success');
                    } else {
                        Utils.showToast('Erro ao excluir registro.', 'error');
                    }
                }
            });
        });

        // Botão Visualizar (Pode abrir um modal no futuro)
        this.container.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                const tree = trees.find(t => t.id === id);
                if (tree) {
                    alert(`Detalhes:\n\nEspécie: ${tree.especie}\nLocal: ${tree.local}\nObs: ${tree.obs || 'Nenhuma'}`);
                    // Futuramente: ModalUI.open(tree);
                }
            });
        });
    }
};

/* EXPORTAÇÃO PADRÃO (Essencial para o import funcionar) */
export default TableUI;
