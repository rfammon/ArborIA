/**
 * ARBORIA 2.0 - MAP UI (v58.1 Refatorado)
 * Gerenciamento do Leaflet.js, Popups e Geolocalização.
 * Atualizado para Design System 2.0 e Sanitização de HTML.
 */

import * as state from './state.js';
import * as features from './features.js';
import { getImageFromDB } from './database.js';
import { showToast } from './utils.js';

const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let currentInfoBoxZoom = 0;
const ZOOM_LEVELS = [280, 400, 550];

let userLocationMarker = null; 
let userAccuracyCircle = null;
let locationWatchId = null;

export let currentLayerType = 'satellite'; 
let osmLayer = null;
let satelliteLayer = null;

// === FUNÇÕES PRIVADAS ===

function handleMapFilterChange(e) {
  const selectedRisk = e.target.value;
  if (!state.mapMarkerGroup) return;
  
  state.mapMarkerGroup.eachLayer(layer => {
    if (layer.options.isTreeMarker) {
        if (selectedRisk === 'Todos' || layer.options.riskLevel === selectedRisk) {
            layer.setStyle({ opacity: 1, fillOpacity: 0.8 });
            if(layer.getTooltip()) layer.openTooltip();
            // Traz para frente para não ficar escondido atrás dos invisíveis
            layer.bringToFront();
        } else {
            layer.setStyle({ opacity: 0, fillOpacity: 0 });
            if(layer.getTooltip()) layer.closeTooltip();
        }
    }
  });
  hideMapInfoBox();
}

function hideMapInfoBox() {
  const infoBox = document.getElementById('map-info-box');
  if (infoBox) {
    const img = infoBox.querySelector('img');
    if (img && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    infoBox.classList.add('hidden');
    infoBox.innerHTML = '';
  }
}

/**
 * Exibe o card flutuante de informações da árvore.
 * Refatorado para criar elementos DOM (Segurança contra XSS).
 */
function showMapInfoBox(tree) {
  const infoBox = document.getElementById('map-info-box');
  if (!infoBox) return;

  // Limpa conteúdo anterior
  infoBox.innerHTML = '';
  infoBox.className = ''; // Remove classes antigas

  // Define cores baseadas no Design System
  let colorCode = '#388e3c'; // Verde
  let riskLabel = 'Baixo Risco';
  
  if (tree.risco === 'Alto Risco') { colorCode = '#d32f2f'; riskLabel = 'Alto Risco'; }
  else if (tree.risco === 'Médio Risco') { colorCode = '#f57c00'; riskLabel = 'Médio Risco'; }

  // --- Header do Card ---
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;";
  
  const title = document.createElement('strong');
  title.textContent = `ID: ${tree.id}`;
  title.style.color = '#00796b';

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = "font-size:1.5rem; border:none; background:none; cursor:pointer; color:#999;";
  closeBtn.onclick = hideMapInfoBox;

  headerDiv.appendChild(title);
  headerDiv.appendChild(closeBtn);
  infoBox.appendChild(headerDiv);

  // --- Corpo do Card ---
  const pSpecies = document.createElement('p');
  pSpecies.innerHTML = `<strong>Espécie:</strong> `;
  pSpecies.appendChild(document.createTextNode(tree.especie)); // Sanitizado
  infoBox.appendChild(pSpecies);

  const pRisk = document.createElement('p');
  pRisk.innerHTML = `<strong>Risco:</strong> <span style="color:${colorCode}; font-weight:bold;">${riskLabel}</span>`;
  infoBox.appendChild(pRisk);

  // --- Foto (Placeholder) ---
  let photoContainer = null;
  if (tree.hasPhoto) {
    photoContainer = document.createElement('div');
    photoContainer.id = 'map-info-photo';
    photoContainer.textContent = 'Carregando foto...';
    photoContainer.style.cssText = "margin: 10px 0; min-height: 100px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.8rem; color: #666;";
    infoBox.appendChild(photoContainer);
  }

  // --- Ações ---
  const actionDiv = document.createElement('div');
  actionDiv.style.marginTop = '10px';
  
  const btnGoto = document.createElement('button');
  btnGoto.textContent = '📄 Ver Detalhes';
  btnGoto.className = 'hud-action-btn'; // Estilo pílula
  btnGoto.style.fontSize = '0.8rem';
  btnGoto.style.padding = '6px 12px';
  btnGoto.onclick = () => features.handleMapMarkerClick(tree.id);
  
  actionDiv.appendChild(btnGoto);
  infoBox.appendChild(actionDiv);

  // Mostra o box
  infoBox.style.display = 'block'; // Garante display
  infoBox.classList.remove('hidden');

  // --- Carregamento Assíncrono da Foto ---
  if (tree.hasPhoto && photoContainer) {
    getImageFromDB(tree.id, (imageBlob) => {
      if (imageBlob) {
        const imgUrl = URL.createObjectURL(imageBlob);
        photoContainer.innerHTML = ''; // Limpa "Carregando..."
        const img = document.createElement('img');
        img.src = imgUrl;
        img.style.cssText = "width:100%; border-radius:8px; object-fit:cover; max-height:150px;";
        photoContainer.appendChild(img);
      } else {
        photoContainer.textContent = '(Erro ao carregar foto)';
      }
    });
  }
}

function renderMapMarkers() {
  if (!state.mapMarkerGroup) return;
  state.mapMarkerGroup.clearLayers();
  
  state.registeredTrees.forEach(tree => {
    const coords = features.convertToLatLon(tree);
    if (coords) {
      let color, radius = 6;
      let labelClass = 'lbl-low';
      if (tree.risco === 'Alto Risco') { color = '#d32f2f'; radius = 8; labelClass = 'lbl-high'; }
      else if (tree.risco === 'Médio Risco') { color = '#f57c00'; radius = 7; labelClass = 'lbl-med'; }
      else { color = '#388e3c'; radius = 6; labelClass = 'lbl-low'; }

      // Usamos CircleMarker para performance e escala fixa
      const circle = L.circleMarker(coords, { 
          color: '#ffffff', 
          weight: 2,
          fillColor: color, 
          fillOpacity: 0.9, 
          radius: radius, 
          isTreeMarker: true, 
          riskLevel: tree.risco 
      });
      
      // Tooltip permanente com ID
      circle.bindTooltip(`${tree.id}`, { 
          permanent: true, 
          direction: 'center', 
          className: `map-id-label ${labelClass}` // Estilizado no CSS
      });
      
      circle.addTo(state.mapMarkerGroup);
      
      // Clique no marker abre o InfoBox
      circle.on('click', (e) => { 
          L.DomEvent.stopPropagation(e); 
          showMapInfoBox(tree); 
      });
    }
  });
  return state.mapMarkerGroup.getBounds();
}

// === PREPARAÇÃO DO MAPA (PDF Screenshot) ===
export async function prepareMapForScreenshot() {
    const map = state.mapInstance;
    if (!map) return false;

    const mapTabContent = document.getElementById('tab-content-mapa');
    if (mapTabContent) mapTabContent.style.display = 'block';
    map.invalidateSize();

    // Força satélite para o print ficar bonito
    if (currentLayerType !== 'satellite') {
        toggleMapLayer(); 
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const bounds = state.mapMarkerGroup.getBounds();
    if (bounds.isValid() && state.registeredTrees.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 21, animate: false });
    } else {
        map.setView([-15.78, -47.92], 4, { animate: false }); 
    }

    await new Promise(r => setTimeout(r, 2000)); 
    return true;
}

// === OUTRAS FEATURES ===
export function zoomToAllPoints() {
    if (!state.mapMarkerGroup || !state.mapInstance) return;
    const bounds = state.mapMarkerGroup.getBounds();
    if (bounds.isValid() && state.registeredTrees.length > 0) {
        state.mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });
        showToast("Zoom ajustado.", "success");
    } else {
        showToast("Nenhum ponto válido.", "warning");
    }
}

export function toggleMapLayer() {
    const map = state.mapInstance;
    const btn = document.getElementById('toggle-map-layer-btn');
    if (!map || !osmLayer || !satelliteLayer) return;

    if (currentLayerType === 'osm') {
        map.removeLayer(osmLayer); map.addLayer(satelliteLayer); currentLayerType = 'satellite';
        if(btn) { btn.innerHTML = '🗺️ Ruas'; btn.style.borderColor = '#0277BD'; btn.style.color = '#0277BD'; }
    } else {
        map.removeLayer(satelliteLayer); map.addLayer(osmLayer); currentLayerType = 'osm';
        if(btn) { btn.innerHTML = '🌎 Satélite'; btn.style.borderColor = '#2E7D32'; btn.style.color = '#2E7D32'; } 
    }
}

// === SETUP ===
export function setupMapListeners() {
  const mapLegend = document.getElementById('map-legend-filter');
  const zoomBtn = document.getElementById('zoom-to-extent-btn');
  const layerBtn = document.getElementById('toggle-map-layer-btn');
  const locBtn = document.getElementById('show-my-location-btn');
  
  if (mapLegend) mapLegend.addEventListener('change', handleMapFilterChange);
  if (zoomBtn) zoomBtn.addEventListener('click', zoomToAllPoints);
  if (layerBtn) layerBtn.addEventListener('click', toggleMapLayer);
  if (locBtn) locBtn.addEventListener('click', toggleUserLocation);
}

export function initializeMap() {
  const mapContainer = document.getElementById('map-container');
  
  // Verifica se Leaflet está carregado
  if (!mapContainer || typeof L === 'undefined') {
      console.warn("Leaflet não carregado ou container ausente.");
      return;
  }

  let map = state.mapInstance;

  if (!map) {
    map = L.map('map-container', { tap: false, preferCanvas: true }).setView([-15.78, -47.92], 4);
    state.setMapInstance(map);
    state.setMapMarkerGroup(L.featureGroup().addTo(map));
    
    // Fecha info box ao clicar no mapa vazio
    map.on('click', hideMapInfoBox);
  }
  
  // Fix para renderização
  setTimeout(() => map.invalidateSize(), 100);

  // Layers
  if (!osmLayer || !satelliteLayer) {
      osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' });
  }

  // Layer Inicial
  if (!map.hasLayer(osmLayer) && !map.hasLayer(satelliteLayer)) {
      satelliteLayer.addTo(map);
      currentLayerType = 'satellite';
      const btn = document.getElementById('toggle-map-layer-btn');
      if(btn) { btn.innerHTML = '🗺️ Ruas'; btn.style.borderColor = '#0277BD'; btn.style.color = '#0277BD'; }
  }

  const bounds = renderMapMarkers();

  // Lógica de Zoom Inicial (Alvo ou Geral)
  if (state.zoomTargetCoords) {
    map.setView(state.zoomTargetCoords, 21); 
    state.setZoomTargetCoords(null);
    
    if (state.openInfoBoxId !== null) {
       const t = state.registeredTrees.find(x => x.id === state.openInfoBoxId);
       if(t) setTimeout(() => showMapInfoBox(t), 500);
       state.setOpenInfoBoxId(null);
    }
  } else if (bounds && bounds.isValid() && state.registeredTrees.length > 0) {
      // Só ajusta zoom se estiver muito longe (evita pular zoom se usuário já estava navegando)
      if (map.getZoom() <= 5) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });
      }
  }
}

// === GPS (Minha Posição) ===
function stopLocationWatch() {
  if (locationWatchId) { navigator.geolocation.clearWatch(locationWatchId); locationWatchId = null; }
  const btn = document.getElementById('show-my-location-btn');
  if (btn) { btn.innerHTML = '🛰️ Minha Posição'; btn.classList.remove('active-tracking'); }
}

function onLocationUpdate(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const latLng = [latitude, longitude];
  
  if (!state.mapInstance) return;
  
  if (!userLocationMarker) {
    showToast(`GPS Encontrado!`, "success");
    userLocationMarker = L.circleMarker(latLng, { radius: 8, weight: 3, color: '#FFF', fillColor: '#2196F3', fillOpacity: 1, zIndexOffset: 1000 }).addTo(state.mapInstance);
    userLocationMarker.bindPopup("Você está aqui").openPopup();
    
    userAccuracyCircle = L.circle(latLng, { radius: accuracy, color: '#2196F3', weight: 1, fillOpacity: 0.15 }).addTo(state.mapInstance);
    
    state.mapInstance.setView(latLng, 18); 
  } else {
    userLocationMarker.setLatLng(latLng);
    if (userAccuracyCircle) { 
        userAccuracyCircle.setLatLng(latLng); 
        userAccuracyCircle.setRadius(accuracy); 
    }
  }
  
  const btn = document.getElementById('show-my-location-btn');
  if (btn) btn.innerHTML = '🛰️ Rastreando...';
}

function onLocationError(error) {
  if (error.code === 3 && userLocationMarker) return; // Timeout silencioso se já tiver marker
  showToast("Sinal GPS perdido.", "error");
  stopLocationWatch();
}

export function toggleUserLocation() {
  if (!navigator.geolocation) { showToast("GPS não suportado neste navegador.", "error"); return; }
  
  if (locationWatchId) { 
      stopLocationWatch(); 
      showToast("Rastreamento pausado.", "info"); 
  } else {
    const btn = document.getElementById('show-my-location-btn');
    if (btn) btn.innerHTML = '🛰️ Buscando...';
    
    locationWatchId = navigator.geolocation.watchPosition(
        onLocationUpdate, 
        onLocationError, 
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  }
}
