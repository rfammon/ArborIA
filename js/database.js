// js/database.js
// Módulo responsável pelo armazenamento de imagens no IndexedDB

import { showToast } from './utils.js';
import { setDb, db as stateDb } from './state.js'; 

const DB_NAME = "treeImageDB";
const STORE_NAME = "treeImages";
const DB_VERSION = 1;

/**
 * Inicializa o banco de dados IndexedDB para imagens.
 */
export function initImageDB() {
    console.log("Iniciando ImageDB...");
    if (!window.indexedDB) {
        console.error("Seu navegador não suporta IndexedDB.");
        showToast("Erro: Navegador incompatível com banco de imagens.", "error");
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION); 

    request.onerror = (event) => {
        console.error("Erro ao abrir IndexedDB:", event.target.error);
        showToast("Erro crítico ao carregar banco de imagens.", "error");
    };

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
    };

    request.onsuccess = (event) => {
        const database = event.target.result;
        setDb(database); 
        console.log("Banco de imagens (IndexedDB) pronto.");
        
        database.onerror = (event) => {
            console.error("Erro genérico no IndexedDB: ", event.target.error);
        };
    };
}

/**
 * Salva uma imagem no banco.
 */
export function saveImageToDB(id, blob) {
    // Verifica se o banco está aberto acessando o estado global
    // Nota: Precisamos ler o estado atual, pois 'db' pode ser null na inicialização
    const database = stateDb; 
    
    if (!database) {
        console.warn("Tentativa de salvar imagem sem conexão com DB.");
        return;
    }
    
    try {
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.put({ id: id, imageBlob: blob });
        
        request.onerror = (event) => {
            console.error("Erro ao salvar imagem:", event.target.error);
            showToast("Erro ao salvar a foto.", "error");
        };
    } catch (e) {
        console.error("Erro na transação saveImage:", e);
    }
}

/**
 * Recupera uma imagem do banco.
 */
export function getImageFromDB(id, callback) {
    const database = stateDb;
    if (!database) {
        callback(null);
        return;
    }
    try {
        const transaction = database.transaction([STORE_NAME], "readonly");
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
        console.error("Erro transaction getImage:", e);
        callback(null);
    }
}

/**
 * Deleta uma imagem.
 */
export function deleteImageFromDB(id) {
    const database = stateDb;
    if (!database) return;
    try {
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        objectStore.delete(id);
    } catch (e) {
        console.error("Erro deleteImage:", e);
    }
}

/**
 * Recupera TODAS as imagens (para exportação ZIP).
 */
export function getAllImagesFromDB() {
    return new Promise((resolve, reject) => {
        const database = stateDb;
        if (!database) {
            return reject(new Error("Banco de dados fechado."));
        }
        const transaction = database.transaction([STORE_NAME], "readonly");
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
 * Limpa todo o banco de imagens.
 */
export function clearImageDB() {
     return new Promise((resolve, reject) => {
        const database = stateDb;
        if (!database) {
            return reject(new Error("Banco de dados fechado."));
        }
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}
