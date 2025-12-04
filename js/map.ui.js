/**
 * ARBORIA 2.0 - MAP UI (v59.0 - Symbology & Fall Risk Radius)
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

// === FUNÇÕES PRIVADAS ===

function handleMapFilterChange(e) {
  const selectedRisk = e.target.value;
  if (!state.mapMarkerGroup) return;
  
  console.log('Filter changed to:', selectedRisk); // Debug
  
  state.mapMarkerGroup.eachLayer(layer => {
    if (layer.options.isTreeMarker) {
        const layerRisk = layer.options.riskLevel;
        console.log('Layer risk:', layerRisk, 'Selected:', selectedRisk); // Debug
        
        // Normalização para comparação mais robusta
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

// Função para normalizar níveis de risco para comparação
function normalizeRiskLevel(risk) {
    if (!risk) return 'Baixo Risco';
    
    const riskLower = risk.toLowerCase();
    if (riskLower.includes('alto') || riskLower === 'risk-high' || riskLower === 'high') {
        return 'Alto Risco';
    } else if (riskLower.includes('médio') || riskLower === 'risk-medium' || riskLower === 'medium') {
        return 'Médio Risco';
    } else if (riskLower.includes('baixo') || riskLower === 'risk-low' || riskLower === 'low') {
        return 'Baixo Risco';
    }
    
    return risk; // Retorna original se não reconhecer
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
  const alturaFormatted = !isNaN(parseFloat(tree.altura)) ? `${parseFloat(tree.altura).toFixed(1)} m` : 'N/A';
  const pHeight = document.createElement('p');
  pHeight.innerHTML = `<strong>Altura (Raio):</strong> ${alturaFormatted}`;
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
      const radiusInMeters = (!isNaN(treeHeight) && treeHeight > 0) ? treeHeight : defaultRadius;

      // [MUDANÇA] L.circle usa metros (Geográfico), L.circleMarker usa pixels (Tela)
      // Usamos L.circle para representar a projeção real da copa/queda no terreno.
      // Normaliza o nível de risco para consistência
      const normalizedRisk = normalizeRiskLevel(tree.risco);
      
      const circle = L.circle(coords, { 
          color: color, 
          weight: 1, // Borda fina
          fillColor: color, 
          fillOpacity: 0.5, // Transparente para ver o que está embaixo (zona de alvo)
          radius: radiusInMeters, 
          isTreeMarker: true, 
          riskLevel: normalizedRisk // Usa valor normalizado
      });
      
      // Configuração do Rótulo (Label dentro do ponto)
      // [MUDANÇA] Exibe o nome da árvore (ou espécie, ou ID como fallback)
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
        
        // Aguarda carregamento dos tiles
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
            
            // Força carregamento das tiles
            setTimeout(forceTileReload, 200);
            
            showToast("Zoom ajustado para todos os pontos.", "success");
        } else {
            showToast("Nenhum ponto para exibir.", "warning");
        }
    } catch (error) {
        console.error('Error zooming to all points:', error);
        showToast("Erro ao ajustar zoom.", "error");
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
        
        // Força redesenho imediato
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

// [COMPLETAMENTE RECONSTRUÍDO] Configuração robusta do mapa
export function setupMap() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || typeof L === 'undefined' || state.mapInstance) return;

    // Inicializa o mapa com configuração robusta
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

    // Configura camadas OSM
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    // Configura camada Google Satellite
    satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google Maps',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });
    
    // Adiciona camada padrão
    satelliteLayer.addTo(map);
    currentLayerType = 'satellite';

    // Inicialização robusta baseada na lógica do botão "focar tudo"
    initializeMapWithRetry(map, 3);
}

// Função de inicialização baseada na lógica do botão "focar tudo"
function initializeMapWithRetry(map, maxRetries) {
    let retryCount = 0;
    
    function tryInitialize() {
        try {
            map.invalidateSize();
            
            // Força carregamento dos tiles primeiro
            if (satelliteLayer) {
                satelliteLayer.redraw();
            }
            
            // Aguarda um pouco e usa a mesma lógica do botão "focar tudo"
            setTimeout(() => {
                if (state.mapMarkerGroup && state.registeredTrees.length > 0) {
                    // Usa exatamente a mesma lógica do zoomToAllPoints
                    const bounds = state.mapMarkerGroup.getBounds();
                    if (bounds.isValid()) {
                        map.fitBounds(bounds, { 
                            padding: [40, 40], 
                            maxZoom: 16,
                            animate: false 
                        });
                        
                        // Força carregamento das tiles como no botão + ciclos adicionais
                        setTimeout(() => {
                            map.invalidateSize();
                            if (currentLayerType === 'satellite' && satelliteLayer) {
                                satelliteLayer.redraw();
                            }
                        }, 200);
                        
                        // Ciclo adicional para garantir tiles
                        setTimeout(() => {
                            map.invalidateSize();
                            if (currentLayerType === 'satellite' && satelliteLayer) {
                                satelliteLayer.redraw();
                            }
                        }, 600);
                        
                        // Ciclo final para garantir estabilidade
                        setTimeout(() => {
                            map.invalidateSize();
                        }, 1200);
                    }
                } else {
                    // Se não há dados, mantém vista mundial
                    map.setView([0, 0], 2);
                    setTimeout(() => {
                        if (satelliteLayer) satelliteLayer.redraw();
                    }, 200);
                    
                    // Ciclos adicionais para garantir tiles
                    setTimeout(() => {
                        map.invalidateSize();
                        if (satelliteLayer) satelliteLayer.redraw();
                    }, 600);
                    
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 1200);
                }
            }, 500);
            
        } catch (error) {
            console.warn('Map initialization attempt failed:', error);
            retryCount++;
            
            if (retryCount < maxRetries) {
                setTimeout(tryInitialize, 800 * retryCount);
            } else {
                console.error('Map initialization failed after all retries');
                // Fallback final: vista mundial
                try {
                    map.setView([0, 0], 2);
                    if (satelliteLayer) satelliteLayer.redraw();
                } catch (fallbackError) {
                    console.error('Final fallback failed:', fallbackError);
                }
            }
        }
    }
    
    // Inicia tentativa após delay maior para garantir DOM pronto
    setTimeout(tryInitialize, 500);
}

// [SIMPLIFICADO] Atualiza marcadores - inicialização agora é tratada separadamente
export function updateMapData(fitToBounds = false) {
    const map = state.mapInstance;
    if (!map) return;

    try {
        // Renderiza marcadores e obtém bounds
        const bounds = renderMapMarkers();

        // Se há coordenadas alvo específicas (zoom para árvore individual)
        if (state.zoomTargetCoords) {
            map.setView(state.zoomTargetCoords, 16);
            
            if (state.openInfoBoxId !== null) {
                const tree = state.registeredTrees.find(x => x.id === state.openInfoBoxId);
                if(tree) setTimeout(() => showMapInfoBox(tree), 500);
            }
            
            // Força carregamento de tiles
            forceTileReload();
            
            // Limpa estado após 3 segundos
            setTimeout(() => {
                state.setZoomTargetCoords(null);
                state.setOpenInfoBoxId(null);
            }, 3000);
            return;
        }

        // Apenas se for chamado explicitamente (não na inicialização)
        if (fitToBounds && bounds && bounds.isValid() && state.registeredTrees.length > 0) {
            map.fitBounds(bounds, { 
                padding: [40, 40], 
                maxZoom: 16,
                animate: true 
            });
            
            // Força carregamento das tiles após ajuste
            setTimeout(forceTileReload, 200);
            return;
        }

        // Se não há pontos, mantém vista mundial
        if (state.registeredTrees.length === 0) {
            map.setView([0, 0], 2);
            setTimeout(forceTileReload, 200);
        }
        
    } catch (error) {
        console.error('Error updating map data:', error);
        // Fallback: tenta manter mapa funcional
        try {
            map.setView([0, 0], 2);
        } catch (fallbackError) {
            console.error('Fallback failed:', fallbackError);
        }
    }
}

// Função dedicada para forçar recarregamento de tiles com múltiplos ciclos
function forceTileReload() {
    const map = state.mapInstance;
    if (!map) return;
    
    try {
        map.invalidateSize();
        
        // Força redesenho da camada ativa
        if (currentLayerType === 'satellite' && satelliteLayer) {
            satelliteLayer.redraw();
        } else if (currentLayerType === 'osm' && osmLayer) {
            osmLayer.redraw();
        }
        
        // Múltiplos ciclos para garantir carregamento completo
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                if (currentLayerType === 'satellite' && satelliteLayer) {
                    satelliteLayer.redraw();
                } else if (currentLayerType === 'osm' && osmLayer) {
                    osmLayer.redraw();
                }
            }
        }, 300);
        
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 700);
        
    } catch (error) {
        console.warn('Tile reload failed:', error);
    }
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
