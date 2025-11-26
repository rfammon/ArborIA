/**
 * ARBORIA 2.0 - DATABASE
 * Gerenciamento de imagens via IndexedDB.
 * Refatorado para manter a conexão local e evitar dependências circulares.
 */

import { showToast } from './utils.js';

const DB_NAME = "treeImageDB";
const STORE_NAME = "treeImages";
const DB_VERSION = 1;

// Variável interna do módulo para segurar a conexão (Substitui o state.db)
let dbInstance = null;

/**
 * Inicializa o banco de dados IndexedDB para imagens.
 */
export function initImageDB() {
    
    
    if (!window.indexedDB) {
        
        showToast("Erro: Navegador incompatível com banco de imagens.", "error");
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION); 

    request.onerror = (event) => {
        
        showToast("Erro crítico ao carregar banco de imagens.", "error");
    };

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
    };

    request.onsuccess = (event) => {
        dbInstance = event.target.result; // Armazena a conexão localmente
        
        
        dbInstance.onerror = (event) => {
            
        };
    };
}

/**
 * Salva uma imagem no banco.
 * @param {number} id - ID da árvore.
 * @param {Blob} blob - O arquivo de imagem.
 */
export function saveImageToDB(id, blob) {
    if (!dbInstance) {
        
        // Se por acaso a conexão caiu ou não iniciou, tenta abrir de novo (fallback)
        // Mas idealmente o initImageDB já rodou no main.js
        return;
    }
    
    try {
        const transaction = dbInstance.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.put({ id: id, imageBlob: blob });
        
        request.onsuccess = () => {
            // Silencioso no sucesso para não spammar o usuário, logs apenas se necessário
            // 
        };

        request.onerror = (event) => {
            
            showToast("Erro ao salvar a foto no banco local.", "error");
        };
    } catch (e) {
        
    }
}

/**
 * Recupera uma imagem do banco.
 * @param {number} id - ID da árvore.
 * @param {function} callback - Função que recebe o blob (ou null).
 */
export function getImageFromDB(id, callback) {
    if (!dbInstance) {
        
        callback(null);
        return;
    }
    try {
        const transaction = dbInstance.transaction([STORE_NAME], "readonly");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.get(id);

        request.onsuccess = (event) => {
            if (event.target.result) {
                callback(event.target.result.imageBlob);
            } else {
                callback(null);
            }
        };
        request.onerror = () => callback(null);
    } catch (e) {
        
        callback(null);
    }
}

/**
 * Deleta uma imagem do banco.
 */
export function deleteImageFromDB(id) {
    if (!dbInstance) return;
    try {
        const transaction = dbInstance.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        objectStore.delete(id);
    } catch (e) {
        
    }
}

/**
 * Recupera TODAS as imagens (para exportação ZIP).
 * Retorna uma Promise.
 */
export function getAllImagesFromDB() {
    return new Promise((resolve, reject) => {
        if (!dbInstance) {
            return reject(new Error("Banco de dados de imagens fechado ou não inicializado."));
        }
        const transaction = dbInstance.transaction([STORE_NAME], "readonly");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Limpa todo o banco de imagens (Reset).
 */
export function clearImageDB() {
     return new Promise((resolve, reject) => {
        if (!dbInstance) {
            return reject(new Error("Banco de dados fechado."));
        }
        const transaction = dbInstance.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}
