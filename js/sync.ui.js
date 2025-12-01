/* js/sync.ui.js */

import { showConfirmModal } from './modal.ui.js';
import { handleClearAll, handleImportZip } from './features.js';
import { TableUI } from './table.ui.js';
import * as mapUI from './map.ui.js';
import { loadFromSupabase, saveToSupabase } from './sync-features.js';
import { RealtimeService } from './realtime.service.js';

export const SyncUI = (() => {
    const modalId = 'sync-modal';
    let modalElement = null;

    const init = () => {
        modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error('Sync Modal element not found in the DOM.');
            return;
        }

        const closeButton = document.getElementById('close-sync-modal-btn');
        if (closeButton) {
            closeButton.addEventListener('click', hideModal);
        }

        window.addEventListener('click', (event) => {
            if (event.target === modalElement) {
                hideModal();
            }
        });

        setupEventListeners();
    };

    const setupEventListeners = () => {
        const btnClear = document.getElementById('btn-clear-local-data');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                showConfirmModal(
                    "Excluir Todos os Dados Locais?",
                    "Esta ação é irreversível e apagará todas as árvores e fotos salvas neste dispositivo. Deseja continuar?",
                    () => {
                        handleClearAll(); 
                        TableUI.render();
                        mapUI.updateMapData(true);
                        hideModal();
                    }
                );
            });
        }

        const btnLoad = document.getElementById('btn-load-from-supabase');
        if (btnLoad) {
            btnLoad.addEventListener('click', loadFromSupabase);
        }

        const btnSave = document.getElementById('btn-save-to-supabase');
        if (btnSave) {
            btnSave.addEventListener('click', saveToSupabase);
        }

        const btnImport = document.getElementById('btn-import-zip');
        const inputZip = document.getElementById('import-zip-input');
        if (btnImport && inputZip) {
            btnImport.addEventListener('click', () => inputZip.click());
            inputZip.addEventListener('change', async (e) => {
                await handleImportZip(e);
                TableUI.render();
                mapUI.updateMapData(true);
                hideModal();
            });
        }

        const realtimeSwitch = document.getElementById('realtime-sync-switch');
        if (realtimeSwitch) {
            realtimeSwitch.addEventListener('change', (e) => {
                if (e.target.checked) {
                    RealtimeService.subscribe();
                } else {
                    RealtimeService.unsubscribe();
                }
            });
        }
    };

    const showModal = () => {
        if (modalElement) {
            modalElement.style.display = 'flex'; // Use flex to match overlay style
            setTimeout(() => {
                if (modalElement) modalElement.style.opacity = 1;
            }, 10);
        }
    };

    const hideModal = () => {
        if (modalElement) {
            modalElement.style.opacity = 0;
            setTimeout(() => {
                if (modalElement) modalElement.style.display = 'none';
            }, 300); // Match CSS transition
        }
    };

    return {
        init,
        showModal,
        hideModal
    };
})();
