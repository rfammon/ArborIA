/* js/calculator.form.ui.js (vFinal 5.0)
   Lógica da Calculadora: Abas, Form, GPS e Integração State.
*/

import State from './state.js';
import Utils from './utils.js';
import MapUI from './map.ui.js';

const CalculatorUI = {
    form: null,
    photoBlob: null,

    init() {
        console.log('[CalculatorUI] Iniciando módulo...');
        
        this.form = document.getElementById('risk-calculator-form');
        
        // Se o formulário não existe, aborta (proteção)
        if (!this.form) {
            console.error('[CalculatorUI] ERRO: Formulário #risk-calculator-form não encontrado no DOM.');
            return;
        }

        // 1. Configura as Abas (Registrar / Resumo / Mapa)
        this.setupTabs();

        // 2. Configura Listeners do Formulário (GPS, Foto, Submit)
        this.setupFormListeners();

        // 3. Configura Navegação Mobile do Checklist
        this.setupMobileChecklist();

        // 4. Atualiza a tabela com dados salvos
        this.updateSummaryTable();

        // 5. Abre a primeira aba por padrão
        this.openTab('tab-content-register');
    },

    // === SISTEMA DE ABAS ===
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.sub-nav-btn');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                this.openTab(targetId);
            });
        });
    },

    openTab(tabId) {
        console.log('[CalculatorUI] Trocando aba para:', tabId);

        // 1. Atualiza Botões
        document.querySelectorAll('.sub-nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 2. Atualiza Conteúdo
        document.querySelectorAll('.sub-tab-content').forEach(content => {
            if (content.id === tabId) {
                content.classList.add('active');
                
                // Se for a aba do mapa, força refresh do Leaflet
                if (tabId === 'tab-content-mapa') {
                    MapUI.refresh();
                }
                
                // Se for a aba de resumo, atualiza a tabela
                if (tabId === 'tab-content-summary') {
                    this.updateSummaryTable();
                }
            } else {
                content.classList.remove('active');
            }
        });
    },

    // === LISTENERS DO FORMULÁRIO ===

    setupFormListeners() {
        // Submit
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // GPS
        const btnGps = document.getElementById('get-gps-btn');
        if (btnGps) btnGps.addEventListener('click', () => this.handleGps());

        // Foto
        const photoInput = document.getElementById('tree-photo-input');
        if (photoInput) photoInput.addEventListener('change', (e) => this.handlePhoto(e));

        // Remover Foto
        const btnRemovePhoto = document.getElementById('remove-photo-btn');
        if (btnRemovePhoto) btnRemovePhoto.addEventListener('click', () => this.clearPhoto());

        // Limpar Form
        const btnReset = document.getElementById('reset-risk-form-btn');
        if (btnReset) btnReset.addEventListener('click', () => this.resetForm());
        
        // Atalhos de Câmera (Clinômetro/DAP)
        const btnHeight = document.getElementById('btn-measure-height-form');
        if(btnHeight) btnHeight.addEventListener('click', () => document.querySelector('[data-target="clinometro-view"]').click());
        
        const btnDap = document.getElementById('btn-measure-dap-form');
        if(btnDap) btnDap.addEventListener('click', () => document.querySelector('[data-target="dap-estimator-view"]').click());
    },

    // === AÇÕES (HANDLERS) ===

    async handleSubmit(e) {
        e.preventDefault();
        
        // Coleta dados
        const formData = new FormData(this.form);
        const riskData = this.calculateRisk();
        
        const newTree = {
            id: Utils.generateId(),
            createdAt: new Date().toISOString(),
            especie: formData.get('risk-especie'),
            local: formData.get('risk-local'),
            dataColeta: formData.get('risk-data'),
            altura: formData.get('risk-altura'),
            dap: formData.get('risk-dap'),
            coordX: formData.get('risk-coord-x'),
            coordY: formData.get('risk-coord-y'),
            avaliador: formData.get('risk-avaliador'),
            obs: formData.get('risk-obs'),
            riskScore: riskData.score,
            riskLevel: riskData.level,
            // Processa foto se houver
            photoBase64: this.photoBlob ? await this.blobToBase64(this.photoBlob) : null
        };

        // Salva
        State.addTree(newTree);
        
        // Atualiza Mapa e UI
        if (newTree.coordY && newTree.coordX) {
            MapUI.addTreeMarker(newTree.coordY, newTree.coordX, newTree.especie, newTree.riskLevel);
        }
        
        Utils.showToast(`Árvore Salva! Risco: ${newTree.riskLevel}`);
        this.resetForm();
        this.openTab('tab-content-summary'); // Vai para o resumo automaticamente
    },

    handleGps() {
        const status = document.getElementById('gps-status');
        if(status) status.textContent = 'Buscando...';

        if(!navigator.geolocation) return Utils.showToast('GPS não suportado.', 'error');

        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude, accuracy } = pos.coords;
            
            // Preenche Lat/Lon
            document.getElementById('risk-coord-y').value = latitude.toFixed(6);
            document.getElementById('risk-coord-x').value = longitude.toFixed(6);
            
            // Tenta converter UTM
            const utm = Utils.convertLatLonToUtm(latitude, longitude);
            if(utm) {
                document.getElementById('risk-coord-x').value = utm.easting;
                document.getElementById('risk-coord-y').value = utm.northing;
                const zoneInput = document.getElementById('default-utm-zone');
                if(zoneInput) zoneInput.value = `${utm.zoneNum}${utm.zoneLetter}`;
                
                if(status) status.textContent = `UTM (±${accuracy.toFixed(0)}m)`;
            } else {
                if(status) status.textContent = `Lat/Lon (±${accuracy.toFixed(0)}m)`;
            }
            Utils.showToast('Localização atualizada!');
        }, err => {
            console.error(err);
            Utils.showToast('Erro GPS: ' + err.message, 'error');
            if(status) status.textContent = 'Erro';
        }, { enableHighAccuracy: true });
    },

    async handlePhoto(e) {
        const file = e.target.files[0];
        if(!file) return;
        
        try {
            this.photoBlob = await Utils.optimizeImage(file);
            const url = URL.createObjectURL(this.photoBlob);
            
            const container = document.getElementById('photo-preview-container');
            container.innerHTML = `<img src="${url}" style="max-width:100px; border-radius:8px; margin-top:10px; display:block;">`;
            
            document.getElementById('remove-photo-btn').style.display = 'inline-block';
        } catch(err) {
            console.error(err);
            Utils.showToast('Erro na foto', 'error');
        }
    },

    clearPhoto() {
        this.photoBlob = null;
        document.getElementById('photo-preview-container').innerHTML = '';
        document.getElementById('tree-photo-input').value = '';
        document.getElementById('remove-photo-btn').style.display = 'none';
    },

    calculateRisk() {
        let total = 0;
        this.form.querySelectorAll('.risk-checkbox:checked').forEach(cb => {
            total += parseInt(cb.getAttribute('data-weight') || 0);
        });
        
        let level = 'Baixo Risco';
        if (total >= 15) level = 'Alto Risco';
        else if (total >= 8) level = 'Médio Risco';
        
        return { score: total, level };
    },

    resetForm() {
        this.form.reset();
        this.clearPhoto();
        document.getElementById('risk-data').value = new Date().toISOString().split('T')[0];
        Utils.showToast('Campos limpos.');
    },

    // === TABELA E DADOS ===

    updateSummaryTable() {
        const container = document.getElementById('summary-table-container');
        if (!container) return;

        const trees = State.getAllTrees();
        const badge = document.getElementById('summary-badge');
        if(badge) {
            badge.textContent = trees.length || '';
            badge.style.display = trees.length ? 'inline-flex' : 'none';
        }

        if (trees.length === 0) {
            container.innerHTML = '<p id="summary-placeholder" style="text-align:center; padding:20px; color:#777;">Nenhuma árvore cadastrada.</p>';
            return;
        }

        let html = `
            <table class="summary-table">
                <thead>
                    <tr><th>Data</th><th>Espécie</th><th>Risco</th><th>Ação</th></tr>
                </thead>
                <tbody>
        `;

        trees.forEach(t => {
            let riskClass = 'badge-low';
            if (t.riskLevel === 'Alto Risco') riskClass = 'badge-high';
            if (t.riskLevel === 'Médio Risco') riskClass = 'badge-medium';

            html += `
                <tr>
                    <td>${Utils.formatDate(t.dataColeta)}</td>
                    <td>${Utils.escapeHTML(t.especie)}</td>
                    <td><span class="risk-badge ${riskClass}">${t.riskLevel}</span></td>
                    <td>
                        <button class="action-btn delete-btn" data-id="${t.id}" style="border:none; background:none; cursor:pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Listeners de Exclusão
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').getAttribute('data-id');
                if(confirm('Excluir registro?')) {
                    State.removeTree(id);
                    this.updateSummaryTable();
                    Utils.showToast('Registro excluído.');
                }
            });
        });
    },

    // === HELPERS ===
    blobToBase64(blob) {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },

    setupMobileChecklist() {
        const prev = document.getElementById('checklist-prev');
        const next = document.getElementById('checklist-next');
        
        if (prev && next) {
            // Lógica simplificada para demonstração
            // Em produção, use a versão completa que enviamos anteriormente se precisar
            // de navegação passo a passo no checklist mobile.
            // Se não, a tabela padrão será ocultada pelo CSS media query.
        }
    }
};

export default CalculatorUI;
