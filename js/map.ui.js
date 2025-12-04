/**
 * ARBORIA 2.0 - MAP UI (v60.0 - Fix Initial Load & Zoom)
 * Visualização avançada: Raios reais baseados na altura da árvore (Zona de Queda).
 */

import * as state from './state.js';
import * as features from './features.js';
import { getImageFromDB } from './database.js';
import { showToast } from './utils.js';

let userLocationMarker = null; 
let userAccuracyCircle = null;
let locationWatchId = null;

export let currentLayerType = 'satellite'; 
let osmLayer = null;
let satelliteLayer = null;
let isMapViewInitialized = false; // Controle para zoom inicial

// === FUNÇÕES PRIVADAS ===

function handleMapFilterChange(e) {
  const selectedRisk = e.target.value;
  if (!state.mapMarkerGroup) return;
  
  state.mapMarkerGroup.eachLayer(layer => {
    if (layer.options.isTreeMarker) {
        const layerRisk = layer.options.riskLevel;
        const normalizedLayerRisk = normalizeRiskLevel(layerRisk);
        const normalizedSelectedRisk = normalizeRiskLevel(selectedRisk);
        
        if (selectedRisk === 'Todos' || normalizedLayerRisk === normalizedSelectedRisk) {
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

function normalizeRiskLevel(risk) {
    if (!risk) return 'Baixo Risco';
    const riskLower = risk.toLowerCase();
    if (riskLower.includes('alto') || riskLower === 'risk-high' || riskLower === 'high') return 'Alto Risco';
    if (riskLower.includes('médio') || riskLower === 'risk-medium' || riskLower === 'medium') return 'Médio Risco';
    if (riskLower.includes('baixo') || riskLower === 'risk-low' || riskLower === 'low') return 'Baixo Risco';
    return risk;
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

  const pSpecies = document.createElement('p');
  pSpecies.innerHTML = `<strong>Espécie:</strong> ${tree.especie}`;
  infoBox.appendChild(pSpecies);

  const pRisk = document.createElement('p');
  pRisk.innerHTML = `<strong>Risco:</strong> <span style="color:${colorCode}; font-weight:bold;">${riskLabel}</span>`;
  infoBox.appendChild(pRisk);
  
  const alturaFormatted = !isNaN(parseFloat(tree.altura)) ? `${parseFloat(tree.altura).toFixed(1)} m` : 'N/A';
  const pHeight = document.createElement('p');
  pHeight.innerHTML = `<strong>Altura (Raio):</strong> ${alturaFormatted}`;
  pHeight.style.fontSize = '0.85rem';
  pHeight.style.color = '#555';
  infoBox.appendChild(pHeight);

  let photoContainer = null;
  if (tree.hasPhoto) {
    photoContainer = document.createElement('div');
    photoContainer.id = 'map-info-photo';
    photoContainer.textContent = 'Carregando foto...';
    photoContainer.style.cssText = "margin: 10px 0; min-height: 100px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.8rem; color: #666;";
    infoBox.appendChild(photoContainer);
  }

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
      let defaultRadius;
      
      if (tree.risco === 'Alto Risco' || tree.riscoClass === 'risk-high') { 
          color = '#d32f2f'; defaultRadius = 8; 
      } else if (tree.risco === 'Médio Risco' || tree.riscoClass === 'risk-medium') { 
          color = '#f57c00'; defaultRadius = 5; 
      } else { 
          color = '#388e3c'; defaultRadius = 3; 
      }

      const treeHeight = parseFloat(tree.altura);
      const radiusInMeters = (!isNaN(treeHeight) && treeHeight > 0) ? treeHeight : defaultRadius;
      const normalizedRisk = normalizeRiskLevel(tree.risco);
      
      const circle = L.circle(coords, { 
          color: color, 
          weight: 1, 
          fillColor: color, 
          fillOpacity: 0.5, 
          radius: radiusInMeters, 
          isTreeMarker: true, 
          riskLevel: normalizedRisk 
      });
      
      circle.bindTooltip(`${tree.nome || tree.especie || tree.id}`, { 
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
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const bounds = state.mapMarkerGroup.getBounds();
    if (bounds.isValid() && state.registeredTrees.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16, animate: false });
        await new Promise(resolve => setTimeout(resolve, 1500));
    } else {
        map.setView([0, 0], 2, { animate: false }); 
    }

    await new Promise(r => setTimeout(r, 1000)); 
    return true;
}

// === OUTRAS FEATURES ===
export function zoomToAllPoints() {
    if (!state.mapMarkerGroup || !state.mapInstance) return;
    
    try {
        const bounds = state.mapMarkerGroup.getBounds();
        if (bounds.isValid() && state.registeredTrees.length > 0) {
            state.mapInstance.fitBounds(bounds, { 
                padding: [40, 40], 
                maxZoom: 16,
                animate: true 
            });
            
            // Marca como inicializado se tiver sucesso
            isMapViewInitialized = true;
            
            setTimeout(forceTileReload, 200);
            showToast("Zoom ajustado para todos os pontos.", "success");
        } else {
            showToast("Nenhum ponto para exibir.", "warning");
        }
    } catch (error) {
        console.error('Error zooming to all points:', error);
    }
}

export function toggleMapLayer() {
    const map = state.mapInstance;
    if (!map || !osmLayer || !satelliteLayer) return;

    try {
        if (currentLayerType === 'osm') {
            map.removeLayer(osmLayer);
            map.addLayer(satelliteLayer);
            currentLayerType = 'satellite';
        } else {
            map.removeLayer(satelliteLayer);
            map.addLayer(osmLayer);
            currentLayerType = 'osm';
        }
        setTimeout(forceTileReload, 100);
    } catch (error) {
        console.error('Error toggling map layer:', error);
    }
}

// === SETUP ===
export function setupMapListeners() {
  const mapLegend = document.getElementById('map-legend-filter');
  const zoomBtn = document.getElementById('zoom-to-extent-btn');
  const locBtn = document.getElementById('show-my-location-btn');
  
  if (mapLegend) mapLegend.addEventListener('change', handleMapFilterChange);
  if (zoomBtn) zoomBtn.addEventListener('click', zoomToAllPoints);
  if (locBtn) locBtn.addEventListener('click', toggleUserLocation);
}

export function setupMap() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || typeof L === 'undefined' || state.mapInstance) return;

    const map = L.map('map-container', {
        center: [0, 0],
        zoom: 2,
        zoomControl: true,
        worldCopyJump: true,
        preferCanvas: false
    });
    
    state.setMapInstance(map);
    state.setMapMarkerGroup(L.featureGroup().addTo(map));
    map.on('click', hideMapInfoBox);

    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google Maps',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });
    
    satelliteLayer.addTo(map);
    currentLayerType = 'satellite';

    // Não tenta inicializar view aqui se estiver oculto.
    // A inicialização real acontece em onMapShow()
    renderMapMarkers();
}

/**
 * Chamado quando a aba do mapa se torna visível.
 * Garante que o mapa renderize corretamente e foque nos pontos.
 */
export function onMapShow() {
    const map = state.mapInstance;
    if (!map) return;

    // 1. Informa ao Leaflet que o tamanho do container mudou
    map.invalidateSize();

    // 2. Se ainda não inicializamos o zoom nos pontos, fazemos agora
    if (!isMapViewInitialized && state.registeredTrees.length > 0) {
        const bounds = state.mapMarkerGroup.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { 
                padding: [40, 40], 
                maxZoom: 16,
                animate: false // Sem animação na primeira carga para ser instantâneo
            });
            isMapViewInitialized = true;
        }
    }

    // 3. Força recarregamento dos tiles (vários ciclos para garantir)
    forceTileReload();
}

export function updateMapData(fitToBounds = false) {
    const map = state.mapInstance;
    if (!map) return;

    try {
        const bounds = renderMapMarkers();

        if (state.zoomTargetCoords) {
            map.setView(state.zoomTargetCoords, 16);
            if (state.openInfoBoxId !== null) {
                const tree = state.registeredTrees.find(x => x.id === state.openInfoBoxId);
                if(tree) setTimeout(() => showMapInfoBox(tree), 500);
            }
            forceTileReload();
            setTimeout(() => {
                state.setZoomTargetCoords(null);
                state.setOpenInfoBoxId(null);
            }, 3000);
            return;
        }

        // Se solicitado explicitamente ou se for a primeira vez e estiver visível
        const mapContainer = document.getElementById('map-container');
        const isVisible = mapContainer && mapContainer.offsetParent !== null;

        if ((fitToBounds || (!isMapViewInitialized && isVisible)) && bounds && bounds.isValid() && state.registeredTrees.length > 0) {
            map.fitBounds(bounds, { 
                padding: [40, 40], 
                maxZoom: 16,
                animate: true 
            });
            isMapViewInitialized = true;
            setTimeout(forceTileReload, 200);
            return;
        }
        
    } catch (error) {
        console.error('Error updating map data:', error);
    }
}

function forceTileReload() {
    const map = state.mapInstance;
    if (!map) return;
    
    try {
        map.invalidateSize();
        if (currentLayerType === 'satellite' && satelliteLayer) satelliteLayer.redraw();
        else if (currentLayerType === 'osm' && osmLayer) osmLayer.redraw();
        
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                if (currentLayerType === 'satellite' && satelliteLayer) satelliteLayer.redraw();
                else if (currentLayerType === 'osm' && osmLayer) osmLayer.redraw();
            }
        }, 300);
        
        setTimeout(() => { if (map) map.invalidateSize(); }, 800);
        
    } catch (error) {
        console.warn('Tile reload failed:', error);
    }
}

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
