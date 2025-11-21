/* js/state.js (vFinal - Reconstruído para Compatibilidade) */

const State = {
    // Dados em memória
    registeredTrees: [],
    activeTab: 'conceitos-basicos',
    lastEvaluatorName: '',
    currentTreePhoto: null, // Blob da foto atual
    editingTreeId: null,    // ID da árvore sendo editada

    // Configurações
    storageKey: 'arboria_trees_v1',

    // === 1. INICIALIZAÇÃO ===
    init() {
        console.log('[State] Carregando dados...');
        this.loadDataFromStorage();
    },

    // === 2. GETTERS & SETTERS ===
    getAllTrees() {
        return this.registeredTrees;
    },

    getTreeById(id) {
        return this.registeredTrees.find(t => t.id === id);
    },

    getActiveTab() {
        return this.activeTab;
    },

    saveActiveTab(tabId) {
        this.activeTab = tabId;
    },

    setCurrentTreePhoto(blob) {
        this.currentTreePhoto = blob;
    },

    getCurrentTreePhoto() {
        return this.currentTreePhoto;
    },

    setEditingTreeId(id) {
        this.editingTreeId = id;
    },

    getEditingTreeId() {
        return this.editingTreeId;
    },
    
    setLastEvaluatorName(name) {
        this.lastEvaluatorName = name;
        // Opcional: Salvar em localStorage separado
        localStorage.setItem('arboria_last_evaluator', name);
    },

    // === 3. CRUD (Dados) ===
    addTree(treeData) {
        this.registeredTrees.push(treeData);
        this.saveToStorage();
        this.notifyChange(); // Avisa a UI
        return treeData;
    },

    updateTree(updatedTree) {
        const index = this.registeredTrees.findIndex(t => t.id === updatedTree.id);
        if (index !== -1) {
            this.registeredTrees[index] = updatedTree;
            this.saveToStorage();
            this.notifyChange();
            return true;
        }
        return false;
    },

    removeTree(id) {
        const initialLength = this.registeredTrees.length;
        this.registeredTrees = this.registeredTrees.filter(t => t.id !== id);
        
        if (this.registeredTrees.length < initialLength) {
            this.saveToStorage();
            this.notifyChange();
            return true;
        }
        return false;
    },

    clearAll() {
        this.registeredTrees = [];
        this.saveToStorage();
        this.notifyChange();
    },

    // === 4. PERSISTÊNCIA ===
    saveToStorage() {
        try {
            const json = JSON.stringify(this.registeredTrees);
            localStorage.setItem(this.storageKey, json);
        } catch (e) {
            console.error('[State] Erro ao salvar:', e);
        }
    },

    loadDataFromStorage() {
        try {
            const json = localStorage.getItem(this.storageKey);
            if (json) {
                this.registeredTrees = JSON.parse(json);
            }
            // Carrega avaliador
            const evaluator = localStorage.getItem('arboria_last_evaluator');
            if (evaluator) this.lastEvaluatorName = evaluator;
        } catch (e) {
            console.error('[State] Erro ao carregar:', e);
            this.registeredTrees = [];
        }
    },

    // Notificação simples via evento customizado
    notifyChange() {
        document.dispatchEvent(new CustomEvent('arboria:data-updated'));
    }
};

// Inicializa automaticamente
State.init();

/* CORREÇÃO DO ERRO "does not provide an export named default" */
export default State;

/* Mantém exportações nomeadas para compatibilidade com código antigo se houver */
export const loadDataFromStorage = State.loadDataFromStorage.bind(State);
export const saveActiveTab = State.saveActiveTab.bind(State);
export const getActiveTab = State.getActiveTab.bind(State);
export const setLastEvaluatorName = State.setLastEvaluatorName.bind(State);
export const setCurrentTreePhoto = State.setCurrentTreePhoto.bind(State);
export const setEditingTreeId = State.setEditingTreeId.bind(State);
