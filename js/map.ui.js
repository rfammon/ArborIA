/* js/map.ui.js
   Gerenciador do Mapa Leaflet (GIS)
   Correção: Adicionado export default e proteção contra reinicialização
*/

const MapUI = {
    map: null,
    markers: [],
    userMarker: null,
    tileLayer: null,

    init() {
        // 1. Verifica se o container existe
        const container = document.getElementById('map-container');
        if (!container) return;

        // 2. Evita erro "Map container is already initialized"
        if (this.map) {
            // Se já existe, apenas atualiza o tamanho (correção para abas)
            this.map.invalidateSize();
            return;
        }

        console.log('[MapUI] Inicializando Mapa...');

        // 3. Cria o mapa (Leaflet)
        // Centraliza inicialmente no Brasil ou numa coordenada padrão
        this.map = L.map('map-container').setView([-23.5505, -46.6333], 13);

        // 4. Adiciona camada de visualização (OpenStreetMap)
        this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // 5. Configura botões de controle do mapa
        this.setupControls();
    },

    // Corrige problema do mapa cinza quando está em aba oculta
    refresh() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 200);
        }
    },

    setupControls() {
        // Botão de Localização do Usuário
        const btnGeo = document.getElementById('show-my-location-btn');
        if (btnGeo) {
            btnGeo.addEventListener('click', () => this.locateUser());
        }

        // Botão de Zoom Extent (Ver todos os pontos)
        const btnZoom = document.getElementById('zoom-to-extent-btn');
        if (btnZoom) {
            btnZoom.addEventListener('click', () => this.zoomToMarkers());
        }

        // Botão de Camadas (Satélite/Rua) - Opcional, lógica básica
        const btnLayer = document.getElementById('toggle-map-layer-btn');
        if (btnLayer) {
            btnLayer.addEventListener('click', () => {
                // Lógica futura para trocar satélite/rua
                alert('Funcionalidade de satélite em desenvolvimento.');
            });
        }
    },

    locateUser() {
        if (!this.map) return;

        this.map.locate({ setView: true, maxZoom: 16 });

        this.map.once('locationfound', (e) => {
            const radius = e.accuracy / 2;

            if (this.userMarker) {
                this.map.removeLayer(this.userMarker);
            }

            this.userMarker = L.marker(e.latlng).addTo(this.map)
                .bindPopup(`Você está aqui (Precisão: ${radius.toFixed(0)}m)`).openPopup();

            L.circle(e.latlng, radius).addTo(this.map);
        });

        this.map.once('locationerror', (e) => {
            alert('Não foi possível obter sua localização: ' + e.message);
        });
    },

    addTreeMarker(lat, lng, title, riskLevel) {
        if (!this.map) return;

        // Define cor baseada no risco
        let color = 'blue';
        if (riskLevel === 'Alto Risco') color = 'red';
        if (riskLevel === 'Médio Risco') color = 'orange';
        if (riskLevel === 'Baixo Risco') color = 'green';

        // Cria ícone colorido (simples)
        const iconHtml = `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`;
        
        const customIcon = L.divIcon({
            className: 'custom-tree-marker',
            html: iconHtml,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        const marker = L.marker([lat, lng], { icon: customIcon })
            .addTo(this.map)
            .bindPopup(`<b>${title}</b><br>Risco: ${riskLevel}`);

        this.markers.push(marker);
    },

    zoomToMarkers() {
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds());
        } else {
            alert('Nenhum ponto cadastrado no mapa ainda.');
        }
    },
    
    clearMap() {
        if (!this.map) return;
        // Remove marcadores antigos
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
    }
};

/* CORREÇÃO CRÍTICA: Exportação Padrão para o main.js */
export default MapUI;
