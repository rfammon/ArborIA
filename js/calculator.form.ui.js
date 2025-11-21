/* js/calculator.form.ui.js (vFinal 8.0 - Abas Blindadas)
   Controlador Mestre da Calculadora.
   Correção: Try-Catch individual na troca de abas para evitar travamento.
*/

import State from './state.js';
import Utils from './utils.js';
import MapUI from './map.ui.js';
import TableUI from './table.ui.js';

const CalculatorUI = {
    form: null,
    photoBlob: null,

    init() {
        console.log('[CalculatorUI] Inicializando...');
        
        this.form = document.getElementById('risk-calculator-form');
        
        if (!this.form) {
            console.warn('[CalculatorUI] Form não encontrado. Tentando novamente...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // 1. Inicializar dependências
        if (TableUI && TableUI.init) TableUI.init();

        // 2. Configurar Abas (Obrigatório)
        this.setupTabs();

        // 3. Configurar Listeners
        this.setupFormListeners();
        this.setupMobileChecklist();

        // 4. Carregar dados
        this.safeUpdateSummary();

        // 5. Abrir aba inicial
        this.openTab('tab-content-register');
        
        document.addEventListener('arboria:tree-updated', () => this.updateBadge());
    },

    // === SISTEMA DE ABAS (FIXED) ===

    setupTabs() {
        const tabButtons = document.querySelectorAll('.sub-nav-btn');
        
        if (tabButtons.length === 0) {
            console.warn('[CalculatorUI] Nenhuma aba encontrada para configurar.');
            return;
        }

        tabButtons.forEach(btn => {
            // Clone para remover listeners antigos e garantir limpeza
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = newBtn.getAttribute('data-target');
                console.log('[CalculatorUI] Clique na aba:', targetId);
                this.openTab(targetId);
            });
        });
    },

    openTab(tabId) {
        // 1. Atualiza estado visual dos botões
        document.querySelectorAll('.sub-nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 2. Alterna conteúdo (Força Bruta)
        const contents = document.querySelectorAll('.sub-tab-content');
        
        contents.forEach(content => {
            if (content.id === tabId) {
                // MOSTRA
                content.classList.add('active');
                content.style.display = 'block'; 
                
                // 3. Executa lógica específica da aba (Com proteção de erro)
                this.handleTabLogic(tabId);
                
            } else {
                // ESCONDE
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });
    },

    // Lógica separada e protegida para não travar a troca de aba
    handleTabLogic(tabId) {
        // Aba Mapa
        if (tabId === 'tab-content-mapa') {
            setTimeout(() => {
                try {
                    if (MapUI && MapUI.refresh) {
                        MapUI.refresh();
                        console.log('[CalculatorUI] Mapa atualizado.');
                    } else {
                        console.warn('[CalculatorUI] MapUI não disponível.');
                    }
                } catch (e) {
                    console.error('[CalculatorUI] Erro ao atualizar mapa:', e);
                }
            }, 100);
        }

        // Aba Resumo
        if (tabId === 'tab-content-summary') {
            this.safeUpdateSummary();
        }
    },

    safeUpdateSummary() {
        try {
            if (TableUI && TableUI.update) {
                TableUI.update();
                this.updateBadge();
            }
        } catch (e) {
            console.error('[CalculatorUI] Erro ao atualizar tabela:', e);
        }
    },

    // === LISTENERS DO FORMULÁRIO ===

    setupFormListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        const bind = (id, cb) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', cb);
        };

        bind('reset-risk-form-btn', () => this.resetForm());
        bind('get-gps-btn', () => this.handleGps());
        bind('remove-photo-btn', () => this.clearPhoto());
        bind('export-data-btn', () => this.handleExport());
        
        const photoInput = document.getElementById('tree-photo-input');
        if (photoInput) photoInput.addEventListener('change', (e) => this.handlePhoto(e));

        bind('btn-measure-height-form', () => this.triggerNav('clinometro-view'));
        bind('btn-measure-dap-form', () => this.triggerNav('dap-estimator-view'));

        const filterInput = document.getElementById('table-filter-input');
        if (filterInput) {
            filterInput.addEventListener('input', Utils.debounce((e) => {
                if(TableUI) TableUI.update(e.target.value);
            }, 300));
        }

        bind('clear-all-btn', () => {
            if(confirm('Apagar tudo?')) {
                State.clearAll();
                if(MapUI) MapUI.clearMap();
                this.safeUpdateSummary();
                Utils.showToast('Limpo!', 'warning');
            }
        });
    },

    triggerNav(id) {
        const btn = document.querySelector(`[data-target="${id}"]`);
        if(btn) btn.click();
    },

    // === LÓGICA DE NEGÓCIO ===

    async handleSubmit(e) {
        e.preventDefault();
        try {
            const fd = new FormData(this.form);
            const risk = this.calculateRisk();
            
            const tree = {
                id: Utils.generateId(),
                createdAt: new Date().toISOString(),
                especie: fd.get('risk-especie'),
                local: fd.get('risk-local'),
                dataColeta: fd.get('risk-data'),
                altura: fd.get('risk-altura'),
                dap: fd.get('risk-dap'),
                coordX: fd.get('risk-coord-x'),
                coordY: fd.get('risk-coord-y'),
                avaliador: fd.get('risk-avaliador'),
                obs: fd.get('risk-obs'),
                riskScore: risk.score,
                riskLevel: risk.level,
                checklist: this.getChecklistData(),
                photoBase64: this.photoBlob ? await this.blobToBase64(this.photoBlob) : null
            };

            State.addTree(tree);
            if (tree.coordX && tree.coordY && MapUI) {
                MapUI.addTreeMarker(tree.coordY, tree.coordX, tree.especie, tree.riskLevel);
            }
            
            Utils.showToast(`Salvo: ${tree.riskLevel}`);
            this.resetForm();
            this.openTab('tab-content-summary');

        } catch (err) {
            console.error(err);
            Utils.showToast('Erro ao salvar.', 'error');
        }
    },

    calculateRisk() {
        let t = 0;
        this.form.querySelectorAll('.risk-checkbox:checked').forEach(c => t += parseInt(c.dataset.weight||0));
        return { score: t, level: t>=15 ? 'Alto Risco' : (t>=8 ? 'Médio Risco' : 'Baixo Risco') };
    },

    getChecklistData() {
        const i = [];
        this.form.querySelectorAll('.risk-checkbox').forEach((c, idx) => { if(c.checked) i.push(idx+1); });
        return i;
    },

    handleGps() {
        const status = document.getElementById('gps-status');
        if(status) status.textContent = '...';
        
        if(!navigator.geolocation) return Utils.showToast('Sem GPS');

        navigator.geolocation.getCurrentPosition(pos => {
            const {latitude, longitude, accuracy} = pos.coords;
            document.getElementById('risk-coord-y').value = latitude.toFixed(6);
            document.getElementById('risk-coord-x').value = longitude.toFixed(6);
            
            const utm = Utils.convertLatLonToUtm(latitude, longitude);
            if(utm) {
                document.getElementById('risk-coord-x').value = utm.easting;
                document.getElementById('risk-coord-y').value = utm.northing;
                const z = document.getElementById('default-utm-zone');
                if(z) z.value = `${utm.zoneNum}${utm.zoneLetter}`;
                if(status) status.textContent = `UTM ±${accuracy.toFixed(0)}m`;
            } else {
                if(status) status.textContent = `Lat/Lon ±${accuracy.toFixed(0)}m`;
            }
            Utils.showToast('GPS OK');
        }, err => {
            Utils.showToast('Erro GPS', 'error');
            if(status) status.textContent = 'Erro';
        }, {enableHighAccuracy: true});
    },

    async handlePhoto(e) {
        const f = e.target.files[0];
        if(!f) return;
        try {
            this.photoBlob = await Utils.optimizeImage(f);
            const url = URL.createObjectURL(this.photoBlob);
            document.getElementById('photo-preview-container').innerHTML = `<img src="${url}" style="max-width:100px; margin-top:10px; border-radius:8px;">`;
            document.getElementById('remove-photo-btn').style.display = 'inline-block';
        } catch(e) { console.error(e); }
    },

    clearPhoto() {
        this.photoBlob = null;
        document.getElementById('photo-preview-container').innerHTML = '';
        document.getElementById('tree-photo-input').value = '';
        document.getElementById('remove-photo-btn').style.display = 'none';
    },

    resetForm() {
        this.form.reset();
        this.clearPhoto();
        document.getElementById('risk-data').value = new Date().toISOString().split('T')[0];
    },

    updateBadge() {
        const c = State.getAllTrees().length;
        const b = document.getElementById('summary-badge');
        if(b) { b.textContent = c||''; b.style.display = c?'inline-flex':'none'; }
    },

    handleExport() {
        const d = State.exportData();
        const b = new Blob([d], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `data_${Date.now()}.json`;
        a.click();
    },

    blobToBase64(b) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onloadend = () => res(r.result);
            r.readAsDataURL(b);
        });
    },

    setupMobileChecklist() {
        const prev = document.getElementById('checklist-prev');
        const next = document.getElementById('checklist-next');
        if(prev && next) {
            // ... lógica simplificada ...
        }
    }
};

export default CalculatorUI;
