/* js/map.ui.js (vFinal - Reconstruído)
   Gerenciador do Mapa Leaflet.
   Responsável por: Renderizar mapa, marcadores de risco e geolocalização.
*/

import Utils from './utils.js';

const MapUI = {
    map: null,
    markers: [],
    tileLayer: null,
    userMarker: null,

    // === 1. INICIALIZAÇÃO ===
    init() {
        const container = document.getElementById('map-container');
        
        // Se não tem container ou a lib Leaflet não carregou, aborta sem erro
        if (!container || typeof L === 'undefined') {
            console.warn('[MapUI] Container ou Leaflet não encontrado.');
            return;
        }

        // Evita erro "Map is already initialized"
        if (this.map) {
            this.refresh();
            return;
        }

        console.log('[MapUI] Inicializando Mapa...');

        try {
            // Cria o mapa (Centro padrão: São Paulo ou ajustável)
            this.map = L.map('map-container').setView([-23.5505, -46.6333], 13);

            // Adiciona camada base (OpenStreetMap)
            this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            // Configura botões de controle (Zoom, Localização)
            this.setupControls();

            // Força um ajuste de tamanho após renderizar
            setTimeout(() => this.refresh(), 500);

        } catch (e) {
            console.error('[MapUI] Erro crítico ao criar mapa:', e);
        }
    },

    // === 2. CORREÇÃO DE ABAS (REFRESH) ===
    refresh() {
        if (this.map) {
            // invalidateSize() diz ao Leaflet: "Recalcule sua largura/altura agora".
            // Isso conserta o bug da "tela cinza" quando o mapa estava numa aba oculta.
            this.map.invalidateSize();
        }
    },

    // === 3. MARCADORES (PINS) ===
    addTreeMarker(lat, lng, title, riskLevel) {
        if (!this.map || !lat || !lng) return;

        // Define cor baseada no risco
        let color = '#2e7d32'; // Verde (Baixo)
        if (riskLevel === 'Alto Risco') color = '#c62828'; // Vermelho
        else if (riskLevel === 'Médio Risco') color = '#ef6c00'; // Laranja

        // Cria ícone CSS puro (leve e bonito)
        const iconHtml = `
            <div style="
                background-color: ${color};
                width: 14px; height: 14px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.4);
            "></div>
        `;
        
        const customIcon = L.divIcon({
            className: 'arboria-pin',
            html: iconHtml,
            iconSize: [18, 18],
            iconAnchor: [9, 9], // Centraliza
            popupAnchor: [0, -10]
        });

        // Adiciona ao mapa e salva referência
        const marker = L.marker([lat, lng], { icon: customIcon })
            .addTo(this.map)
            .bindPopup(`
                <div style="text-align:center;">
                    <strong>${Utils.escapeHTML(title)}</strong><br>
                    <span style="color:${color}; font-weight:bold;">${riskLevel}</span>
                </div>
            `);

        this.markers.push(marker);
    },

    clearMap() {
        if (!this.map) return;
        
        // Remove todos os marcadores da memória e do mapa
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
    },

    // === 4. GEOLOCALIZAÇÃO E CONTROLES ===
    setupControls() {
        // Botão "Minha Posição" (no HTML)
        const btnGeo = document.getElementById('show-my-location-btn');
        if (btnGeo) {
            btnGeo.addEventListener('click', (e) => {
                e.preventDefault(); // Evita submit de form se estiver dentro
                this.locateUser();
            });
        }

        // Botão "Aproximar dos Pontos" (Zoom Extent)
        const btnZoom = document.getElementById('zoom-to-extent-btn');
        if (btnZoom) {
            btnZoom.addEventListener('click', (e) => {
                e.preventDefault();
                this.zoomToMarkers();
            });
        }
    },

    locateUser() {
        if (!this.map) return;

        Utils.showToast('Buscando sua posição no mapa...');
        
        this.map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });

        // Evento: Encontrou
        this.map.once('locationfound', (e) => {
            const radius = e.accuracy / 2;

            if (this.userMarker) this.map.removeLayer(this.userMarker);

            // Marcador azul padrão do usuário
            this.userMarker = L.marker(e.latlng).addTo(this.map)
                .bindPopup(`Você está aqui (Precisão: ${radius.toFixed(0)}m)`).openPopup();

            L.circle(e.latlng, radius).addTo(this.map);
        });

        // Evento: Erro
        this.map.once('locationerror', (e) => {
            Utils.showToast('Erro ao localizar no mapa: ' + e.message, 'error');
        });
    },

    zoomToMarkers() {
        if (!this.map) return;

        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } else {
            Utils.showToast('Nenhum ponto cadastrado para visualizar.', 'warning');
        }
    }
};

/* EXPORTAÇÃO PADRÃO OBRIGATÓRIA */
export default MapUI;
