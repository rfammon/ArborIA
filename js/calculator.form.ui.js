/* js/calculator.form.ui.js (vFinal 8.1 - Database Integrated)
   Controlador Mestre da Calculadora.
   Integra: Form, GPS, Mapa, Tabela e IndexedDB (Imagens).
*/

import State from './state.js';
import Utils from './utils.js';
import MapUI from './map.ui.js';
import TableUI from './table.ui.js';
import { saveImageToDB } from './database.js'; // Import correto para salvar imagens

const CalculatorUI = {
    form: null,
    photoBlob: null, // Armazena o blob da foto temporariamente

    // === 1. INICIALIZAÇÃO ===
    init() {
        console.log('[CalculatorUI] Inicializando...');
        
        this.form = document.getElementById('risk-calculator-form');
        
        // Retry se o DOM não estiver pronto
        if (!this.form) {
            console.warn('[CalculatorUI] Form não encontrado. Tentando novamente...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // Inicializa dependências
        if (TableUI && TableUI.init) TableUI.init();

        // Configurações iniciais
        this.setupTabs();
        this.setupFormListeners();
        this.setupMobileChecklist();
        this.safeUpdateSummary();

        // Força abertura da primeira aba
        this.openTab('tab-content-register');
        
        // Listener para atualizações externas
        document.addEventListener('arboria:tree-updated', () => this.updateBadge());
    },

    // === 2. SISTEMA DE ABAS ===
    setupTabs() {
        const tabButtons = document.querySelectorAll('.sub-nav-btn');
        
        tabButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = newBtn.getAttribute('data-target');
                this.openTab(targetId);
            });
        });
    },

    openTab(tabId) {
        // Atualiza botões
        document.querySelectorAll('.sub-nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Atualiza conteúdo (Força visualização)
        document.querySelectorAll('.sub-tab-content').forEach(content => {
            if (content.id === tabId) {
                content.classList.add('active');
                content.style.display = 'block'; // Override CSS
                
                // Lógica específica da aba
                if (tabId === 'tab-content-mapa') {
                    setTimeout(() => { if(MapUI) MapUI.refresh(); }, 100);
                }
                if (tabId === 'tab-content-summary') {
                    this.safeUpdateSummary();
                }
            } else {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });
    },

    safeUpdateSummary() {
        if (TableUI && TableUI.update) {
            TableUI.update();
            this.updateBadge();
        }
    },

    // === 3. LISTENERS E AÇÕES ===
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
        
        // Input Foto
        const photoInput = document.getElementById('tree-photo-input');
        if (photoInput) photoInput.addEventListener('change', (e) => this.handlePhoto(e));

        // Atalhos Câmera
        bind('btn-measure-height-form', () => this.triggerNav('clinometro-view'));
        bind('btn-measure-dap-form', () => this.triggerNav('dap-estimator-view'));

        // Filtro
        const filterInput = document.getElementById('table-filter-input');
        if (filterInput) {
            filterInput.addEventListener('input', Utils.debounce((e) => {
                if(TableUI) TableUI.update(e.target.value);
            }, 300));
        }

        // Limpar Tudo
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

    // === 4. SUBMIT E SALVAMENTO ===
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
                hasPhoto: !!this.photoBlob // Flag para saber se tem foto
            };

            // 1. Salva dados leves no State (LocalStorage)
            State.addTree(tree);

            // 2. Salva imagem pesada no IndexedDB (Evita erro de cota)
            if (this.photoBlob) {
                try {
                    await saveImageToDB(tree.id, this.photoBlob);
                    console.log('[CalculatorUI] Imagem salva no IndexedDB.');
                } catch (dbErr) {
                    console.error('[CalculatorUI] Erro ao salvar imagem:', dbErr);
                    Utils.showToast('Aviso: Foto não pode ser salva (erro de DB).', 'warning');
                }
            }
            
            // 3. Atualiza Mapa
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

    // === 5. HELPERS DE DADOS ===
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

    // === 6. GPS E MÍDIA ===
    handleGps() {
        const status = document.getElementById('gps-status');
        if(status) status.textContent = '...';
        
        if(!navigator.geolocation) return Utils.showToast('Sem GPS');

        navigator.geolocation.getCurrentPosition(pos => {
            const {latitude, longitude, accuracy} = pos.coords;
            
            // Preenche Lat/Lon nos inputs ocultos/visíveis
            document.getElementById('risk-coord-y').value = latitude.toFixed(6);
            document.getElementById('risk-coord-x').value = longitude.toFixed(6);
            
            // Converte para UTM
            const utm = Utils.convertLatLonToUtm(latitude, longitude);
            if(utm) {
                document.getElementById('risk-coord-x').value = utm.easting;
                document.getElementById('risk-coord-y').value = utm.northing;
                
                const zone = document.getElementById('default-utm-zone');
                if(zone) zone.value = `${utm.zoneNum}${utm.zoneLetter}`;
                
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

    // === 7. EXPORTAÇÃO E UI AUXILIAR ===
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
        a.download = `arboria_backup_${Date.now()}.json`;
        a.click();
    },

    setupMobileChecklist() {
        const prev = document.getElementById('checklist-prev');
        const next = document.getElementById('checklist-next');
        const wrapper = document.querySelector('.mobile-checklist-wrapper');
        
        if(prev && next && wrapper) {
            const card = wrapper.querySelector('.mobile-checklist-card');
            const rows = document.querySelectorAll('.risk-table tbody tr');
            let idx = 0;

            const show = (i) => {
                const row = rows[i];
                const q = row.cells[1].innerHTML;
                const input = row.querySelector('input');
                
                card.innerHTML = `
                    <div class="mobile-card-header">Item ${i+1}</div>
                    <div class="mobile-card-body"><p class="q-text">${q}</p></div>
                    <div class="mobile-card-action">
                        <label style="display:flex;align-items:center;gap:10px;width:100%;padding:10px">
                            <input type="checkbox" id="m-cb-${i}" ${input.checked?'checked':''} style="transform:scale(1.5)">
                            <span>Sim</span>
                        </label>
                    </div>`;
                
                document.getElementById(`m-cb-${i}`).onchange = (e) => input.checked = e.target.checked;
                
                document.querySelector('.checklist-counter').textContent = `${i+1}/${rows.length}`;
                prev.disabled = i===0;
                next.textContent = i===rows.length-1 ? "Fim" : "Próxima";
            };

            // Limpa e readiciona listeners
            const nPrev = prev.cloneNode(true); prev.parentNode.replaceChild(nPrev, prev);
            const nNext = next.cloneNode(true); next.parentNode.replaceChild(nNext, next);

            nPrev.onclick = (e) => { e.preventDefault(); if(idx>0) show(--idx); };
            nNext.onclick = (e) => { e.preventDefault(); if(idx<rows.length-1) show(++idx); };
            
            show(0);
        }
    }
};

export default CalculatorUI;
