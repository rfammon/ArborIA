/**
 * ARBORIA 2.0 - GLOBAL STATE
 * Gerencia o estado volátil da aplicação (variáveis em memória) e persistência básica.
 * Refatorado: Removida dependência circular do Banco de Dados.
 */

// === 1. Chaves de Armazenamento (LocalStorage) ===
// Mantidas iguais para não perder dados de usuários antigos
const STORAGE_KEY = 'manualPodaData';
const ACTIVE_TAB_KEY = 'manualPodaActiveTab';

// === 2. Estado Global da Aplicação ===

// Dados Principais
export let registeredTrees = [];
// [REMOVIDO] export let db = null; -> O database.js agora gerencia sua própria conexão.

// Mapa e Visualização
export let mapInstance = null;
export let mapMarkerGroup = null;
export let zoomTargetCoords = null;
export let highlightTargetId = null;
export let openInfoBoxId = null;

// Rastreamento de Localização (GPS em tempo real no mapa)
export let userLocationWatchId = null;
export let userLocationMarker = null;

// Estado de UI e Edição
export let sortState = { key: 'id', direction: 'asc' };
export let lastEvaluatorName = '';
export let lastUtmZone = { num: 0, letter: 'Z' };
export let currentTreePhoto = null; // Blob da foto atual em memória
export let editingTreeId = null;    // ID da árvore sendo editada (null = modo adição)
export let currentTooltip = null;   // Legado (pode ser removido se TooltipUI for autônomo)

// === 3. Funções "Setters" ===
// Usadas para modificar o estado de forma controlada

export function setRegisteredTrees(newTrees) {
  registeredTrees = newTrees;
}

export function setMapInstance(map) {
  mapInstance = map;
}

export function setMapMarkerGroup(group) {
  mapMarkerGroup = group;
}

export function setSortState(key, direction) {
  sortState.key = key;
  sortState.direction = direction;
}

export function setLastEvaluatorName(name) {
  lastEvaluatorName = name;
}

export function setLastUtmZone(num, letter) {
  lastUtmZone.num = num;
  lastUtmZone.letter = letter;
}

export function setZoomTargetCoords(coords) {
  zoomTargetCoords = coords;
}

export function setHighlightTargetId(id) {
  highlightTargetId = id;
}

export function setCurrentTreePhoto(photoBlob) {
  currentTreePhoto = photoBlob;
}

export function setEditingTreeId(id) {
  editingTreeId = id;
}

/**
 * Define qual InfoBox (popup do mapa) deve abrir automaticamente
 * @param {number|null} id 
 */
export function setOpenInfoBoxId(id) {
  openInfoBoxId = id;
}

// Setters de Localização
export function setUserLocationWatchId(id) {
  userLocationWatchId = id;
}

export function setUserLocationMarker(marker) {
  userLocationMarker = marker;
}

// === 4. Funções de Persistência (LocalStorage) ===

/**
 * Salva o array 'registeredTrees' no LocalStorage (Backup síncrono rápido).
 * Nota: As fotos não vão para cá (pesadas demais), vão para o IndexedDB via database.js.
 */
export function saveDataToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registeredTrees));
  } catch (e) {
    
  }
}

/**
 * Aplica um novo conjunto de dados de árvores ao estado local.
 * @param {Array} newTrees - A nova lista de árvores.
 * @param {string} mergeOption - 'merge' para mesclar ou 'replace' para substituir.
 */
export function applyTreeChanges(newTrees, mergeOption) {
    if (mergeOption === 'replace') {
        setRegisteredTrees(newTrees);
    } else if (mergeOption === 'merge') {
        const existingTrees = [...registeredTrees];
        const newTreesMap = new Map(newTrees.map(tree => [tree.id, tree]));
        
        const mergedTrees = existingTrees.map(existingTree => {
            if (newTreesMap.has(existingTree.id)) {
                // Se o ID existe nos novos dados, substitui pelo novo
                const newTree = newTreesMap.get(existingTree.id);
                newTreesMap.delete(existingTree.id); // Remove para não adicioná-lo duas vezes
                return newTree;
            }
            return existingTree; // Mantém o antigo se não houver conflito
        });

        // Adiciona as árvores restantes do newTreesMap que não existiam no original
        mergedTrees.push(...newTreesMap.values());
        
        setRegisteredTrees(mergedTrees);
    }

    saveDataToStorage();
    console.log(`Dados aplicados com a opção: ${mergeOption}. Total de árvores: ${registeredTrees.length}`);
}

/**
 * Carrega os dados do LocalStorage para a memória.
 */
export function loadDataFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      registeredTrees = JSON.parse(data);
    }
  } catch (e) {
    
    registeredTrees = [];
  }
}

/**
 * Salva a última aba ativa (para o usuário voltar onde parou).
 */
export function saveActiveTab(tabKey) {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tabKey);
  } catch (e) {
    
  }
}

/**
 * Recupera a última aba ativa.
 */
export function getActiveTab() {
  try {
    return localStorage.getItem(ACTIVE_TAB_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Adiciona uma única árvore ao estado.
 * @param {object} tree - O objeto da árvore a ser adicionado.
 */
export function addTree(tree) {
    registeredTrees.push(tree);
    saveDataToStorage();
}

/**
 * Atualiza uma única árvore no estado.
 * @param {object} updatedTree - O objeto da árvore com os dados atualizados.
 */
export function updateTree(updatedTree) {
    const index = registeredTrees.findIndex(t => t.id === updatedTree.id);
    if (index !== -1) {
        registeredTrees[index] = updatedTree;
        saveDataToStorage();
    }
}

/**
 * Deleta uma árvore do estado pelo seu ID.
 * @param {number | string} treeId - O ID da árvore a ser deletada.
 */
export function deleteTreeById(treeId) {
    const initialLength = registeredTrees.length;
    registeredTrees = registeredTrees.filter(t => t.id !== treeId);
    if (registeredTrees.length < initialLength) {
        saveDataToStorage();
    }
}


/**
 * [NOVO] Realiza uma limpeza completa do estado da aplicação em memória.
 * Chamada durante o logout para garantir que nenhum dado de sessão residual permaneça.
 */
export function resetApplicationState() {
    console.log("Cleaning up application state...");

    // Dados Principais
    registeredTrees = [];

    // Mapa e Visualização
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
    mapMarkerGroup = null;
    zoomTargetCoords = null;
    highlightTargetId = null;
    openInfoBoxId = null;

    // Rastreamento de Localização
    if (userLocationWatchId) {
        navigator.geolocation.clearWatch(userLocationWatchId);
        userLocationWatchId = null;
    }
    userLocationMarker = null;

    // Estado de UI e Edição
    sortState = { key: 'id', direction: 'asc' };
    lastEvaluatorName = '';
    lastUtmZone = { num: 0, letter: 'Z' };
    currentTreePhoto = null;
    editingTreeId = null;
    currentTooltip = null;

    console.log("Application state has been reset.");
}
