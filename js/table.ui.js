/* js/table.ui.js (vFinal - Reconstruído)
   Gerenciador da Tabela de Resumo.
   Responsável por: Renderizar HTML da lista, Filtros e Ações (Excluir).
*/

import Utils from './utils.js';
import State from './state.js';

const TableUI = {
    container: null,

    // === 1. INICIALIZAÇÃO ===
    init() {
        this.container = document.getElementById('summary-table-container');
        
        if (!this.container) {
            console.warn('[TableUI] Container #summary-table-container não encontrado.');
        } else {
            console.log('[TableUI] Inicializado.');
        }
    },

    // === 2. RENDERIZAÇÃO (UPDATE) ===
    update(filterText = '') {
        // Garante que temos o container (caso init tenha falhado ou ordem de carga)
        if (!this.container) {
            this.container = document.getElementById('summary-table-container');
            if (!this.container) return;
        }

        const trees = State.getAllTrees();

        // A. Estado Vazio
        if (trees.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #90a4ae;">
                    <p style="font-size: 2.5rem; margin-bottom: 10px;">🌳</p>
                    <p><strong>Nenhuma árvore cadastrada.</strong></p>
                    <p style="font-size: 0.9rem;">Use a aba "Registrar Árvore" para começar.</p>
                </div>
            `;
            return;
        }

        // B. Filtragem
        const search = filterText.toLowerCase();
        const filtered = trees.filter(t => {
            if (!search) return true;
            return (t.especie && t.especie.toLowerCase().includes(search)) ||
                   (t.local && t.local.toLowerCase().includes(search)) ||
                   (t.riskLevel && t.riskLevel.toLowerCase().includes(search));
        });

        if (filtered.length === 0) {
            this.container.innerHTML = `
                <p style="text-align:center; padding:20px; color:#777;">
                    Nenhum resultado para "<strong>${Utils.escapeHTML(filterText)}</strong>".
                </p>`;
            return;
        }

        // C. Construção do HTML
        let html = `
            <div class="table-responsive">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Data / ID</th>
                            <th>Espécie / Local</th>
                            <th>Risco</th>
                            <th style="text-align: center;">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filtered.forEach(tree => {
            // Define cor do Badge
            let badgeClass = 'badge-low';
            if (tree.riskLevel === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.riskLevel === 'Médio Risco') badgeClass = 'badge-medium';

            // Formatações seguras
            const dateStr = Utils.formatDate(tree.dataColeta);
            const especieStr = Utils.escapeHTML(tree.especie);
            const localStr = Utils.escapeHTML(tree.local || 'Sem local');
            const shortId = tree.id ? tree.id.substr(0, 4) : '???';

            html += `
                <tr>
                    <td>
                        <div style="font-weight:600; color:#455A64;">${dateStr}</div>
                        <div style="font-size:0.75rem; color:#b0bec5;">#${shortId}</div>
                    </td>
                    <td>
                        <div style="font-weight:700; color:#0277BD;">${especieStr}</div>
                        <div style="font-size:0.85rem; color:#78909c;">${localStr}</div>
                    </td>
                    <td>
                        <span class="risk-badge ${badgeClass}">${tree.riskLevel}</span>
                    </td>
                    <td style="text-align: center;">
                        <button class="delete-btn" data-id="${tree.id}" title="Excluir Registro" 
                                style="background:none; border:none; cursor:pointer; font-size:1.2rem;">
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
                ${filtered.length} registro(s) encontrado(s)
            </div>
        `;

        this.container.innerHTML = html;

        // D. Reconectar Listeners (Botões gerados dinamicamente)
        this.attachListeners();
    },

    // === 3. LISTENERS DE AÇÃO ===
    attachListeners() {
        const buttons = this.container.querySelectorAll('.delete-btn');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                
                if (confirm('Tem certeza que deseja excluir esta árvore permanentemente?')) {
                    const success = State.removeTree(id);
                    
                    if (success) {
                        this.update(); // Recarrega a tabela
                        Utils.showToast('Registro excluído.', 'success');
                        
                        // Dispara evento global para atualizar badges em outros lugares
                        document.dispatchEvent(new CustomEvent('arboria:tree-updated'));
                    } else {
                        Utils.showToast('Erro ao excluir.', 'error');
                    }
                }
            });
        });
    }
};

/* EXPORTAÇÃO PADRÃO */
export default TableUI;
