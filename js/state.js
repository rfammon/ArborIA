// js/state.js (v24.1 - Adiciona Rastreamento de Localização)

// === 1. Chaves de Armazenamento ===
const STORAGE_KEY = 'manualPodaData';
const ACTIVE_TAB_KEY = 'manualPodaActiveTab';

// === 2. Estado Global da Aplicação ===

export let registeredTrees = [];
export let db = null;
export let mapInstance = null;
export let mapMarkerGroup = null;
export let currentTooltip = null;

export let sortState = {
  key: 'id',
  direction: 'asc'
};

// Variáveis de estado temporárias
export let lastEvaluatorName = '';
export let toastTimer = null;
export let lastUtmZone = { num: 0, letter: 'Z' };
export let zoomTargetCoords = null;
export let highlightTargetId = null;
export let currentTreePhoto = null;
export let editingTreeId = null; // (v23.5)
export let openInfoBoxId = null; // (v23.6)

// [NOVO v24.1] Rastreamento de localização do usuário
export let userLocationWatchId = null;
export let userLocationMarker = null;


// === 3. Funções "Setters" ===

export function setRegisteredTrees(newTrees) {
  registeredTrees = newTrees;
}
export function setDb(databaseInstance) {
  db = databaseInstance;
}
export function setMapInstance(map) {
  mapInstance = map;
}
export function setMapMarkerGroup(group) {
  mapMarkerGroup = group;
}
export function setCurrentTooltip(tooltip) {
  currentTooltip = tooltip;
}
export function setSortState(key, direction) {
  sortState.key = key;
  sortState.direction = direction;
}
export function setLastEvaluatorName(name) {
  lastEvaluatorName = name;
}
export function setToastTimer(timer) {
  toastTimer = timer;
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
 * [NOVO v23.6] Define o ID do InfoBox que deve ser aberto no mapa.
 * @param {number | null} id O ID da árvore ou null.
 */
export function setOpenInfoBoxId(id) {
  openInfoBoxId = id;
}

// [NOVO v24.1] Setters de Localização
export function setUserLocationWatchId(id) {
  userLocationWatchId = id;
}
export function setUserLocationMarker(marker) {
  userLocationMarker = marker;
}

// === 4. Funções de Persistência (LocalStorage) ===

/**
 * Salva o array 'registeredTrees' no LocalStorage.
 */
export function saveDataToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registeredTrees));
  } catch (e) {
    console.error("Erro ao salvar dados no localStorage:", e);
  }
}

/**
 * Carrega os dados do LocalStorage para o estado 'registeredTrees'.
 */
export function loadDataFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      registeredTrees = JSON.parse(data);
    }
  } catch (e) {
    console.error("Erro ao ler dados do localStorage:", e);
    registeredTrees = []; // Garante que o estado seja limpo em caso de erro
  }
}

/**
 * Salva a última aba ativa no LocalStorage.
 * @param {string} tabKey O 'data-target' da aba (ex: 'conceitos-basicos')
 */
export function saveActiveTab(tabKey) {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tabKey);
  } catch (e) {
    console.error("Erro ao salvar a aba ativa:", e);
  }
}

/**
 * Busca a última aba ativa salva no LocalStorage.
 * @returns {string | null} A chave da última aba salva.
 */
export function getActiveTab() {
  try {
    return localStorage.getItem(ACTIVE_TAB_KEY);
  } catch (e) {
    console.error("Erro ao ler a aba ativa:", e);
    return null;
  }
}