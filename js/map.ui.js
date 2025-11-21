/* js/map.ui.js (vFinal 5.0)
   Gerenciador de Mapa Leaflet.
   Correção: refresh() robusto para abas ocultas.
*/

const MapUI = {
    map: null,
    markers: [],
    tileLayer: null,

    init() {
        // Evita re-inicializar se já existe
        if (this.map) {
            this.refresh();
            return;
        }

        const container = document.getElementById('map-container');
        if (!container) return;

        console.log('[MapUI] Criando mapa...');

        // 1. Cria Instância do Leaflet
        this.map = L.map('map-container').setView([-23.5505, -46.6333], 13);

        // 2. Adiciona Tiles (OpenStreetMap)
        this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(this.map);

        // 3. Adiciona Controles
        this.setupControls();
        
        // 4. Força renderização inicial após um instante
        setTimeout(() => this.refresh(), 500);
    },

    refresh() {
        if (this.map) {
            // invalidateSize() força o Leaflet a recalcular o tamanho da div.
            // Essencial quando o mapa estava em uma aba display:none.
            this.map.invalidateSize();
        }
    },

    addTreeMarker(lat, lng, title, risk) {
        if (!this.map) return;

        let color = '#2e7d32'; // Verde
        if (risk === 'Alto Risco') color = '#c62828'; // Vermelho
        else if (risk === 'Médio Risco') color = '#ef6c00'; // Laranja

        const iconHtml = `<div style="background-color:${color}; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`;
        
        const customIcon = L.divIcon({
            className: 'custom-pin',
            html: iconHtml,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const marker = L.marker([lat, lng], { icon: customIcon })
            .addTo(this.map)
            .bindPopup(`<strong>${title}</strong><br>${risk}`);

        this.markers.push(marker);
    },

    clearMap() {
        if (!this.map) return;
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
    },

    setupControls() {
        const btnZoom = document.getElementById('zoom-to-extent-btn');
        if (btnZoom) {
            btnZoom.addEventListener('click', () => {
                if (this.markers.length > 0) {
                    const group = new L.featureGroup(this.markers);
                    this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
                } else {
                    alert('Nenhum ponto no mapa.');
                }
            });
        }
    }
};

export default MapUI;
