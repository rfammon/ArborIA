const DB_NAME = "treeImageCacheDB"; // Changed DB name to reflect caching
const STORE_NAME = "imageObjects"; // Changed store name
const DB_VERSION = 1;

// Variável interna do módulo para segurar a conexão
let dbInstance = null;

/**
 * Inicializa o banco de dados IndexedDB para cache de imagens.
 */
export function initImageDB() {
    console.log("IndexedDB: Inicializando cache de imagens...");
    if (!window.indexedDB) {
        console.warn("IndexedDB: Navegador não suporta IndexedDB para cache de imagens.");
        showToast("Erro: Navegador incompatível com cache de imagens.", "error");
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("IndexedDB: Erro crítico ao carregar banco de cache de imagens.", event.target.error);
        showToast("Erro crítico ao carregar cache de imagens.", "error");
    };

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
        // Se a store existir e usar keyPath 'id', deve ser removida e recriada
        if (database.objectStoreNames.contains("treeImages")) { // Old store name
            database.deleteObjectStore("treeImages");
        }
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "url" }); // Use 'url' as keyPath
        }
    };

    request.onsuccess = (event) => {
        dbInstance = event.target.result;
        console.log("IndexedDB: Cache de imagens inicializado com sucesso.");
        dbInstance.onerror = (event) => {
            console.error("IndexedDB: Erro no banco de cache de imagens:", event.target.error);
        };
    };
}

/**
 * Salva uma imagem no cache local usando sua URL.
 * @param {string} url - A URL da imagem (será usada como chave).
 * @param {Blob} blob - O arquivo de imagem (Blob).
 * @returns {Promise<void>}
 */
export function saveImageByUrl(url, blob) {
    return new Promise((resolve, reject) => {
        if (!dbInstance) {
            console.warn("IndexedDB: Banco de cache de imagens não está pronto.");
            reject(new Error("IndexedDB não está pronto."));
            return;
        }

        try {
            const transaction = dbInstance.transaction([STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.put({ url: url, imageBlob: blob });

            request.onsuccess = () => {
                // console.log(`IndexedDB: Imagem cacheada: ${url}`);
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB: Erro ao salvar imagem no cache local.", event.target.error);
                showToast("Erro ao salvar a foto no cache local.", "error");
                reject(event.target.error);
            };
        } catch (e) {
            console.error("IndexedDB: Exceção ao salvar imagem no cache.", e);
            reject(e);
        }
    });
}

/**
 * Recupera uma imagem do cache local usando sua URL.
 * @param {string} url - A URL da imagem.
 * @returns {Promise<Blob|null>} - Promise que resolve com o blob ou null.
 */
export function getImageByUrl(url) {
    return new Promise((resolve) => {
        if (!dbInstance) {
            console.warn("IndexedDB: Banco de cache de imagens não está pronto.");
            resolve(null);
            return;
        }

        try {
            const transaction = dbInstance.transaction([STORE_NAME], "readonly");
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.get(url);

            request.onsuccess = (event) => {
                if (event.target.result) {
                    // console.log(`IndexedDB: Imagem recuperada do cache: ${url}`);
                    resolve(event.target.result.imageBlob);
                } else {
                    // console.log(`IndexedDB: Imagem não encontrada no cache: ${url}`);
                    resolve(null);
                }
            };
            request.onerror = (event) => {
                console.error("IndexedDB: Erro ao recuperar imagem do cache.", event.target.error);
                resolve(null); // Resolve com null em caso de erro também
            };
        } catch (e) {
            console.error("IndexedDB: Exceção ao recuperar imagem do cache.", e);
            resolve(null);
        }
    });
}

/**
 * DEPRECATED: Salva uma imagem no banco.
 * Use saveImageByUrl(url, blob) para imagens de árvores.
 * @param {number|string} id - ID da árvore (legado).
 * @param {Blob} blob - O arquivo de imagem.
 */
export function saveImageToDB(id, blob) {
    console.warn("saveImageToDB(id, blob) está depreciado. Use saveImageByUrl(url, blob).");
    // For compatibility, if still used, attempt to save, but warn.
    // Ideally, this function should be removed or completely refactored.
    // For now, let's just make it call the new function with a dummy URL if ID is not a URL
    if (typeof id === 'string' && id.startsWith('http')) {
        return saveImageByUrl(id, blob);
    } else {
        return saveImageByUrl(`legacy-id-${id}`, blob); // Use a dummy URL for legacy IDs
    }
}

/**
 * DEPRECATED: Recupera uma imagem do banco.
 * Use getImageByUrl(url) para imagens de árvores.
 * @param {number|string} id - ID da árvore (legado).
 * @param {function} callback - (OPCIONAL) Função que recebe o blob (ou null).
 * @returns {Promise<Blob|null>} - Promise que resolve com o blob ou null.
 */
export function getImageFromDB(id, callback) {
    console.warn("getImageFromDB(id, callback) está depreciado. Use getImageByUrl(url).");
    const promise = (typeof id === 'string' && id.startsWith('http')) ? getImageByUrl(id) : getImageByUrl(`legacy-id-${id}`);
    if (callback && typeof callback === 'function') {
        promise.then(blob => callback(blob));
    }
    return promise;
}

/**
 * DEPRECATED: Deleta uma imagem do banco.
 * Use deleteImageByUrl(url).
 */
export function deleteImageFromDB(id) {
    console.warn("deleteImageFromDB(id) está depreciado. Use deleteImageByUrl(url).");
    if (!dbInstance) return;
    try {
        const transaction = dbInstance.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        objectStore.delete(typeof id === 'string' && id.startsWith('http') ? id : `legacy-id-${id}`);
    } catch (e) {
        console.error("IndexedDB: Exceção ao deletar imagem legacy.", e);
    }
}

/**
 * Deleta uma imagem do cache local usando sua URL.
 * @param {string} url - A URL da imagem.
 * @returns {Promise<void>}
 */
export function deleteImageByUrl(url) {
    return new Promise((resolve, reject) => {
        if (!dbInstance) {
            reject(new Error("IndexedDB não está pronto."));
            return;
        }
        try {
            const transaction = dbInstance.transaction([STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.delete(url);

            request.onsuccess = () => {
                console.log(`IndexedDB: Imagem removida do cache: ${url}`);
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB: Erro ao deletar imagem do cache.", event.target.error);
                reject(event.target.error);
            };
        } catch (e) {
            console.error("IndexedDB: Exceção ao deletar imagem do cache.", e);
            reject(e);
        }
    });
}


/**
 * Recupera TODAS as imagens (para exportação ZIP).
 * @returns {Promise<Array<Object>>} - Promise que resolve com um array de objetos { url: string, imageBlob: Blob }.
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
            console.error("IndexedDB: Erro ao recuperar todas as imagens do cache.", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Deleta completamente o banco de dados IndexedDB de cache de imagens.
 */
export function clearImageDB() {
     return new Promise((resolve, reject) => {
        if (dbInstance) {
            dbInstance.close();
            dbInstance = null;
        }

        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

        deleteRequest.onsuccess = () => {
            console.log("IndexedDB: Cache de imagens limpo com sucesso.");
            resolve();
        };

        deleteRequest.onerror = (event) => {
            console.error(`IndexedDB: Erro ao deletar o banco de dados ${DB_NAME}:`, event.target.error);
            reject(new Error("Não foi possível limpar o cache de imagens."));
        };

        deleteRequest.onblocked = (event) => {
            console.warn(`IndexedDB: A exclusão do banco de dados ${DB_NAME} está bloqueada.`);
            reject(new Error("A limpeza do cache de imagens foi bloqueada. Por favor, feche todas as outras abas deste aplicativo e tente novamente."));
        };
    });
}