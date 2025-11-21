// js/map.ui.js (v58.0 - Fix Zoom PDF Aproximado)

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
    if (selectedRisk === 'Todos' || layer.options.riskLevel === selectedRisk) {
      layer.setStyle({ opacity: 1, fillOpacity: 0.6 });
      if(layer.getTooltip()) layer.openTooltip();
    } else {
      layer.setStyle({ opacity: 0, fillOpacity: 0 });
      if(layer.getTooltip()) layer.closeTooltip();
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
  let color, riskText;
  if (tree.risco === 'Alto Risco') { color = '#C62828'; riskText = '🔴 Alto Risco'; }
  else if (tree.risco === 'Médio Risco') { color = '#E65100'; riskText = '🟠 Médio Risco'; }
  else { color = '#2E7D32'; riskText = '🟢 Baixo Risco'; }

  let infoHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong>ID: ${tree.id}</strong>
        <button id="close-info-box" style="font-size:1.5rem; border:none; background:none; cursor:pointer;">&times;</button>
    </div>
    <p><strong>Espécie:</strong> ${tree.especie}</p>
    <p><strong>Risco:</strong> <span style="color:${color}; font-weight:bold;">${riskText}</span></p>
    <div style="margin: 10px 0;"><button id="infobox-goto-table" style="width:100%; padding:8px; background:var(--color-primary-medium); color:white; border:none; border-radius:4px; cursor:pointer;">📄 Ver na Tabela</button></div>
  `;
  if (tree.hasPhoto) infoHTML += `<div id="map-info-photo" class="loading-photo">Carregando...</div>`;
  infoBox.innerHTML = infoHTML;
  infoBox.classList.remove('hidden');
  document.getElementById('close-info-box').addEventListener('click', hideMapInfoBox);
  document.getElementById('infobox-goto-table').addEventListener('click', () => features.handleMapMarkerClick(tree.id));

  if (tree.hasPhoto) {
    getImageFromDB(tree.id, (imageBlob) => {
      const photoDiv = document.getElementById('map-info-photo');
      if (photoDiv && imageBlob) {
        const imgUrl = URL.createObjectURL(imageBlob);
        photoDiv.innerHTML = `<img src="${imgUrl}" class="manual-img" style="width:100%">`;
        photoDiv.classList.remove('loading-photo');
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
      if (tree.risco === 'Alto Risco') { color = '#C62828'; radius = 8; labelClass = 'lbl-high'; }
      else if (tree.risco === 'Médio Risco') { color = '#E65100'; radius = 7; labelClass = 'lbl-med'; }
      else { color = '#2E7D32'; radius = 6; labelClass = 'lbl-low'; }

      const circle = L.circle(coords, { color: color, fillColor: color, fillOpacity: 0.4, radius: radius, weight: 2, stroke: true, color: 'white', isTreeMarker: true, riskLevel: tree.risco });
      circle.bindTooltip(`<div class="map-label-content ${labelClass}">${tree.id}</div>`, { permanent: true, direction: 'center', className: 'map-id-label' });
      circle.addTo(state.mapMarkerGroup);
      circle.on('click', (e) => { L.DomEvent.stopPropagation(e); showMapInfoBox(tree); });
    }
  });
  return state.mapMarkerGroup.getBounds();
}

// === [CORREÇÃO] PREPARAÇÃO DO MAPA (ZOOM MAIS PRÓXIMO) ===
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
        // [MUDANÇA AQUI] 
        // padding reduzido para 40 (aperta mais o zoom)
        // maxZoom aumentado para 21 (permite chegar muito perto)
        // Removido o map.setZoom(-1) que causava o afastamento
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 21, animate: false });
    } else {
        map.setView([-15.78, -47.92], 4, { animate: false }); 
    }

    await new Promise(r => setTimeout(r, 2500)); 
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
  if (!mapContainer || typeof L === 'undefined') return;

  let map = state.mapInstance;

  if (!map) {
    map = L.map('map-container', { tap: false, preferCanvas: true }).setView([-15.78, -47.92], 4);
    state.setMapInstance(map);
    state.setMapMarkerGroup(L.featureGroup().addTo(map));
    map.on('click', hideMapInfoBox);
  }
  map.invalidateSize();

  if (!osmLayer || !satelliteLayer) {
      osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' });
  }

  if (!map.hasLayer(osmLayer) && !map.hasLayer(satelliteLayer)) {
      satelliteLayer.addTo(map);
      currentLayerType = 'satellite';
      const btn = document.getElementById('toggle-map-layer-btn');
      if(btn) { btn.innerHTML = '🗺️ Ruas'; btn.style.borderColor = '#0277BD'; btn.style.color = '#0277BD'; }
  }

  const bounds = renderMapMarkers();

  if (state.zoomTargetCoords) {
    map.setView(state.zoomTargetCoords, 21); 
    state.setZoomTargetCoords(null);
    if (state.openInfoBoxId !== null) {
       const t = state.registeredTrees.find(x => x.id === state.openInfoBoxId);
       if(t) setTimeout(() => showMapInfoBox(t), 500);
       state.setOpenInfoBoxId(null);
    }
  } else if (bounds && bounds.isValid() && state.registeredTrees.length > 0) {
      if (map.getZoom() <= 5) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });
      }
  }
}

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
    showToast(`Localização encontrada!`, "success");
    userLocationMarker = L.circleMarker(latLng, { radius: 8, weight: 3, color: '#FFF', fillColor: '#2196F3', fillOpacity: 1, zIndexOffset: 1000 }).addTo(state.mapInstance);
    userLocationMarker.bindPopup("Sua Posição").openPopup();
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
  showToast("Erro ao rastrear posição.", "error");
  stopLocationWatch();
}
export function toggleUserLocation() {
  if (!navigator.geolocation) { showToast("GPS não suportado.", "error"); return; }
  if (locationWatchId) { stopLocationWatch(); showToast("Rastreamento parado.", "success"); } 
  else {
    const btn = document.getElementById('show-my-location-btn');
    if (btn) btn.innerHTML = '🛰️ Buscando...';
    locationWatchId = navigator.geolocation.watchPosition(onLocationUpdate, onLocationError, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  }
}
