/* js/calculator.form.ui.js (vFinal 7.0 - Completo & Blindado)
   Controlador Mestre da Calculadora.
   Integra: Form, GPS, Câmera, Mapa, Tabela e Estado.
   Correção: Força visualização das abas via JS (style.display).
*/

import State from './state.js';
import Utils from './utils.js';
import MapUI from './map.ui.js';
import TableUI from './table.ui.js';

const CalculatorUI = {
    form: null,
    photoBlob: null,

    // === 1. INICIALIZAÇÃO ===
    init() {
        console.log('[CalculatorUI] Inicializando...');
        
        this.form = document.getElementById('risk-calculator-form');
        
        // Mecanismo de Retry: Se o DOM não estiver pronto, tenta de novo em 500ms
        if (!this.form) {
            console.warn('[CalculatorUI] Formulário não encontrado. Tentando novamente...');
            setTimeout(() => this.init(), 500);
            return;
        }

        // 1. Inicializar dependências visuais
        if (TableUI) TableUI.init();

        // 2. Configurar Navegação (Abas)
        this.setupTabs();

        // 3. Configurar Listeners do Formulário
        this.setupFormListeners();

        // 4. Configurar Checklist Mobile
        this.setupMobileChecklist();

        // 5. Carregar dados iniciais na tabela
        this.updateSummary();

        // 6. CORREÇÃO CRÍTICA: Forçar abertura da primeira aba
        // Garante que o usuário veja o formulário ao carregar
        this.openTab('tab-content-register');
        
        // Listener para atualizações externas (ex: exclusão na tabela)
        document.addEventListener('arboria:tree-updated', () => this.updateBadge());
    },

    // === 2. SISTEMA DE ABAS (FIXED) ===

    setupTabs() {
        const tabButtons = document.querySelectorAll('.sub-nav-btn');
        
        tabButtons.forEach(btn => {
            // Remove listeners antigos (clone) para evitar duplicidade
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
        console.log('[CalculatorUI] Abrindo aba:', tabId);

        // 1. Atualiza Botões (Visual Ativo)
        document.querySelectorAll('.sub-nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 2. Atualiza Conteúdo (Força Bruta no Display)
        document.querySelectorAll('.sub-tab-content').forEach(content => {
            if (content.id === tabId) {
                // Adiciona classe
                content.classList.add('active');
                // FORÇA VISIBILIDADE (Override no CSS)
                content.style.display = 'block';
                content.style.opacity = '1';
                
                // Hacks de renderização para componentes específicos
                if (tabId === 'tab-content-mapa') {
                    // Pequeno delay para garantir que a div está visível antes do Leaflet medir
                    setTimeout(() => MapUI.refresh(), 100);
                }
                if (tabId === 'tab-content-summary') {
                    this.updateSummary(); 
                }
            } else {
                content.classList.remove('active');
                // FORÇA OCULTAÇÃO
                content.style.display = 'none';
            }
        });
    },

    // === 3. LISTENERS DO FORMULÁRIO ===

    setupFormListeners() {
        // Submit Principal
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Helper para bindar eventos com verificação de existência
        const bind = (id, callback) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', callback);
        };

        // Botões de Ação
        bind('reset-risk-form-btn', () => this.resetForm());
        bind('get-gps-btn', () => this.handleGps());
        bind('remove-photo-btn', () => this.clearPhoto());
        bind('export-data-btn', () => this.handleExport());
        
        // Input de Arquivo (Foto)
        const photoInput = document.getElementById('tree-photo-input');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => this.handlePhoto(e));
        }

        // Atalhos para Câmeras (Integração com main.js via clique simulado)
        bind('btn-measure-height-form', () => {
            const btn = document.querySelector('[data-target="clinometro-view"]');
            if (btn) btn.click();
        });
        
        bind('btn-measure-dap-form', () => {
            const btn = document.querySelector('[data-target="dap-estimator-view"]');
            if (btn) btn.click();
        });

        // Filtro da Tabela (Busca)
        const filterInput = document.getElementById('table-filter-input');
        if (filterInput) {
            filterInput.addEventListener('input', Utils.debounce((e) => {
                TableUI.update(e.target.value);
            }, 300));
        }

        // Botão Limpar Tudo (Database)
        bind('clear-all-btn', () => {
            if(confirm('ATENÇÃO: Isso apagará TODAS as árvores e limpará o mapa. Continuar?')) {
                State.clearAll();
                MapUI.clearMap();
                this.updateSummary();
                Utils.showToast('Banco de dados limpo.', 'warning');
            }
        });
    },

    // === 4. LÓGICA DE NEGÓCIO (SALVAR/CALCULAR) ===

    async handleSubmit(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(this.form);
            const riskData = this.calculateRisk();
            
            // Cria objeto da Árvore
            const newTree = {
                id: Utils.generateId(),
                createdAt: new Date().toISOString(),
                
                // Campos Básicos
                especie: formData.get('risk-especie'),
                local: formData.get('risk-local'),
                dataColeta: formData.get('risk-data'),
                altura: formData.get('risk-altura'),
                dap: formData.get('risk-dap'),
                coordX: formData.get('risk-coord-x'),
                coordY: formData.get('risk-coord-y'),
                avaliador: formData.get('risk-avaliador'),
                obs: formData.get('risk-obs'),
                
                // Risco Calculado
                riskScore: riskData.score,
                riskLevel: riskData.level,
                checklist: this.getChecklistData(),
                
                // Foto (Base64)
                photoBase64: this.photoBlob ? await this.blobToBase64(this.photoBlob) : null
            };

            // 1. Salva no Estado
            State.addTree(newTree);
            
            // 2. Adiciona ao Mapa (Se tiver coordenadas)
            if (newTree.coordY && newTree.coordX) {
                MapUI.addTreeMarker(newTree.coordY, newTree.coordX, newTree.especie, newTree.riskLevel);
            }
            
            // 3. Feedback
            Utils.showToast(`Árvore Salva! Risco: ${newTree.riskLevel}`);
            this.resetForm();
            
            // 4. Vai para a tabela de resumo
            this.openTab('tab-content-summary');

        } catch (err) {
            console.error(err);
            Utils.showToast('Erro ao salvar dados.', 'error');
        }
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

    getChecklistData() {
        const items = [];
        this.form.querySelectorAll('.risk-checkbox').forEach((cb, i) => { 
            if(cb.checked) items.push(i+1); // Salva o índice (1-based)
        });
        return items;
    },

    // === 5. GPS E FOTO ===

    handleGps() {
        const status = document.getElementById('gps-status');
        if(status) status.textContent = 'Buscando...';

        if(!navigator.geolocation) return Utils.showToast('GPS não suportado.', 'error');

        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude, accuracy } = pos.coords;
            
            // Preenche inputs visíveis (Lat/Lon por padrão)
            document.getElementById('risk-coord-y').value = latitude.toFixed(6);
            document.getElementById('risk-coord-x').value = longitude.toFixed(6);
            
            // Tenta converter para UTM usando Utils (Proj4)
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
            Utils.showToast('Localização capturada!');
        }, err => {
            console.error(err);
            Utils.showToast('Erro GPS: ' + err.message, 'error');
            if(status) status.textContent = 'Erro';
        }, { enableHighAccuracy: true, timeout: 10000 });
    },

    async handlePhoto(e) {
        const file = e.target.files[0];
        if(!file) return;
        
        try {
            // Usa otimização do Utils
            this.photoBlob = await Utils.optimizeImage(file, 800, 0.7);
            const url = URL.createObjectURL(this.photoBlob);
            
            const container = document.getElementById('photo-preview-container');
            // Cria preview
            container.innerHTML = `
                <div style="position:relative; display:inline-block;">
                    <img src="${url}" style="max-width:120px; border-radius:8px; border:2px solid #00796b; margin-top:10px;">
                </div>
            `;
            
            const btnRemove = document.getElementById('remove-photo-btn');
            if(btnRemove) btnRemove.style.display = 'inline-block';
            
        } catch(err) {
            console.error(err);
            Utils.showToast('Erro ao processar foto.', 'error');
        }
    },

    clearPhoto() {
        this.photoBlob = null;
        document.getElementById('photo-preview-container').innerHTML = '';
        document.getElementById('tree-photo-input').value = ''; // Reseta input
        const btnRemove = document.getElementById('remove-photo-btn');
        if(btnRemove) btnRemove.style.display = 'none';
    },

    resetForm() {
        this.form.reset();
        this.clearPhoto();
        document.getElementById('risk-data').value = new Date().toISOString().split('T')[0];
        
        const gpsStatus = document.getElementById('gps-status');
        if(gpsStatus) gpsStatus.textContent = '';
        
        Utils.showToast('Formulário pronto.');
    },

    // === 6. INTEGRAÇÃO COM TABELA E EXPORTAÇÃO ===

    updateSummary() {
        // Delega a renderização para o TableUI
        if (TableUI) {
            TableUI.update();
            this.updateBadge();
        }
    },

    updateBadge() {
        const count = State.getAllTrees().length;
        const badge = document.getElementById('summary-badge');
        if(badge) {
            badge.textContent = count > 0 ? count : '';
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    },

    handleExport() {
        const data = State.exportData(); // JSON String
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `arboria_dados_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    // === 7. NAVEGAÇÃO CHECKLIST MOBILE ===
    
    setupMobileChecklist() {
        const prevBtn = document.getElementById('checklist-prev');
        const nextBtn = document.getElementById('checklist-next');
        const counter = document.querySelector('.checklist-counter');
        const cardContainer = document.querySelector('.mobile-checklist-card');
        const rows = document.querySelectorAll('.risk-table tbody tr'); 

        if (!prevBtn || !nextBtn || !cardContainer || rows.length === 0) return;

        let currentIndex = 0;

        const showItem = (index) => {
            const row = rows[index];
            const cells = row.querySelectorAll('td');
            
            const number = cells[0].textContent;
            const question = cells[1].innerHTML; 
            const inputElement = cells[3].querySelector('input'); 
            
            cardContainer.innerHTML = `
                <div class="mobile-card-header">Item ${number}</div>
                <div class="mobile-card-body">
                    <p class="q-text">${question}</p>
                </div>
                <div class="mobile-card-action">
                   <label style="display:flex; align-items:center; gap:10px; width:100%; cursor:pointer;">
                      <input type="checkbox" id="mobile-cb-${index}" ${inputElement.checked ? 'checked' : ''} style="transform:scale(1.5); accent-color: #c62828;"> 
                      <span style="font-weight:bold; color:#37474f;">Sim (Fator de Risco)</span>
                   </label>
                </div>
            `;

            // Sincroniza Checkbox
            const mobileCb = document.getElementById(`mobile-cb-${index}`);
            mobileCb.addEventListener('change', () => {
                inputElement.checked = mobileCb.checked;
            });

            // Atualiza Botões
            counter.textContent = `${index + 1} / ${rows.length}`;
            prevBtn.disabled = index === 0;
            
            if (index === rows.length - 1) {
                nextBtn.textContent = "Concluir";
            } else {
                nextBtn.textContent = "Próxima ❯";
            }
        };

        // Listeners
        prevBtn.onclick = (e) => {
            e.preventDefault();
            if (currentIndex > 0) {
                currentIndex--;
                showItem(currentIndex);
            }
        };

        nextBtn.onclick = (e) => {
            e.preventDefault();
            if (currentIndex < rows.length - 1) {
                currentIndex++;
                showItem(currentIndex);
            } else {
                // Rola para botões de ação
                document.querySelector('.risk-buttons-area').scrollIntoView({behavior: 'smooth'});
            }
        };

        // Inicia no item 1
        showItem(0);
    }
};

export default CalculatorUI;
