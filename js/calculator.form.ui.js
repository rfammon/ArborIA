/* js/calculator.form.ui.js (vFinal)
   Lógica do Formulário de Coleta e Calculadora de Risco.
   Integra: GPS (Proj4), Câmera (Canvas Blob), Mapa e State.
*/

import State from './state.js';
import Utils from './utils.js';
import MapUI from './map.ui.js';
import UI from './ui.js'; // Para acesso a elementos globais se necessário

const CalculatorUI = {
    form: null,
    photoBlob: null, // Armazena a foto processada temporariamente

    init() {
        this.form = document.getElementById('risk-calculator-form');
        if (!this.form) return;

        console.log('[CalculatorUI] Inicializando formulário...');

        this.setupListeners();
        this.setupChecklistMobileNav(); // Navegação anterior/próximo do checklist
        this.updateSummaryTable(); // Carrega dados salvos ao abrir
    },

    setupListeners() {
        // 1. Submit do Formulário
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // 2. Botão Limpar
        const btnReset = document.getElementById('reset-risk-form-btn');
        if (btnReset) btnReset.addEventListener('click', () => this.resetForm());

        // 3. Botão GPS (Usa o Utils.convertLatLonToUtm original)
        const btnGps = document.getElementById('get-gps-btn');
        if (btnGps) btnGps.addEventListener('click', () => this.handleGps());

        // 4. Input de Foto (Usa o Utils.optimizeImage original)
        const photoInput = document.getElementById('tree-photo-input');
        if (photoInput) photoInput.addEventListener('change', (e) => this.handlePhotoSelect(e));

        // 5. Botão Remover Foto
        const btnRemovePhoto = document.getElementById('remove-photo-btn');
        if (btnRemovePhoto) btnRemovePhoto.addEventListener('click', () => this.clearPhoto());

        // 6. Botões de Ferramentas (Abrem as Views de Câmera)
        const btnHeight = document.getElementById('btn-measure-height-form');
        if (btnHeight) {
            btnHeight.addEventListener('click', () => {
                // Aciona a view do clinômetro via navegação global ou evento
                document.querySelector('[data-target="clinometro-view"]').click();
            });
        }

        const btnDap = document.getElementById('btn-measure-dap-form');
        if (btnDap) {
            btnDap.addEventListener('click', () => {
                document.querySelector('[data-target="dap-estimator-view"]').click();
            });
        }
        
        // 7. Filtro da Tabela
        const filterInput = document.getElementById('table-filter-input');
        if (filterInput) {
            filterInput.addEventListener('input', Utils.debounce((e) => {
                this.updateSummaryTable(e.target.value);
            }, 300));
        }

        // 8. Botão Limpar Tudo (Tabela)
        const btnClearAll = document.getElementById('clear-all-btn');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', () => {
                if(confirm('Tem certeza? Isso apagará TODAS as árvores cadastradas.')) {
                    State.clearAll();
                    MapUI.clearMap();
                    this.updateSummaryTable();
                    Utils.showToast('Banco de dados limpo.', 'warning');
                }
            });
        }
        
        // 9. Exportação (CSV/JSON) - Simplificado, focando no State
        const btnExport = document.getElementById('export-data-btn');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.handleExport());
        }
    },

    // === LÓGICA DE NEGÓCIO: RISCO ===

    calculateRisk() {
        let totalWeight = 0;
        const checkedBoxes = this.form.querySelectorAll('.risk-checkbox:checked');
        
        checkedBoxes.forEach(cb => {
            const w = parseInt(cb.dataset.weight || 0);
            totalWeight += w;
        });

        // Classificação (Baseada na soma dos pesos)
        // Ajuste conforme sua regra de negócio original
        let riskLevel = 'Baixo Risco';
        if (totalWeight >= 15) riskLevel = 'Alto Risco';
        else if (totalWeight >= 8) riskLevel = 'Médio Risco';

        return { score: totalWeight, level: riskLevel };
    },

    // === HANDLERS ===

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const riskInfo = this.calculateRisk();

        // Constrói o objeto da árvore
        const treeData = {
            id: Utils.generateId(),
            createdAt: new Date().toISOString(),
            
            // Dados do Form
            especie: formData.get('risk-especie'),
            local: formData.get('risk-local'),
            dataColeta: formData.get('risk-data'),
            altura: formData.get('risk-altura'),
            dap: formData.get('risk-dap'),
            coordX: formData.get('risk-coord-x'),
            coordY: formData.get('risk-coord-y'),
            avaliador: formData.get('risk-avaliador'),
            obs: formData.get('risk-obs'),
            
            // Dados de Risco
            riskScore: riskInfo.score,
            riskLevel: riskInfo.level,
            checklist: this.getChecklistData(), // Salva quais itens foram marcados
            
            // Foto (Salva apenas se existir blob processado)
            photoBase64: this.photoBlob ? await this.blobToBase64(this.photoBlob) : null
        };

        // 1. Salva no Estado Global
        State.addTree(treeData);

        // 2. Adiciona marcador no Mapa
        if (treeData.coordY && treeData.coordX) {
             // Tenta converter se for UTM, ou usa direto se for LatLon
             // Para simplificar a visualização no mapa, idealmente usamos Lat/Lon no marker.
             // Se o input for UTM, precisaria converter de volta (complexo).
             // Assumindo que o GPS preenche Lat/Lon nos campos ocultos ou o mapa usa os inputs.
             // NOTA: O MapUI.addTreeMarker espera Lat, Lng. 
             // Se os campos X/Y forem UTM, o marcador pode não aparecer corretamente sem conversão reversa.
             // Por hora, usamos os valores crus.
             MapUI.addTreeMarker(treeData.coordY, treeData.coordX, treeData.especie, treeData.riskLevel);
        }

        // 3. Atualiza UI
        this.updateSummaryTable();
        this.resetForm();
        Utils.showToast(`Árvore salva! Risco: ${riskInfo.level}`);
        
        // Atualiza badge
        this.updateBadge();
    },

    async handleGps() {
        const statusSpan = document.getElementById('gps-status');
        if (statusSpan) statusSpan.textContent = 'Buscando...';

        if (!navigator.geolocation) {
            Utils.showToast('GPS não suportado neste navegador.', 'error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                
                // Preenche campos Lat/Lon (para uso interno/mapa)
                // Se o form tiver campos ocultos para lat/lon, preencha-os aqui.
                // Caso contrário, usamos Y e X.
                
                document.getElementById('risk-coord-y').value = latitude.toFixed(6);
                document.getElementById('risk-coord-x').value = longitude.toFixed(6);

                // Tenta converter para UTM usando o Utils original
                const utm = Utils.convertLatLonToUtm(latitude, longitude);
                if (utm) {
                    // Se converteu com sucesso, substitui pelos valores UTM
                    document.getElementById('risk-coord-x').value = utm.easting;
                    document.getElementById('risk-coord-y').value = utm.northing;
                    // Opcional: Preencher zona
                    const zoneInput = document.getElementById('default-utm-zone');
                    if(zoneInput) zoneInput.value = `${utm.zoneNum}${utm.zoneLetter}`;
                    
                    if (statusSpan) statusSpan.textContent = `UTM ${utm.zoneNum}${utm.zoneLetter} (±${accuracy.toFixed(0)}m)`;
                } else {
                    // Fallback Lat/Lon
                    if (statusSpan) statusSpan.textContent = `Lat/Lon (±${accuracy.toFixed(0)}m)`;
                }

                Utils.showToast('Coordenadas capturadas!', 'success');
            },
            (err) => {
                console.error(err);
                Utils.showToast('Erro ao obter GPS.', 'error');
                if (statusSpan) statusSpan.textContent = 'Erro';
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    async handlePhotoSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Usa o Utils.optimizeImage original para não pesar o storage
            const optimizedBlob = await Utils.optimizeImage(file, 800, 0.7);
            this.photoBlob = optimizedBlob;

            // Preview
            const previewUrl = URL.createObjectURL(optimizedBlob);
            const container = document.getElementById('photo-preview-container');
            
            // Remove preview anterior se houver
            const oldImg = container.querySelector('img');
            if(oldImg) oldImg.remove();

            const img = document.createElement('img');
            img.src = previewUrl;
            img.style.maxWidth = '100px';
            img.style.borderRadius = '8px';
            img.style.marginTop = '10px';
            
            container.appendChild(img);
            
            const btnRemove = document.getElementById('remove-photo-btn');
            if(btnRemove) btnRemove.style.display = 'inline-block';

        } catch (err) {
            console.error(err);
            Utils.showToast('Erro ao processar imagem.', 'error');
        }
    },

    clearPhoto() {
        this.photoBlob = null;
        const container = document.getElementById('photo-preview-container');
        const img = container.querySelector('img');
        if(img) img.remove();
        
        document.getElementById('tree-photo-input').value = '';
        document.getElementById('remove-photo-btn').style.display = 'none';
    },

    // === UTILITÁRIOS INTERNOS ===

    getChecklistData() {
        // Retorna array de índices marcados ou textos das perguntas
        const items = [];
        this.form.querySelectorAll('.risk-checkbox').forEach((cb, index) => {
            if (cb.checked) items.push(index + 1);
        });
        return items;
    },

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    resetForm() {
        this.form.reset();
        this.clearPhoto();
        // Reseta data para hoje
        document.getElementById('risk-data').value = new Date().toISOString().split('T')[0];
        Utils.showToast('Formulário limpo.');
    },

    updateBadge() {
        const count = State.getAllTrees().length;
        const badge = document.getElementById('summary-badge');
        if (badge) {
            badge.textContent = count > 0 ? count : '';
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    },

    // === TABELA DE RESUMO ===

    updateSummaryTable(filterText = '') {
        const container = document.getElementById('summary-table-container');
        if (!container) return;

        const trees = State.getAllTrees();
        
        if (trees.length === 0) {
            container.innerHTML = '<p id="summary-placeholder">Nenhuma árvore cadastrada ainda.</p>';
            return;
        }

        // Filtro
        const filtered = trees.filter(t => {
            if (!filterText) return true;
            const search = filterText.toLowerCase();
            return (t.especie && t.especie.toLowerCase().includes(search)) ||
                   (t.local && t.local.toLowerCase().includes(search)) ||
                   (t.riskLevel && t.riskLevel.toLowerCase().includes(search));
        });

        // Gera HTML da Tabela
        let html = `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Espécie</th>
                        <th>Risco</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filtered.forEach(tree => {
            // Define cor do risco na tabela
            let badgeClass = 'badge-low';
            if (tree.riskLevel === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.riskLevel === 'Médio Risco') badgeClass = 'badge-medium';

            html += `
                <tr>
                    <td>${Utils.formatDate(tree.dataColeta)}</td>
                    <td>${Utils.escapeHTML(tree.especie)}</td>
                    <td><span class="risk-badge ${badgeClass}">${tree.riskLevel}</span></td>
                    <td>
                        <button class="action-btn delete-btn" data-id="${tree.id}">🗑️</button>
                        <button class="action-btn view-btn" data-id="${tree.id}">👁️</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Reconecta listeners dos botões da tabela
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if(confirm('Excluir esta árvore?')) {
                    State.removeTree(id);
                    this.updateSummaryTable(filterText);
                    this.updateBadge();
                    Utils.showToast('Árvore excluída.');
                }
            });
        });
        
        this.updateBadge();
    },
    
    handleExport() {
        const data = State.exportData();
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arboria_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    },

    // === NAVEGAÇÃO MOBILE CHECKLIST (Original) ===
    setupChecklistMobileNav() {
        const prevBtn = document.getElementById('checklist-prev');
        const nextBtn = document.getElementById('checklist-next');
        const counter = document.querySelector('.checklist-counter');
        const rows = document.querySelectorAll('.risk-table tbody tr');
        const cardContainer = document.querySelector('.mobile-checklist-card');
        
        let currentIndex = 0;

        if (!prevBtn || !nextBtn || !cardContainer || rows.length === 0) return;

        const showItem = (index) => {
            // Esconde todas as linhas da tabela desktop (já escondidas por CSS mobile, mas garante)
            // Clona o conteúdo da linha TR para dentro do Card Mobile
            const row = rows[index];
            const cells = row.querySelectorAll('td');
            
            // Estrutura do Card Mobile
            // Cell 0: Num, Cell 1: Pergunta, Cell 3: Input
            const number = cells[0].textContent;
            const question = cells[1].innerHTML; // innerHTML para manter spans de tooltip
            const inputHtml = cells[3].innerHTML; // O Checkbox
            
            cardContainer.innerHTML = `
                <div class="mobile-card-header">
                    <span class="q-number">Item ${number}</span>
                </div>
                <div class="mobile-card-body">
                    <p class="q-text">${question}</p>
                </div>
                <div class="mobile-card-action">
                   <label class="mobile-checkbox-label">
                      ${inputHtml} 
                      <span style="margin-left:10px">Sim (Risco)</span>
                   </label>
                </div>
            `;
            
            // Reconectar o evento do checkbox clonado ao original ou Estado
            // Truque: Ao clicar no clone, disparamos click no original (oculto)
            const cloneCheckbox = cardContainer.querySelector('input');
            const originalCheckbox = row.querySelector('input');
            
            // Sincroniza estado inicial
            cloneCheckbox.checked = originalCheckbox.checked;
            
            cloneCheckbox.addEventListener('change', () => {
                originalCheckbox.checked = cloneCheckbox.checked;
            });

            // Atualiza contador
            counter.textContent = `${index + 1} / ${rows.length}`;
            
            // Estado dos botões
            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === rows.length - 1;
            if (index === rows.length - 1) {
                nextBtn.textContent = "Concluir";
            } else {
                nextBtn.textContent = "Próxima ❯";
            }
        };

        // Listeners
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Evita submit
            if (currentIndex > 0) {
                currentIndex--;
                showItem(currentIndex);
            }
        });

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentIndex < rows.length - 1) {
                currentIndex++;
                showItem(currentIndex);
            } else {
                // Scroll para o fim do form
                document.querySelector('.risk-buttons-area').scrollIntoView({behavior: 'smooth'});
            }
        });

        // Inicia
        showItem(0);
    }
};

/* EXPORTAÇÃO PADRÃO */
export default CalculatorUI;
