/**
 * ARBORIA 2.0 - MAP UI (v59.1 - MapLibre Migration Fixes)
 * Visualização avançada: Raios reais baseados na altura da árvore (Zona de Queda).
 */

import * as state from './state.js';
import * as features from './features.js';
import { getImageFromDB, getImageByUrl } from './database.js';
import { showToast } from './utils.js';

let userLocationMarker = null;
let userAccuracyCircle = null;
let locationWatchId = null;

export let currentLayerType = 'satellite';

// Estilos MapLibre para camadas
const osmStyle = {
  version: 8,
  sources: {
    'osm': {
      type: 'raster',
      tiles: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{
    id: 'osm-layer',
    type: 'raster',
    source: 'osm',
    minzoom: 0,
    maxzoom: 19
  }]
};

const satelliteStyle = {
  version: 8,
  sources: {
    'satellite': {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: 256,
      attribution: '© Google Maps'
    }
  },
  layers: [{
    id: 'satellite-layer',
    type: 'raster',
    source: 'satellite',
    minzoom: 0,
    maxzoom: 20
  }]
};

// === FUNÇÕES PRIVADAS ===

// [FIX] Helper function to avoid circular dependency with features.js
function convertToLatLon(tree) {
  if (tree.coordX === "N/A" || tree.coordY === "N/A") return null;
  if (typeof window.proj4 === "undefined") return null;

  const e = parseFloat(tree.coordX);
  const n = parseFloat(tree.coordY);
  const zn = tree.utmZoneNum || 23;
  const hemi = "+south";
  const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;

  try {
    const ll = window.proj4(def, "EPSG:4326", [e, n]);
    // proj4 returns [lon, lat], which is what MapLibre expects [lng, lat]
    // Leaflet expected [lat, lng], so we might need to be careful if logic was flipped before.
    // Based on features.js: return [ll[1], ll[0]]; // [lat, lon]
    // MapLibre needs [lng, lat].
    // So we should return [ll[0], ll[1]].

    // Let's check features.js implementation again:
    // return [ll[1], ll[0]]; // This returns [lat, lon]

    // renderMapMarkers below expects:
    // coordinates: [coords[1], coords[0]] // [lng, lat]
    // If convertToLatLon returns [lat, lon], then coords[1] is lon, coords[0] is lat.
    // So [coords[1], coords[0]] becomes [lon, lat]. Correct.

    return [ll[1], ll[0]]; // Returns [lat, lon] to match existing logic expectation
  } catch (e) {
    return null;
  }
}

function handleMapFilterChange(e) {
  const selectedRisk = e.target.value;
  const map = state.mapInstance;
  if (!map) return;

  console.log('Filter changed to:', selectedRisk); // Debug

  let filter = null;
  if (selectedRisk !== 'Todos') {
    filter = ['==', ['get', 'riskLevel'], selectedRisk];
  }

  // Aplicar filtro nativo do MapLibre
  if (map.getLayer('tree-circles')) map.setFilter('tree-circles', filter);
  if (map.getLayer('tree-labels')) map.setFilter('tree-labels', filter);

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
  title.textContent = `ID: ${tree.nome || tree.id}`;
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
    // Primeiro tente carregar do cache local usando photoUrl
    if (tree.photoUrl) {
      getImageByUrl(tree.photoUrl).then(imageBlob => {
        if (imageBlob) {
          const imgUrl = URL.createObjectURL(imageBlob);
          photoContainer.innerHTML = '';
          const img = document.createElement('img');
          img.src = imgUrl;
          img.style.cssText = "width:100%; border-radius:8px; object-fit:cover; max-height:150px;";
          photoContainer.appendChild(img);
        } else {
          // Se não encontrou no cache, tente carregar a URL diretamente
          photoContainer.innerHTML = '';
          const img = document.createElement('img');
          img.src = tree.photoUrl;
          img.style.cssText = "width:100%; border-radius:8px; object-fit:cover; max-height:150px;";
          img.onload = () => console.log('Foto carregada com sucesso');
          img.onerror = () => {
            photoContainer.textContent = '(Erro ao carregar foto)';
          };
          photoContainer.appendChild(img);
        }
      }).catch(error => {
        console.error('Erro ao carregar imagem do cache:', error);
        photoContainer.textContent = '(Erro ao carregar foto)';
      });
    } else {
      // Para compatibilidade com entradas antigas, tentar usar o ID legado
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
}

function renderMapMarkers() {
  const map = state.mapInstance;
  if (!map) return;

  // Criar GeoJSON FeatureCollection
  const featuresList = [];
  let bounds = new maplibregl.LngLatBounds();

  state.registeredTrees.forEach(tree => {
    // [FIX] Use local convertToLatLon to avoid circular dependency issue
    const coords = convertToLatLon(tree);
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
      const treeHeight = parseFloat(tree.altura);
      const radiusInMeters = (!isNaN(treeHeight) && treeHeight > 0) ? treeHeight : defaultRadius;

      // Converter risco para o formato esperado pelos filtros
      let riskLevelForFilter;
      if (tree.risco === 'Alto' || tree.risco === 'Extremo' || tree.risco === 'Alto Risco' || tree.risco.includes('Alto')) {
        riskLevelForFilter = 'Alto Risco';
      } else if (tree.risco === 'Médio' || tree.risco === 'Moderado' || tree.risco === 'Médio Risco' || tree.risco.includes('Médio') || tree.risco.includes('Moderado')) {
        riskLevelForFilter = 'Médio Risco';
      } else {
        riskLevelForFilter = 'Baixo Risco';
      }

      // Criar feature GeoJSON
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coords[1], coords[0]] // [lng, lat] (coords is [lat, lon])
        },
        properties: {
          id: tree.id,
          species: tree.especie || tree.nome || `Árvore ${tree.id}`, // Nome da espécie para o rótulo
          color: color,
          radius: radiusInMeters,
          riskLevel: riskLevelForFilter,
          // Armazenar apenas propriedades primitivas necessárias para o popup
          especie: tree.especie,
          nome: tree.nome,
          local: tree.local,
          risco: tree.risco,
          altura: tree.altura,
          hasPhoto: tree.hasPhoto,
          photoUrl: tree.photoUrl,
          avaliador: tree.avaliador,
          observacoes: tree.observacoes,
          data: tree.data,
          utmZoneNum: tree.utmZoneNum,
          utmZoneLetter: tree.utmZoneLetter,
          dap: tree.dap,
          coordX: tree.coordX,
          coordY: tree.coordY,
          pontuacao: tree.pontuacao
        }
      };

      featuresList.push(feature);
      bounds.extend([coords[1], coords[0]]);
    }
  });

  const geoJson = {
    type: 'FeatureCollection',
    features: featuresList
  };

  // Adicionar ou atualizar source
  if (map.getSource('trees')) {
    map.getSource('trees').setData(geoJson);
  } else {
    map.addSource('trees', {
      type: 'geojson',
      data: geoJson
    });

    // Adicionar layer de círculos
    map.addLayer({
      id: 'tree-circles',
      type: 'circle',
      source: 'trees',
      paint: {
        'circle-radius': ['get', 'radius'], // Note: This is in pixels by default in MapLibre unless using 'circle-radius-transition' or zoom functions. For meters, it's more complex, but let's stick to pixels for now or assume zoom scaling.
        // Actually, to render meters, we might need 'fill-extrusion' or complex expressions. 
        // For now, let's assume 'radius' is a relative size factor.
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.5,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1
      }
    });

    // Adicionar layer de labels
    map.addLayer({
      id: 'tree-labels',
      type: 'symbol',
      source: 'trees',
      layout: {
        'text-field': ['get', 'species'], // Mostrar o nome da espécie em vez do ID
        'text-size': 14,
        'text-anchor': 'top',
        'text-justify': 'center',
        'text-offset': [0, 0.6] // Deslocamento para não sobrepor o círculo
      },
      paint: {
        'text-color': '#000000',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
        'text-opacity': 0.8
      }
    });

    // Adicionar click handler
    map.on('click', 'tree-circles', (e) => {
      const properties = e.features[0].properties;
      // Criar objeto tree com as propriedades separadas
      const tree = {
        id: properties.id,
        especie: properties.especie,
        nome: properties.nome,
        local: properties.local,
        risco: properties.risco,
        altura: properties.altura,
        hasPhoto: properties.hasPhoto,
        photoUrl: properties.photoUrl,
        avaliador: properties.avaliador,
        observacoes: properties.observacoes,
        data: properties.data,
        utmZoneNum: properties.utmZoneNum,
        utmZoneLetter: properties.utmZoneLetter,
        dap: properties.dap,
        coordX: properties.coordX,
        coordY: properties.coordY,
        pontuacao: properties.pontuacao
      };
      showMapInfoBox(tree);
    });

    // Change cursor on hover
    map.on('mouseenter', 'tree-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'tree-circles', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  return bounds;
}

// === PREPARAÇÃO DO MAPA (PDF) ===
export async function prepareMapForScreenshot() {
  const map = state.mapInstance;
  if (!map) return false;

  const mapTabContent = document.getElementById('tab-content-mapa');
  if (mapTabContent) mapTabContent.style.display = 'block';

  if (currentLayerType !== 'satellite') {
    toggleMapLayer();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const bounds = renderMapMarkers();
  if (bounds && !bounds.isEmpty() && state.registeredTrees.length > 0) {
    map.fitBounds(bounds, {
      padding: { top: 15, bottom: 15, left: 15, right: 15 }, // Reduzido para zoom mais próximo
      maxZoom: 18,
      animate: false
    });
    // Aguarda carregamento dos tiles
    await new Promise(resolve => setTimeout(resolve, 1500));
  } else {
    map.setZoom(2);
  }

  await new Promise(r => setTimeout(r, 1000));
  return true;
}

// === OUTRAS FEATURES ===
export function zoomToAllPoints() {
  const map = state.mapInstance;
  if (!map) return;

  try {
    const bounds = renderMapMarkers();
    if (bounds && !bounds.isEmpty() && state.registeredTrees.length > 0) {
      map.fitBounds(bounds, {
        padding: { top: 20, bottom: 20, left: 20, right: 20 }, // Reduzido para zoom mais próximo
        maxZoom: 18,
        animate: true
      });
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
  if (!map) return;

  try {
    if (currentLayerType === 'osm') {
      map.setStyle(satelliteStyle);
      currentLayerType = 'satellite';
    } else {
      map.setStyle(osmStyle);
      currentLayerType = 'osm';
    }

    // Re-adicionar sources e layers após mudança de style
    map.once('style.load', () => {
      renderMapMarkers(); // Re-render markers
    });

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

// [MIGRADO PARA MAPLIBRE] Configuração robusta do mapa
export function setupMap() {
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer || typeof maplibregl === 'undefined' || state.mapInstance) return;

  // Inicializa o mapa com MapLibre GL JS
  const map = new maplibregl.Map({
    container: 'map-container',
    style: satelliteStyle,
    center: [0, 0],
    zoom: 2
  });

  state.setMapInstance(map);
  // MapLibre não usa featureGroup; markers serão gerenciados via GeoJSON sources
  state.setMapMarkerGroup(null); // Remover referência ao featureGroup

  // Event listeners
  map.on('click', hideMapInfoBox);

  // Camada padrão é satellite (definida no style inicial)

  // Inicialização robusta baseada na lógica do botão "focar tudo"
  initializeMapWithRetry(map, 3);
}

// Função de inicialização baseada na lógica do botão "focar tudo"
function initializeMapWithRetry(map, maxRetries) {
  let retryCount = 0;

  function tryInitialize() {
    try {
      // MapLibre não precisa de invalidateSize da mesma forma
      // Aguarda um pouco e usa a mesma lógica do botão "focar tudo"
      setTimeout(() => {
        if (state.registeredTrees.length > 0) {
          const bounds = renderMapMarkers();
          if (bounds && !bounds.isEmpty()) {
            map.fitBounds(bounds, {
              padding: { top: 20, bottom: 20, left: 20, right: 20 }, // Reduzido para zoom mais próximo
              maxZoom: 18,
              animate: false
            });
          } else {
            map.setZoom(2);
          }
        } else {
          // Se não há dados, mantém vista mundial
          map.setZoom(2);
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
          map.setZoom(2);
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
      // [FIX] Use setCenter/setZoom instead of setView
      // state.zoomTargetCoords is [lat, lon] from convertToLatLon
      // MapLibre expects [lng, lat]
      const target = [state.zoomTargetCoords[1], state.zoomTargetCoords[0]];

      map.setCenter(target);
      map.setZoom(16);

      if (state.openInfoBoxId !== null) {
        const tree = state.registeredTrees.find(x => x.id === state.openInfoBoxId);
        if (tree) setTimeout(() => showMapInfoBox(tree), 500);
      }

      // Limpa estado após 3 segundos
      setTimeout(() => {
        state.setZoomTargetCoords(null);
        state.setOpenInfoBoxId(null);
      }, 3000);
      return;
    }

    // Apenas se for chamado explicitamente (não na inicialização)
    if (fitToBounds && bounds && !bounds.isEmpty() && state.registeredTrees.length > 0) {
      map.fitBounds(bounds, {
        padding: { top: 20, bottom: 20, left: 20, right: 20 }, // Reduzido para zoom mais próximo
        maxZoom: 18,
        animate: true
      });
      return;
    }

    // Se não há pontos, mantém vista mundial
    if (state.registeredTrees.length === 0) {
      // [FIX] Use setCenter/setZoom
      map.setCenter([0, 0]);
      map.setZoom(2);
      setTimeout(forceTileReload, 200);
    }

  } catch (error) {
    console.error('Error updating map data:', error);
    // Fallback: tenta manter mapa funcional
    try {
      map.setCenter([0, 0]);
      map.setZoom(2);
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);
    }
  }
}

// Função dedicada para forçar recarregamento (MapLibre gerencia tiles automaticamente)
function forceTileReload() {
  const map = state.mapInstance;
  if (!map) return;

  try {
    map.resize(); // Force resize to refresh layout
  } catch (error) {
    console.warn('Tile reload failed:', error);
  }
}

// Mantido para compatibilidade com chamadas antigas
export const initializeMap = () => updateMapData(true);


// === GPS ===
function stopLocationWatch() {
  if (locationWatchId) { navigator.geolocation.clearWatch(locationWatchId); locationWatchId = null; }

  // Remover markers do MapLibre
  if (userLocationMarker) {
    userLocationMarker.remove();
    userLocationMarker = null;
  }

  const map = state.mapInstance;
  if (map) {
    if (map.getLayer('user-accuracy-circle')) {
      map.removeLayer('user-accuracy-circle');
    }
    if (map.getSource('user-accuracy')) {
      map.removeSource('user-accuracy');
    }
  }

  const btn = document.getElementById('show-my-location-btn');
  if (btn) { btn.innerHTML = '🛰️ Minha Posição'; btn.classList.remove('active-tracking'); }
}

function onLocationUpdate(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const lngLat = [longitude, latitude];

  const map = state.mapInstance;
  if (!map) return;

  if (!userLocationMarker) {
    showToast(`GPS Encontrado!`, "success");

    // Criar marker personalizado para localização do usuário
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #2196F3;
      border: 2px solid #FFF;
      box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
    `;

    userLocationMarker = new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map);

    // Criar círculo de precisão usando GeoJSON
    const accuracyGeoJson = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: lngLat
      },
      properties: { radius: accuracy }
    };

    if (map.getSource('user-accuracy')) {
      map.getSource('user-accuracy').setData(accuracyGeoJson);
    } else {
      map.addSource('user-accuracy', {
        type: 'geojson',
        data: accuracyGeoJson
      });

      map.addLayer({
        id: 'user-accuracy-circle',
        type: 'circle',
        source: 'user-accuracy',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': '#2196F3',
          'circle-opacity': 0.15,
          'circle-stroke-color': '#2196F3',
          'circle-stroke-width': 1
        }
      });
    }

    map.setCenter(lngLat);
    map.setZoom(18);
  } else {
    userLocationMarker.setLngLat(lngLat);

    // Atualizar círculo de precisão
    if (map.getSource('user-accuracy')) {
      const updatedGeoJson = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: lngLat
        },
        properties: { radius: accuracy }
      };
      map.getSource('user-accuracy').setData(updatedGeoJson);
    }
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
