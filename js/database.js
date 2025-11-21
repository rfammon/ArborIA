/* js/database.js (vFinal - Standalone)
   Gerencia o IndexedDB para armazenamento pesado (Imagens/Blobs).
   Não depende mais do state.js para a conexão 'db'.
*/

const DB_NAME = 'ArborIA_Images_DB';
const DB_VERSION = 1;
const STORE_NAME = 'tree_photos';

// Variável local para manter a conexão aberta
let db = null;

// === 1. INICIALIZAÇÃO DA CONEXÃO ===
export function initImageDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('[Database] IndexedDB conectado.');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('[Database] Erro ao abrir DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// === 2. SALVAR IMAGEM ===
export async function saveImageToDB(id, imageBlob) {
    if (!db) await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const item = {
            id: id,
            blob: imageBlob,
            updatedAt: new Date().toISOString()
        };

        const request = store.put(item);

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
            console.error('[Database] Falha ao salvar imagem:', request.error);
            reject(request.error);
        };
    });
}

// === 3. RECUPERAR IMAGEM ===
export async function getImageFromDB(id) {
    if (!db) await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
            const result = event.target.result;
            if (result && result.blob) {
                resolve(result.blob);
            } else {
                resolve(null); // Não encontrada
            }
        };

        request.onerror = () => {
            console.error('[Database] Falha ao ler imagem:', request.error);
            resolve(null); // Retorna null em vez de quebrar
        };
    });
}

// === 4. DELETAR IMAGEM ===
export async function deleteImageFromDB(id) {
    if (!db) await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// === 5. LIMPAR TUDO ===
export async function clearImageDB() {
    if (!db) await initImageDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('[Database] Todas as imagens apagadas.');
            resolve(true);
        };
        request.onerror = () => reject(request.error);
    });
}
