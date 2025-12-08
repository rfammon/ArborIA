// js/report.js

import * as state from './state.js';
import * as db from './database.js';
import * as utils from './utils.js'; // Assuming utils.js has necessary helper functions like showToast

// Helper to convert UTM to Lat/Lon (copied from tree.service.js)
function convertToLatLon(tree) {
    if (tree.coordX === 'N/A' || tree.coordY === 'N/A') return null;
    if (typeof window.proj4 === 'undefined') {
        console.error("Proj4js not loaded");
        return null;
    }

    const e = parseFloat(tree.coordX);
    const n = parseFloat(tree.coordY);
    const zn = tree.utmZoneNum || 23; // Default to zone 23 if not specified
    const hemi = '+south'; // Assuming southern hemisphere for UTM in Brazil

    // Define UTM projection based on zone and hemisphere
    const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;

    try {
        // Convert to Lat/Lon (EPSG:4326)
        const ll = window.proj4(def, "EPSG:4326", [e, n]);
        return [ll[1], ll[0]]; // Leaflet uses [latitude, longitude]
    } catch (e) {
        console.error("Error converting coordinates:", e);
        return null;
    }
}

let reportMap = null; // To hold the MapLibre map instance

// Function to initialize and populate the map
async function initializeReportMap(trees) {
    const mapContainer = document.getElementById('report-map-container');
    if (!mapContainer) {
        console.error("Map container not found");
        return;
    }

    // Ensure map container is visible and has dimension
    mapContainer.style.height = '300px'; // Set a default height
    mapContainer.style.width = '100%';

    // Clear existing map if any
    if (reportMap) {
        reportMap.remove();
        reportMap = null;
    }

    // Initialize map - default view (e.g., Brazil center)
    // Using Google Hybrid Tiles correctly formatted for MapLibre
    reportMap = new maplibregl.Map({
        container: 'report-map-container',
        style: {
            version: 8,
            sources: {
                'google-hybrid': {
                    type: 'raster',
                    tiles: [
                        'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
                        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
                        'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
                        'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
                    ],
                    tileSize: 256,
                    attribution: '© Google Maps'
                }
            },
            layers: [{
                id: 'google-hybrid-layer',
                type: 'raster',
                source: 'google-hybrid',
                minzoom: 0,
                maxzoom: 22
            }]
        },
        center: [-51.925, -14.235], // [lng, lat]
        zoom: 4
    });

    // Criar GeoJSON para markers
    const features = [];
    const bounds = new maplibregl.LngLatBounds();

    trees.forEach(tree => {
        const latLon = convertToLatLon(tree);
        if (latLon) {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [latLon[1], latLon[0]] // [lng, lat]
                },
                properties: {
                    id: tree.id,
                    especie: tree.especie,
                    local: tree.local,
                    risco: tree.risco
                }
            });
            bounds.extend([latLon[1], latLon[0]]);
        }
    });

    reportMap.on('load', () => {
        const geoJson = {
            type: 'FeatureCollection',
            features: features
        };

        // Add source for trees
        if (!reportMap.getSource('report-trees')) {
            reportMap.addSource('report-trees', {
                type: 'geojson',
                data: geoJson
            });
        }

        // Add layer for tree markers
        if (!reportMap.getLayer('report-tree-markers')) {
            reportMap.addLayer({
                id: 'report-tree-markers',
                type: 'circle',
                source: 'report-trees',
                paint: {
                    'circle-radius': 6,
                    'circle-color': [
                        'match',
                        ['get', 'risco'],
                        'Baixo Risco', '#4caf50',
                        'Médio Risco', '#ff9800',
                        'Alto Risco', '#f44336',
                        'Crítico', '#b71c1c',
                        '#9e9e9e' // default color
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
        }

        if (!bounds.isEmpty()) {
            reportMap.fitBounds(bounds, {
                padding: {top: 50, bottom: 50, left: 50, right: 50},
                maxZoom: 19 // Prevent zooming in too close if only one point
            });
        }
    });

    // Invalidate size ensures map tiles render correctly after container might have been hidden/shown
    // MapLibre uses resize() instead of invalidateSize()
    setTimeout(() => {
        reportMap.resize();
    }, 200);

    // Give map a moment to load tiles before html2canvas
    await new Promise(resolve => setTimeout(resolve, 1000));
}

// Function to generate and populate the HTML report
async function generateReportHTML() {
    console.log("Generating report HTML...");
    const registeredTrees = state.getRegisteredTrees();
    console.log("Trees loaded:", registeredTrees.length);
    
    const treeCardsContainer = document.getElementById('tree-cards-container');
    const noTreesMessage = document.getElementById('no-trees-message');
    
    const reportMapSection = document.querySelector('.report-map-section');


    // Clear previous content
    treeCardsContainer.innerHTML = '';

    if (registeredTrees.length === 0) {
        noTreesMessage.style.display = 'block';
        document.getElementById('report-total-trees').textContent = 0;
        document.getElementById('report-critical-risk').textContent = '0 indiv.';
        document.getElementById('report-high-risk').textContent = '0 indiv.';
        document.getElementById('report-medium-risk').textContent = '0 indiv.';
        document.getElementById('report-low-risk').textContent = '0 indiv.';
        if (reportMapSection) reportMapSection.style.display = 'none'; // Hide map if no trees
        return;
    } else {
        noTreesMessage.style.display = 'none';
        if (reportMapSection) reportMapSection.style.display = 'block'; // Show map if trees are present
        
    }

    // Populate summary statistics
    const totalTrees = registeredTrees.length;
    let criticalRisk = 0;
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;

    registeredTrees.forEach(tree => {
        if (tree.risco === 'Crítico') criticalRisk++;
        else if (tree.risco === 'Alto Risco') highRisk++;
        else if (tree.risco === 'Médio Risco') mediumRisk++;
        else if (tree.risco === 'Baixo Risco') lowRisk++;
    });

    document.getElementById('report-total-trees').textContent = totalTrees;
    document.getElementById('report-critical-risk').textContent = `${criticalRisk} indiv.`;
    document.getElementById('report-high-risk').textContent = `${highRisk} indiv.`;
    document.getElementById('report-medium-risk').textContent = `${mediumRisk} indiv.`;
    document.getElementById('report-low-risk').textContent = `${lowRisk} indiv.`;
    document.getElementById('report-date').textContent = new Date().toLocaleDateString('pt-BR');
    document.getElementById('report-generation-date').textContent = new Date().toLocaleDateString('pt-BR');

    // Generate a unique report reference ID
    const reportRefId = `ARBORIA-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    document.getElementById('report-ref-id').textContent = reportRefId;

    // Initialize and populate the map
    await initializeReportMap(registeredTrees);

    // Populate tree cards
    for (const tree of registeredTrees) {
        const treeCard = document.createElement('div');
        treeCard.className = 'tree-card break-inside-avoid';

        let photoHtml = `
            <div class="card-photo">
                <i class="fa-solid fa-camera no-photo-icon"></i>
                <span class="photo-id">Foto ID: ${tree.id}</span>
                <div class="risk-badge ${getRiskBadgeClass(tree.risco)}">${tree.risco.toUpperCase()}</div>
            </div>
        `;

        if (tree.hasPhoto) {
            // console.log(`Fetching photo for tree ${tree.id}`);
            const blob = await new Promise(resolve => db.getImageFromDB(tree.id, resolve));
            if (blob) {
                const imageUrl = URL.createObjectURL(blob);
                photoHtml = `
                    <div class="card-photo">
                        <img src="${imageUrl}" alt="Foto da Árvore ${tree.id}">
                        <span class="photo-id">Foto ID: ${tree.id}</span>
                        <div class="risk-badge ${getRiskBadgeClass(tree.risco)}">${tree.risco.toUpperCase()}</div>
                    </div>
                `;
                // console.log(`Photo loaded for tree ${tree.id}`);
            } else {
                // console.log(`No photo blob found for tree ${tree.id}`);
            }
        }

        const actionTag = getActionTag(tree.risco); // Function to determine action text and class
        
        treeCard.innerHTML = `
            ${photoHtml}
            <div class="card-content">
                <div class="risk-indicator-bar ${getRiskBadgeClass(tree.risco)}"></div>
                <div>
                    <span class="tree-id-tag">ID: ${tree.id}</span>
                    <h3 class="tree-species">${tree.especie}</h3>
                    <p class="tree-scientific-name">${tree.local || 'N/A'}</p>
                </div>
                <div class="tech-data-grid">
                    <div class="tech-data-item"><span>DAP</span><span>${tree.dap !== 'N/A' ? tree.dap + ' cm' : 'N/A'}</span></div>
                    <div class="tech-data-item"><span>Altura</span><span>${tree.altura !== '0.0' ? tree.altura + ' m' : 'N/A'}</span></div>
                    <div class="tech-data-item"><span>Risco</span><span class="risk-emphasis">${tree.risco}</span></div>
                </div>
                <div class="card-footer">
                    <p class="observation"><strong>Obs:</strong> ${tree.observacoes || 'Sem observações.'}</p>
                    <div class="action-tag ${actionTag.class}">
                        <i class="${actionTag.icon}"></i>
                        <span>${actionTag.text}</span>
                    </div>
                </div>
            </div>
        `;
        treeCardsContainer.appendChild(treeCard);
        // console.log(`Card created for tree ${tree.id}`);
    }
}

// Helper to determine risk badge class
function getRiskBadgeClass(risco) {
    if (risco === 'Crítico') return 'risk-high'; // Using 'risk-high' for critical as per exemplo.html
    if (risco === 'Alto Risco') return 'risk-high';
    if (risco === 'Médio Risco') return 'risk-medium';
    if (risco === 'Baixo Risco') return 'risk-low';
    return '';
}

// Helper to determine action tag content based on risk
function getActionTag(risco) {
    if (risco === 'Crítico' || risco === 'Alto Risco') {
        return {
            text: 'SUPRESSÃO OU PODA URGENTE',
            icon: 'fa-solid fa-triangle-exclamation',
            class: 'action-high'
        };
    }
    if (risco === 'Médio Risco') {
        return {
            text: 'MONITORAMENTO / PODA DE CONTENÇÃO',
            icon: 'fa-solid fa-scissors',
            class: 'action-medium'
        };
    }
    return {
        text: 'SEM AÇÃO RECOMENDADA',
        icon: 'fa-solid fa-check',
        class: 'action-low'
    };
}


// Function to export the HTML report to PDF
async function exportReportToPDF() {
    utils.showToast('Gerando PDF...', 'info');
    const reportContainer = document.getElementById('report-content'); // The div containing all report content

    // Temporarily hide elements that should not be in the PDF (e.g., the "Generate PDF" button itself)
    const elementsToHide = document.querySelectorAll('.no-print');
    elementsToHide.forEach(el => el.style.display = 'none');

    // Ensure images are loaded before generating PDF
    const images = reportContainer.querySelectorAll('img');
    const imageLoadPromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve; // Resolve even if image fails to load
        });
    });
    await Promise.all(imageLoadPromises);


    // Use html2canvas to render the HTML as a canvas
    html2canvas(reportContainer, {
        scale: 2, // Higher scale for better resolution in PDF
        useCORS: true, // Important for loading images from different origins (e.g., IndexedDB blobs)
        logging: false, // Disable logging for cleaner console
        scrollX: 0,
        scrollY: -window.scrollY // Capture from top of the page
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' size
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save('laudo-arboria.pdf');
        utils.showToast('PDF gerado com sucesso!', 'success');

        // Restore hidden elements
        elementsToHide.forEach(el => el.style.display = '');
    }).catch(error => {
        console.error("PDF generation error:", error);
        utils.showToast('Erro ao gerar PDF. Tente novamente.', 'error');
        // Restore hidden elements in case of error
        elementsToHide.forEach(el => el.style.display = '');
    });
}

// Initialize the report generation when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Report page loaded");
    
    // Make sure the database is initialized before trying to get images
    await db.initImageDB(); // Ensure DB is ready
    
    // Log localStorage content for debugging
    const storageKey = 'manualPodaData'; // Assuming this is the correct key from state.js
    // console.log("Storage content:", localStorage.getItem(storageKey));
    
    await state.loadDataFromStorage(); // Load tree data
    
    // Initial render of the report
    await generateReportHTML();

    // Attach event listener to the PDF generation button
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', exportReportToPDF);
        console.log("PDF button listener attached");
    } else {
        console.error("PDF button not found");
    }
});
