/* js/calculator.form.ui.js (vFinal Restaurado)
   Gerencia o formulário de registro e checklist mobile.
*/

import State from './state.js';
import Utils from './utils.js'; // Import default
import { optimizeImage } from './utils.js'; // Import nomeado
import * as features from './features.js';
import { getImageFromDB } from './database.js';

// Importa funções da tabela (assumindo que table.ui.js exporta essas funções ou default)
// Se table.ui.js exportar default TableUI, usaremos TableUI.update()
import TableUI from './table.ui.js'; 

// Estado local do checklist mobile
const mobileChecklist = {
    currentIndex: 0,
    totalQuestions: 0,
    questions: null,
    wrapper: null,
    card: null,
    navPrev: null,
    navNext: null,
    counter: null,
};

const CalculatorUI = {
    init(isTouchDevice) {
        console.log('[CalculatorUI] Inicializando...');
        const form = document.getElementById('risk-calculator-form');
        
        if (!form) {
            console.warn('[CalculatorUI] Formulário não encontrado.');
            return;
        }

        this.setupFormListeners(form, isTouchDevice);
        this.setupPhotoListeners();
        
        // Inicia checklist mobile se for touch
        if (isTouchDevice) {
            this.setupMobileChecklist();
        }
    },

    setupFormListeners(form, isTouchDevice) {
        const getGpsBtn = document.getElementById('get-gps-btn');
        const resetBtn = document.getElementById('reset-risk-form-btn');
        const gpsStatus = document.getElementById('gps-status');

        // GPS Listener
        if (getGpsBtn) {
            getGpsBtn.addEventListener('click', () => this.handleGetGPS());
        }

        // Submit Listener
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleSubmit(event, isTouchDevice);
        });

        // Reset Listener
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetForm(form, isTouchDevice);
            });
        }
    },

    setupPhotoListeners() {
        const photoInput = document.getElementById('tree-photo-input');
        const removeBtn = document.getElementById('remove-photo-btn');

        if (photoInput) {
            photoInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    Utils.showToast('Processando foto...', 'info');
                    const blob = await optimizeImage(file, 800, 0.7);
                    
                    // Salva no State
                    State.setCurrentTreePhoto(blob);
                    
                    // Preview
                    const url = URL.createObjectURL(blob);
                    const container = document.getElementById('photo-preview-container');
                    
                    // Limpa anterior
                    const old = document.getElementById('photo-preview');
                    if(old) old.remove();

                    const img = document.createElement('img');
                    img.id = 'photo-preview';
                    img.src = url;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.marginTop = '10px';
                    
                    container.prepend(img);
                    if(removeBtn) removeBtn.style.display = 'block';

                } catch (err) {
                    console.error(err);
                    Utils.showToast('Erro na foto.', 'error');
                }
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                State.setCurrentTreePhoto(null);
                const img = document.getElementById('photo-preview');
                if(img) img.remove();
                removeBtn.style.display = 'none';
                document.getElementById('tree-photo-input').value = '';
            });
        }
    },

    async handleSubmit(event, isTouchDevice) {
        // Lógica de coleta de dados
        const formData = new FormData(event.target);
        const risk = this.calculateRisk();
        
        const tree = {
            id: State.getEditingTreeId() || Utils.generateId(),
            createdAt: new Date().toISOString(),
            // Campos
            especie: formData.get('risk-especie'),
            local: formData.get('risk-local'),
            data: formData.get('risk-data'), // nome no html é risk-data
            altura: formData.get('risk-altura'),
            dap: formData.get('risk-dap'),
            coordX: formData.get('risk-coord-x'),
            coordY: formData.get('risk-coord-y'),
            avaliador: formData.get('risk-avaliador'),
            observacoes: formData.get('risk-obs'),
            // Risco
            riskScore: risk.score,
            riskLevel: risk.level,
            riskFactors: this.getRiskFactors(),
            // Foto
            hasPhoto: !!State.getCurrentTreePhoto()
        };

        // Salva no State
        if (State.getEditingTreeId()) {
            State.updateTree(tree);
            Utils.showToast('Árvore atualizada!', 'success');
        } else {
            State.addTree(tree);
            Utils.showToast(`Árvore adicionada! Risco: ${risk.level}`, 'success');
        }

        // Atualiza Tabela (Integração com TableUI)
        if (TableUI && TableUI.update) TableUI.update();

        // Limpa form
        this.resetForm(event.target, isTouchDevice);
    },

    resetForm(form, isTouchDevice) {
        form.reset();
        // Restaura defaults
        document.getElementById('risk-data').value = new Date().toISOString().split('T')[0];
        
        // Limpa foto
        State.setCurrentTreePhoto(null);
        const img = document.getElementById('photo-preview');
        if(img) img.remove();
        const btn = document.getElementById('remove-photo-btn');
        if(btn) btn.style.display = 'none';
        
        State.setEditingTreeId(null);
        
        // Reseta UI Mobile
        if (isTouchDevice) this.setupMobileChecklist();
        
        // Volta botão para "Adicionar"
        const addBtn = document.getElementById('add-tree-btn');
        if(addBtn) {
            addBtn.textContent = '➕ Adicionar Árvore';
            addBtn.style.background = ''; // Volta ao CSS original
        }
    },

    // === LÓGICA DE RISCO ===
    calculateRisk() {
        let total = 0;
        document.querySelectorAll('.risk-checkbox:checked').forEach(cb => {
            total += parseInt(cb.getAttribute('data-weight') || 0);
        });
        let level = 'Baixo Risco';
        if (total >= 15) level = 'Alto Risco';
        else if (total >= 8) level = 'Médio Risco';
        return { score: total, level };
    },

    getRiskFactors() {
        // Retorna array de 0s e 1s mapeando os checkboxes
        const factors = [];
        document.querySelectorAll('.risk-checkbox').forEach(cb => {
            factors.push(cb.checked ? 1 : 0);
        });
        return factors;
    },

    // === GPS (Simples) ===
    handleGetGPS() {
        const status = document.getElementById('gps-status');
        if(status) status.textContent = 'Buscando...';

        if (!navigator.geolocation) return Utils.showToast('GPS não suportado.', 'error');

        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude, accuracy } = pos.coords;
            document.getElementById('risk-coord-y').value = latitude.toFixed(6);
            document.getElementById('risk-coord-x').value = longitude.toFixed(6);
            
            // Conversão UTM via Utils
            const utm = Utils.convertLatLonToUtm(latitude, longitude);
            if (utm) {
                document.getElementById('risk-coord-x').value = utm.easting;
                document.getElementById('risk-coord-y').value = utm.northing;
                if(status) status.textContent = `UTM ${utm.zoneNum}${utm.zoneLetter} (±${accuracy.toFixed(0)}m)`;
            } else {
                if(status) status.textContent = `Lat/Lon (±${accuracy.toFixed(0)}m)`;
            }
            Utils.showToast('Localização capturada!');
        }, err => {
            Utils.showToast('Erro GPS.', 'error');
            if(status) status.textContent = 'Erro';
        }, { enableHighAccuracy: true });
    },

    // === CHECKLIST MOBILE (Restaurado) ===
    setupMobileChecklist() {
        const wrapper = document.querySelector('.mobile-checklist-wrapper');
        if (!wrapper) return;

        const card = wrapper.querySelector('.mobile-checklist-card');
        const prev = document.getElementById('checklist-prev');
        const next = document.getElementById('checklist-next');
        const counter = document.querySelector('.checklist-counter');
        const rows = document.querySelectorAll('.risk-table tbody tr');

        if (!rows.length) return;

        let currentIndex = 0;

        const showItem = (index) => {
            const row = rows[index];
            const num = row.cells[0].textContent;
            const question = row.cells[1].innerHTML; // Mantém HTML
            const checkbox = row.querySelector('input');

            card.innerHTML = `
                <div class="mobile-card-header">Item ${num}</div>
                <div class="mobile-card-body"><p class="q-text">${question}</p></div>
                <div class="mobile-card-action">
                    <label style="display:flex; align-items:center; gap:10px; width:100%; padding:10px;">
                        <input type="checkbox" id="mob-cb-${index}" ${checkbox.checked?'checked':''} style="transform:scale(1.5);">
                        <span style="font-weight:bold;">Sim (Risco)</span>
                    </label>
                </div>
            `;

            // Sync
            document.getElementById(`mob-cb-${index}`).addEventListener('change', (e) => {
                checkbox.checked = e.target.checked;
            });

            counter.textContent = `${index + 1} / ${rows.length}`;
            prev.disabled = index === 0;
            if (index === rows.length - 1) {
                next.textContent = "Concluir";
            } else {
                next.textContent = "Próxima ❯";
            }
        };

        // Limpa listeners antigos (clone)
        const newPrev = prev.cloneNode(true);
        prev.parentNode.replaceChild(newPrev, prev);
        const newNext = next.cloneNode(true);
        next.parentNode.replaceChild(newNext, next);

        newPrev.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentIndex > 0) showItem(--currentIndex);
        });

        newNext.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentIndex < rows.length - 1) {
                showItem(++currentIndex);
            } else {
                document.querySelector('.risk-buttons-area').scrollIntoView({behavior:'smooth'});
            }
        });

        showItem(0);
    }
};

export default CalculatorUI;
