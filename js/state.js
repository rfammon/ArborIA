/* js/state.js (vFinal)
   Gerenciador de Estado Global (State Management)
   Responsável por: Armazenar dados, Salvar no LocalStorage, Notificar UI.
*/

const State = {
    // Dados em memória
    trees: [],
    currentUser: null,
    
    // Configurações
    storageKey: 'arboria_trees_v1',

    // Inicialização
    init() {
        console.log('[State] Inicializando Estado...');
        this.loadFromStorage();
    },

    // --- MÉTODOS DE DADOS (CRUD) ---

    // Adicionar nova árvore
    addTree(treeData) {
        // Garante que tenha um ID único
        if (!treeData.id) {
            treeData.id = Date.now().toString();
        }
        
        // Adiciona carimbo de tempo se não houver
        if (!treeData.createdAt) {
            treeData.createdAt = new Date().toISOString();
        }

        this.trees.push(treeData);
        this.saveToStorage();
        console.log('[State] Árvore adicionada:', treeData.id);
        
        return treeData;
    },

    // Remover árvore pelo ID
    removeTree(id) {
        const initialLength = this.trees.length;
        this.trees = this.trees.filter(t => t.id !== id);
        
        if (this.trees.length < initialLength) {
            this.saveToStorage();
            console.log('[State] Árvore removida:', id);
            return true;
        }
        return false;
    },

    // Obter todas as árvores
    getAllTrees() {
        return this.trees;
    },

    // Limpar tudo (Cuidado!)
    clearAll() {
        this.trees = [];
        this.saveToStorage();
        console.log('[State] Banco de dados limpo.');
    },

    // --- PERSISTÊNCIA (LocalStorage) ---

    saveToStorage() {
        try {
            const json = JSON.stringify(this.trees);
            localStorage.setItem(this.storageKey, json);
        } catch (e) {
            console.error('[State] Erro ao salvar no LocalStorage:', e);
            alert('Erro: Limite de armazenamento do navegador atingido. Exporte seus dados ou apague itens antigos.');
        }
    },

    loadFromStorage() {
        try {
            const json = localStorage.getItem(this.storageKey);
            if (json) {
                this.trees = JSON.parse(json);
                console.log(`[State] ${this.trees.length} árvores carregadas.`);
            }
        } catch (e) {
            console.error('[State] Erro ao ler do LocalStorage:', e);
            this.trees = [];
        }
    },

    // --- UTILITÁRIOS ---
    
    // Exportar para arquivo (JSON/Texto)
    exportData() {
        return JSON.stringify(this.trees, null, 2);
    },

    // Importar de arquivo (JSON)
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                // Mescla ou substitui? Vamos mesclar para segurança.
                const existingIds = new Set(this.trees.map(t => t.id));
                let count = 0;
                
                data.forEach(item => {
                    if (!existingIds.has(item.id)) {
                        this.trees.push(item);
                        count++;
                    }
                });
                
                this.saveToStorage();
                return { success: true, count: count };
            }
            return { success: false, message: 'Formato inválido: deve ser uma lista.' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
};

/* CORREÇÃO CRÍTICA: Export Default para main.js */
export default State;
