/* js/state.js (vFinal - Reconstruído)
   Gerenciador de Estado Global (Database Local).
   Responsável por: CRUD de Árvores, Persistência (LocalStorage) e Notificação de UI.
*/

const State = {
    // Armazenamento em memória
    trees: [],
    
    // Chave do LocalStorage
    storageKey: 'arboria_trees_v1',

    // === 1. INICIALIZAÇÃO ===
    init() {
        console.log('[State] Inicializando Banco de Dados...');
        this.loadFromStorage();
    },

    // === 2. CRUD (Create, Read, Delete) ===

    // Adicionar nova árvore
    addTree(treeData) {
        // Validação básica
        if (!treeData) return false;

        // Garante ID e Data
        if (!treeData.id) treeData.id = Date.now().toString(36);
        if (!treeData.createdAt) treeData.createdAt = new Date().toISOString();

        // Salva
        this.trees.push(treeData);
        this.saveToStorage();
        
        console.log('[State] Registro adicionado:', treeData.id);
        
        // Avisa o sistema que mudou (Atualiza Tabela e Badges)
        this.notifyChange();
        
        return treeData;
    },

    // Remover árvore pelo ID
    removeTree(id) {
        const initialLength = this.trees.length;
        
        // Filtra removendo o ID alvo
        this.trees = this.trees.filter(t => t.id !== id);
        
        const success = this.trees.length < initialLength;
        
        if (success) {
            this.saveToStorage();
            console.log('[State] Registro removido:', id);
            this.notifyChange();
        }
        
        return success;
    },

    // Obter todas (Read)
    getAllTrees() {
        // Retorna uma cópia para evitar mutação direta acidental
        return [...this.trees];
    },

    // Limpar Banco de Dados (Delete All)
    clearAll() {
        this.trees = [];
        this.saveToStorage();
        console.log('[State] Banco de dados limpo.');
        this.notifyChange();
    },

    // === 3. PERSISTÊNCIA (LocalStorage) ===

    saveToStorage() {
        try {
            const json = JSON.stringify(this.trees);
            localStorage.setItem(this.storageKey, json);
        } catch (e) {
            console.error('[State] Erro ao salvar (LocalStorage cheio?):', e);
            alert('Erro de Armazenamento: O navegador não permitiu salvar os dados. Tente limpar o cache.');
        }
    },

    loadFromStorage() {
        try {
            const json = localStorage.getItem(this.storageKey);
            if (json) {
                const data = JSON.parse(json);
                if (Array.isArray(data)) {
                    this.trees = data;
                    console.log(`[State] ${this.trees.length} registros carregados.`);
                }
            }
        } catch (e) {
            console.error('[State] Erro ao ler dados, iniciando vazio.', e);
            this.trees = [];
        }
    },

    // === 4. IMPORTAÇÃO / EXPORTAÇÃO ===

    // Gera JSON para backup
    exportData() {
        return JSON.stringify(this.trees, null, 2);
    },

    // Importa JSON de backup
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                // Mescla inteligentemente (evita duplicatas por ID)
                const currentIds = new Set(this.trees.map(t => t.id));
                let addedCount = 0;

                data.forEach(item => {
                    if (item.id && !currentIds.has(item.id)) {
                        this.trees.push(item);
                        addedCount++;
                    }
                });

                this.saveToStorage();
                this.notifyChange();
                return { success: true, count: addedCount };
            }
            return { success: false, message: 'Formato de arquivo inválido.' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // === 5. SISTEMA DE NOTIFICAÇÃO ===
    
    // Dispara um evento global para que a UI se atualize sozinha
    notifyChange() {
        // Cria evento customizado 'arboria:tree-updated'
        const event = new CustomEvent('arboria:tree-updated', {
            detail: { count: this.trees.length }
        });
        document.dispatchEvent(event);
    }
};

/* EXPORTAÇÃO PADRÃO (Obrigatório para main.js) */
export default State;
