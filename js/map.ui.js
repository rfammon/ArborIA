/**
 * ARBORIA 2.0 - MAP UI (v59.0 - Symbology & Fall Risk Radius)
 * Visualização avançada: Raios reais baseados na altura da árvore (Zona de Queda).
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
            layer.setStyle({ opacity: 1, fillOpacity: 0.6 });
            if(layer.getTooltip()) layer.openTooltip();
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

function showMapInfoBox(tree) {
  const infoBox = document.getElementById('map-info-box');
  if (!infoBox) return;

  infoBox.innerHTML = '';
  infoBox.className = ''; 

  let colorCode = '#388e3c'; 
  let riskLabel = 'Baixo Risco';
  
  if (tree.risco === 'Alto Risco') { colorCode = '#d32f2f'; riskLabel = 'Alto Risco'; }
  else if (tree.risco === 'Médio Risco') { colorCode = '#f57c00'; riskLabel = 'Médio Risco'; }

  // Header
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;";
  
  const title = document.createElement('strong');
  title.textContent = `ID: ${tree.id}`;
  title.style.color = '#00796b';

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.className = 'tooltip-close-btn';
  closeBtn.onclick = hideMapInfoBox;

  headerDiv.appendChild(title);
  headerDiv.appendChild(closeBtn);
  infoBox.appendChild(headerDiv);

  // Body
  const pSpecies = document.createElement('p');
  pSpecies.innerHTML = `<strong>Espécie:</strong> `;
  pSpecies.appendChild(document.createTextNode(tree.especie));
  infoBox.appendChild(pSpecies);

  const pRisk = document.createElement('p');
  pRisk.innerHTML = `<strong>Risco:</strong> <span style="color:${colorCode}; font-weight:bold;">${riskLabel}</span>`;
  infoBox.appendChild(pRisk);
  
  // Altura info
  const pHeight = document.createElement('p');
  pHeight.innerHTML = `<strong>Altura (Raio):</strong> ${tree.altura || '?'} m`;
  pHeight.style.fontSize = '0.85rem';
  pHeight.style.color = '#555';
  infoBox.appendChild(pHeight);

  // Photo
  let photoContainer = null;
  if (tree.hasPhoto) {
    photoContainer = document.createElement('div');
    photoContainer.id = 'map-info-photo';
    photoContainer.textContent = 'Carregando foto...';
    photoContainer.style.cssText = "margin: 10px 0; min-height: 100px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.8rem; color: #666;";
    infoBox.appendChild(photoContainer);
  }

  // Actions
  const actionDiv = document.createElement('div');
  actionDiv.style.marginTop = '10px';
  
  const btnGoto = document.createElement('button');
  btnGoto.textContent = '📄 Ver Detalhes';
  btnGoto.className = 'btn btn-primary'; 
  btnGoto.onclick = () => features.handleMapMarkerClick(tree.id);
  
  actionDiv.appendChild(btnGoto);
  infoBox.appendChild(actionDiv);

  infoBox.style.display = 'block'; 
  infoBox.classList.remove('hidden');

  if (tree.hasPhoto && photoContainer) {
    getImageFromDB(tree.id, (imageBlob) => {
      if (imageBlob) {
        const imgUrl = URL.createObjectURL(imageBlob);
        photoContainer.innerHTML = ''; 
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
      let color;
      let defaultRadius; // Em metros
      
      // Lógica de Simbologia (Cor e Tamanho Padrão)
      if (tree.risco === 'Alto Risco' || tree.riscoClass === 'risk-high') { 
          color = '#d32f2f'; // Vermelho
          defaultRadius = 8; // Grande
      } else if (tree.risco === 'Médio Risco' || tree.riscoClass === 'risk-medium') { 
          color = '#f57c00'; // Laranja
          defaultRadius = 5; // Médio
      } else { 
          color = '#388e3c'; // Verde
          defaultRadius = 3; // Pequeno
      }

      // Lógica de Raio Real (Fall Zone)
      // Se tiver altura válida, usa a altura como raio. Senão, usa o padrão do risco.
      const treeHeight = parseFloat(tree.altura);
      const radiusInMeters = (treeHeight > 0) ? treeHeight : defaultRadius;

      // [MUDANÇA] L.circle usa metros (Geográfico), L.circleMarker usa pixels (Tela)
      // Usamos L.circle para representar a projeção real da copa/queda no terreno.
      const circle = L.circle(coords, { 
          color: color, 
          weight: 1, // Borda fina
          fillColor: color, 
          fillOpacity: 0.5, // Transparente para ver o que está embaixo (zona de alvo)
          radius: radiusInMeters, 
          isTreeMarker: true, 
          riskLevel: tree.risco 
      });
      
      // Configuração do Rótulo (Label dentro do ponto)
      // O CSS .map-label-clean deve ser adicionado ao style.css ou injetado
      circle.bindTooltip(`${tree.id}`, { 
          permanent: true, 
          direction: 'center', 
          className: 'map-label-clean' 
      });
      
      circle.addTo(state.mapMarkerGroup);
      
      circle.on('click', (e) => { 
          L.DomEvent.stopPropagation(e); 
          showMapInfoBox(tree); 
      });
    }
  });
  return state.mapMarkerGroup.getBounds();
}

// === PREPARAÇÃO DO MAPA (PDF) ===
export async function prepareMapForScreenshot() {
    const map = state.mapInstance;
    if (!map) return false;

    const mapTabContent = document.getElementById('tab-content-mapa');
    if (mapTabContent) mapTabContent.style.display = 'block';
    map.invalidateSize();

    if (currentLayerType !== 'satellite') {
        toggleMapLayer(); 
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const bounds = state.mapMarkerGroup.getBounds();
    if (bounds.isValid() && state.registeredTrees.length > 0) {
        // padding reduzido e zoom alto para ver detalhes
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 20, animate: false });
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
        state.mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 20 });
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

// [REATORADO] Deve ser chamado uma vez na inicialização do aplicativo
export function setupMap() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || typeof L === 'undefined' || state.mapInstance) return; // Executa apenas uma vez

    const map = L.map('map-container', { tap: false, preferCanvas: true }).setView([-15.78, -47.92], 4);
    state.setMapInstance(map);
    state.setMapMarkerGroup(L.featureGroup().addTo(map));
    map.on('click', hideMapInfoBox);

    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' });
    
    satelliteLayer.addTo(map);
    currentLayerType = 'satellite';
    const btn = document.getElementById('toggle-map-layer-btn');
    if(btn) { btn.innerHTML = '🗺️ Ruas'; btn.style.borderColor = '#0277BD'; btn.style.color = '#0277BD'; }

    updateMapData(true); // Carga inicial de dados e ajuste de zoom
}

// [NOVO] Chamado para atualizar os marcadores quando os dados mudam
export function updateMapData(fitBounds = false) {
    const map = state.mapInstance;
    if (!map) return;

    const bounds = renderMapMarkers();

    if (state.zoomTargetCoords) {
        map.setView(state.zoomTargetCoords, 20);
        if (state.openInfoBoxId !== null) {
            const t = state.registeredTrees.find(x => x.id === state.openInfoBoxId);
            if(t) setTimeout(() => showMapInfoBox(t), 500);
        }
        setTimeout(() => {
            state.setZoomTargetCoords(null);
            state.setOpenInfoBoxId(null);
        }, 1000);
    } else if (fitBounds && bounds && bounds.isValid() && state.registeredTrees.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });
    }

    setTimeout(() => map.invalidateSize(), 100);
}

// Mantido para compatibilidade com chamadas antigas
export const initializeMap = () => updateMapData(true);


// === GPS ===
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
    userLocationMarker = L.circleMarker(latLng, { radius: 6, weight: 2, color: '#FFF', fillColor: '#2196F3', fillOpacity: 1, zIndexOffset: 1000 }).addTo(state.mapInstance);
    userLocationMarker.bindPopup("Você").openPopup();
    
    userAccuracyCircle = L.circle(latLng, { radius: accuracy, color: '#2196F3', weight: 1, fillOpacity: 0.15 }).addTo(state.mapInstance);
    
    state.mapInstance.setView(latLng, 18); 
  } else {
    userLocationMarker.setLatLng(latLng);
    if (userAccuracyCircle) { userAccuracyCircle.setLatLng(latLng); userAccuracyCircle.setRadius(accuracy); }
  }
  
  const btn = document.getElementById('show-my-location-btn');
  if (btn) btn.innerHTML = '🛰️ Rastreando...';
}

function onLocationError(error) {
  if (error.code === 3 && userLocationMarker) return; 
  showToast("Sinal GPS perdido.", "error");
  stopLocationWatch();
}

export function toggleUserLocation() {
  if (!navigator.geolocation) { showToast("GPS não suportado.", "error"); return; }
  if (locationWatchId) { stopLocationWatch(); showToast("Rastreamento pausado.", "info"); } 
  else {
    const btn = document.getElementById('show-my-location-btn');
    if (btn) btn.innerHTML = '🛰️ Buscando...';
    locationWatchId = navigator.geolocation.watchPosition(onLocationUpdate, onLocationError, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  }
}
