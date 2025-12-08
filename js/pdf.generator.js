// js/pdf.generator.js - Gerador de HTML para Impressão Nativa (Premium Edition)

import { openReportPreview } from './utils.js';
import { getImageFromDB } from './database.js';
import { RISK_LABELS } from './constants.js';

/**
 * Converte coordenadas UTM para Latitude e Longitude (WGS84).
 * @param {number} easting - Coordenada X (Leste).
 * @param {number} northing - Coordenada Y (Norte).
 * @param {number} zoneNum - O fuso UTM (ex: 23).
 * @param {string} hemisphere - 'N' para Norte ou 'S' para Sul.
 * @returns {{lat: number, lon: number}} Objeto com latitude e longitude.
 */
function utmToLatLon(easting, northing, zoneNum, hemisphere) {
    const k0 = 0.9996;
    const a = 6378137; // Raio equatorial
    const eccSquared = 0.00669438; // Excentricidade ao quadrado
    const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));

    let x = easting - 500000.0;
    let y = northing;

    if (hemisphere === 'S') {
        y -= 10000000.0;
    }

    const zoneLetter = "N"; // Fixo para o cálculo, o hemisfério já foi tratado.
    const lonOrigin = (zoneNum - 1) * 6 - 180 + 3;

    const eccPrimeSquared = (eccSquared) / (1 - eccSquared);

    const M = y / k0;
    const mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256));

    const phi1Rad = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
        + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

    const N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
    const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
    const C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
    const R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
    const D = x / (N1 * k0);

    let lat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * D * D * D * D / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * D * D * D * D * D * D / 720);
    lat = lat * 180 / Math.PI;

    let lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1Rad);
    lon = lonOrigin + lon * 180 / Math.PI;

    return { lat: lat, lon: lon };
}


/**
 * Converte um Blob de imagem para uma URL de dados Base64.
 * Retorna null se o blob for nulo.
 * @param {Blob|null} blob O blob da imagem.
 * @returns {Promise<string|null>} A URL de dados ou null.
 */
const blobToDataURL = (blob) => {
    return new Promise((resolve, reject) => {
        if (!blob) {
            return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Retorna uma cor hexadecimal com base no nível de risco.
 * @param {string} riskLevel - O texto do nível de risco (ex: "Alto Risco").
 * @returns {string} A cor correspondente.
 */
const getRiskColor = (riskLevel) => {
    if (riskLevel.includes('Alto')) return '#c62828';
    if (riskLevel.includes('Médio')) return '#f57c00';
    if (riskLevel.includes('Extremo')) return '#212121';
    return '#2e7d32';
};

/**
 * Retorna a classe CSS para a linha da tabela baseada no risco.
 * @param {string} riskLevel - O texto do nível de risco.
 * @returns {string} A classe CSS.
 */
const getRiskRowClass = (riskLevel) => {
    if (riskLevel.includes('Extremo')) return 'row-risk-extreme';
    if (riskLevel.includes('Alto')) return 'row-risk-high';
    if (riskLevel.includes('Médio')) return 'row-risk-medium';
    return 'row-risk-low';
};

/**
 * Retorna a classe CSS para o badge de risco.
 * @param {string} riskLevel - O texto do nível de risco.
 * @returns {string} A classe CSS.
 */
const getRiskBadgeClass = (riskLevel) => {
    if (riskLevel.includes('Extremo')) return 'extreme';
    if (riskLevel.includes('Alto')) return 'high';
    if (riskLevel.includes('Médio')) return 'medium';
    return 'low';
};


/**
 * Gera HTML para os fatores de risco de uma árvore.
 * @param {Array<boolean>} riskFactors - Array de fatores de risco.
 * @returns {string} HTML da lista de fatores.
 */
function getRiskFactorsHTML(riskFactors) {
    if (!riskFactors || riskFactors.length === 0) {
        return '<p style="color: #546e7a; font-style: italic; margin: 0;">Nenhum fator de risco crítico identificado.</p>';
    }

    const factorsList = riskFactors
        .map((checked, index) => checked ? `<li>${RISK_LABELS[index]}</li>` : '')
        .filter(item => item !== '')
        .join('');

    if (!factorsList) {
        return '<p style="color: #546e7a; font-style: italic; margin: 0;">Nenhum fator de risco crítico identificado.</p>';
    }

    return `<ul style="margin: 0; padding-left: 20px; color: #37474f;">${factorsList}</ul>`;
}

/**
 * Gera e exibe o relatório GERAL para uma lista de árvores.
 * @param {Array<object>} trees - A lista de árvores registradas.
 */
export async function generateGeneralReport(trees) {
    if (!trees || trees.length === 0) {
        alert("Nenhuma árvore para gerar relatório.");
        return;
    }

    // ========== SEÇÃO 1: TABELA RESUMIDA ==========
    let tableRowsHTML = '';
    trees.forEach((tree, index) => {
        const rowClass = getRiskRowClass(tree.risco);
        const badgeClass = getRiskBadgeClass(tree.risco);
        const displayId = String(index + 1).padStart(3, '0');

        let mainFactor = '-';
        if (tree.riskFactors && tree.riskFactors.length > 0) {
            const firstIndex = tree.riskFactors.findIndex(f => f === true);
            if (firstIndex !== -1) {
                mainFactor = RISK_LABELS[firstIndex];
            }
        }

        tableRowsHTML += `
            <tr>
                <td style="font-weight: 700;">${displayId}</td>
                <td><span style="font-weight: 600;">${tree.especie}</span></td>
                <td style="font-family: monospace; font-size: 8pt;">${tree.coordY || ''}, ${tree.coordX || ''}</td>
                <td style="text-align: center;">${tree.dap || '-'}</td>
                <td style="text-align: center;">${tree.altura || '-'}</td>
                <td style="font-size: 8pt;">${mainFactor}</td>
                <td style="text-align: right;">
                    <span class="badge ${badgeClass}">${tree.risco}</span>
                </td>
            </tr>
        `;
    });

    // ========== SEÇÃO 2: FICHAS DETALHADAS ==========
    let detailCardsHTML = '';

    // Usando for...in ou forEach para pegar index
    for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        const displayId = String(i + 1).padStart(3, '0');

        let imageUrl = tree.image || tree.image_url || tree.photoUrl;
        if (!imageUrl) {
            try {
                imageUrl = await blobToDataURL(await getImageFromDB(tree.id));
            } catch (e) {
                console.error(`Erro ao carregar imagem para árvore ${tree.id}:`, e);
            }
        }
        const riskColor = getRiskColor(tree.risco);
        const riskFactorsHTML = getRiskFactorsHTML(tree.riskFactors);

        detailCardsHTML += `
            <div class="detail-card">
                <div class="detail-card-header" style="border-left: 5px solid ${riskColor}; background-color: #f8f9fa; padding: 8px 12px; border-bottom: 1px solid #eee;">
                    <span style="font-weight: 700; font-size: 1rem; color: #333;">#${displayId} - ${tree.especie}</span>
                    <span style="float: right; font-size: 0.8rem; font-weight: 600; color: #555;">${tree.risco}</span>
                </div>
                <div class="detail-card-body">
                    <div style="flex: 0 0 130px;">
                        ${imageUrl
                ? `<img src="${imageUrl}" alt="Foto de ${tree.especie}" class="detail-card-photo">`
                : `<div class="detail-card-photo" style="display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #999; font-size: 0.8rem;">Sem imagem</div>`
            }
                    </div>
                    <div class="detail-card-info">
                        <p><strong>Espécie:</strong> ${tree.especie}</p>
                        <p><strong>DAP:</strong> ${tree.dap || 'N/A'} cm | <strong>Altura:</strong> ${tree.altura || 'N/A'} m</p>
                        <p><strong>Coordenadas:</strong> ${tree.coordY || 'N/A'}, ${tree.coordX || 'N/A'}</p>
                        <p><strong>Local:</strong> ${tree.local || 'N/A'}</p>
                        
                        <div class="detail-card-factors">
                            <p style="margin: 0 0 5px 0; font-weight: 600;">Fatores de Risco:</p>
                            ${riskFactorsHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ========== MONTAGEM FINAL DO RELATÓRIO ==========
    const reportHTML = `
        <style>
            /* Reset Global */
            html, body { margin: 0; padding: 0; background: white; font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; line-height: 1.3; }
            @page { size: A4; margin: 10mm 15mm; }

            /* Preview */
            #report-preview-overlay { background: #f5f5f5 !important; padding: 40px 0; }
            .report-wrapper-preview { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 10mm; box-shadow: 0 10px 30px rgba(0,0,0,0.1); box-sizing: border-box; }

            @media print {
                .report-wrapper-preview { width: 100%; padding: 0; margin: 0; box-shadow: none; }
                body { background: white; }
                .no-print { display: none !important; }
            }

            /* Professional Typography */
            h2, h3, h4 { margin: 0; color: #000; }
            
            /* Header */
            .report-header { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; border-bottom: 2px solid #000 !important; border-image: none !important; padding-bottom: 8px !important; margin-bottom: 15px !important; }
            .header-logo h2 { font-size: 24pt; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
            .header-logo span { color: #2e7d32; }
            .header-info p { font-size: 9pt; color: #555; text-align: right; margin: 2px 0; }
            
            /* Page Break Fix for Container */
            .report-container > tbody > tr { page-break-inside: auto !important; }
            .report-container > thead > tr { page-break-inside: auto !important; }

            /* Sections */
            .section-header { 
                width: 100%;
                margin-top: 15px !important;
                margin-bottom: 8px !important;
                font-size: 11pt !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                color: #000 !important;
                background: none !important;
                border-bottom: 1px solid #000 !important;
                padding-bottom: 3px !important;
                border-radius: 0 !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
            }

            /* Table */
            .report-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 15px; }
            .report-table th { 
                text-align: left; 
                padding: 10px 4px; 
                border-top: 2px solid #000; 
                border-bottom: 2px solid #000; 
                font-weight: 700; 
                text-transform: uppercase; 
                font-size: 8pt;
                background: white !important;
                color: #000;
            }
            .report-table td { padding: 8px 4px; border-bottom: 1px solid #eee; color: #333; }
            .report-table tr:last-child td { border-bottom: 1px solid #000; }
            .report-table { page-break-before: auto; page-break-after: auto; }
            
            /* Map */
            #rep-map-all { width: 100%; height: 250px; background: #eee; border: 1px solid #ddd; margin-bottom: 15px; page-break-before: auto; page-break-after: avoid; page-break-inside: avoid; }

            /* Cards */
            .detail-card { display: flex; gap: 20px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px; page-break-inside: avoid !important; page-break-before: auto; page-break-after: auto; }
            .detail-card:last-child { border-bottom: none; }
            .card-image-container { flex: 0 0 120px; }
            .card-image { width: 120px; height: 120px; object-fit: cover; border-radius: 2px; background: #f0f0f0; }
            .card-content { flex: 1; }
            
            .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px; }
            .card-title { font-weight: 700; font-size: 11pt; color: #000; }
            
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; font-size: 9pt; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 7.5pt; text-transform: uppercase; color: #777; font-weight: 600; }
            .info-value { font-weight: 500; color: #000; }
            
            .risk-factors { font-size: 9pt; background: #fafafa; padding: 10px; border-radius: 4px; border: 1px solid #eee; }
            
            /* Badges */
            .badge { padding: 3px 8px; border-radius: 2px; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: white; letter-spacing: 0.5px; }
            .badge.low { background: #2e7d32; }
            .badge.medium { background: #f57c00; }
            .badge.high { background: #c62828; }
            .badge.extreme { background: #000; }
            
            .footer { margin-top: 20px; text-align: right; font-size: 8pt; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
            .page-number:after { content: counter(page); }
        </style>

        <div class="report-wrapper-preview">
            <div class="report-header">
                <div class="header-logo">
                    <h2>Arbor<span>IA</span></h2>
                    <div style="font-size: 10pt; font-weight: 500; color: #333; margin-top: 5px;">Relatório Geral de Inventário</div>
                </div>
                <div class="header-info">
                    <p><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <p>Status: <strong>Finalizado</strong></p>
                </div>
            </div>
            
            <table class="report-container">
                <tbody>
                    <tr>
                        <td>
                            <h3 class="section-header">Resumo Executivo</h3>
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">ID</th>
                                        <th>Espécie</th>
                                        <th>Coordenadas</th>
                                        <th style="text-align:center;">DAP (cm)</th>
                                        <th style="text-align:center;">Alt (m)</th>
                                        <th>Fator Principal</th>
                                        <th style="text-align:right;">Risco</th>
                                    </tr>
                                </thead>
                                <tbody>${tableRowsHTML}</tbody>
                            </table>
                            
                            <h3 class="section-header">Distribuição Espacial</h3>
                            <div id="rep-map-all"></div>

                            <h3 class="section-header">Fichas Técnicas</h3>
                            ${detailCardsHTML}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td>
                           <div class="footer">
                                ArborIA - Sistema de Inventário Arbóreo &bull; Página <span class="page-number"></span>
                           </div> 
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    // ========== CALLBACK DO MAPA ==========
    const mapRenderCallback = () => {
        console.log('[GeneralReport] mapRenderCallback chamado');

        if (typeof window.maplibregl === 'undefined') {
            console.error('[GeneralReport] MapLibre GL JS não está carregado');
            const container = document.getElementById('rep-map-all');
            if (container) {
                container.innerHTML = '<p style="text-align:center; padding:20px; color: #999;">Erro ao carregar mapa.</p>';
            }
            return;
        }

        const maplibregl = window.maplibregl;
        const mapContainer = document.getElementById('rep-map-all');

        if (!mapContainer) {
            console.error('[GeneralReport] Container #rep-map-all não encontrado');
            return;
        }

        console.log('[GeneralReport] Inicializando mapa em #rep-map-all');
        const map = new maplibregl.Map({
            container: mapContainer,
            style: {
                version: 8,
                sources: {
                    'satellite': {
                        type: 'raster',
                        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                        tileSize: 256,
                        attribution: '© Google'
                    }
                },
                layers: [{
                    id: 'satellite-layer',
                    type: 'raster',
                    source: 'satellite',
                    minzoom: 0,
                    maxzoom: 20
                }]
            },
            center: [-47.92, -15.78], // [lng, lat]
            zoom: 4
        });

        // Criar GeoJSON para markers
        const features = [];
        trees.forEach(t => {
            if (t.coordY && t.coordX) {
                let lat = parseFloat(t.coordY);
                let lng = parseFloat(t.coordX);

                if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
                    const coords = utmToLatLon(lng, lat, 23, 'S');
                    lat = coords.lat;
                    lng = coords.lon;
                }

                if (!isNaN(lat) && !isNaN(lng)) {
                    const color = getRiskColor(t.risco);
                    features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat]
                        },
                        properties: {
                            id: t.id,
                            especie: t.especie, // Add especie for label layer
                            color: color
                        }
                    });
                }
            }
        });

        const geoJson = {
            type: 'FeatureCollection',
            features: features
        };

        map.on('load', () => {
            map.addSource('report-trees', {
                type: 'geojson',
                data: geoJson
            });

            map.addLayer({
                id: 'report-tree-markers',
                type: 'circle',
                source: 'report-trees',
                paint: {
                    'circle-radius': 6,
                    'circle-color': 'white',
                    'circle-stroke-color': ['get', 'color'],
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.9
                }
            });

            // Adicionar labels (Simbologia GIS)
            map.addLayer({
                id: 'report-tree-labels',
                type: 'symbol',
                source: 'report-trees',
                layout: {
                    'text-field': ['get', 'especie'], // Nome da espécie
                    'text-size': 10,
                    'text-anchor': 'top',
                    'text-justify': 'center',
                    'text-offset': [0, 0.6]
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 2,
                    'text-opacity': 0.9
                }
            });
        });

        // Fit bounds to all markers
        if (features.length > 0) {
            const bounds = new maplibregl.LngLatBounds();
            features.forEach(feature => {
                bounds.extend(feature.geometry.coordinates);
            });
            map.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 40, right: 40 } });
        }
    };

    openReportPreview(reportHTML, mapRenderCallback);
}

/**
 * Gera e exibe o relatório INDIVIDUAL para uma única árvore.
 * @param {object} tree - O objeto da árvore.
 */
export async function generateIndividualReport(tree) {
    if (!tree) return;

    let imageUrl = tree.image || tree.image_url || tree.photoUrl;
    if (!imageUrl) {
        try {
            imageUrl = await blobToDataURL(await getImageFromDB(tree.id));
        } catch (e) {
            console.error(`Erro ao carregar imagem para árvore ${tree.id}: `, e);
        }
    }
    const riskColor = getRiskColor(tree.risco);
    const riskFactorsHTML = getRiskFactorsHTML(tree.riskFactors);

    const reportHTML = `
        <style>
            /* Reset & Base */
            html, body { margin: 0; padding: 0; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; line-height: 1.3; }
            @page { size: A4; margin: 10mm 15mm; }
            
            /* Preview */
            #report-preview-overlay { background: #f5f5f5 !important; padding: 40px 0; }
            .report-wrapper-preview { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 10mm; box-shadow: 0 10px 30px rgba(0,0,0,0.1); box-sizing: border-box; }
            
            @media print {
                .report-wrapper-preview { width: 100%; padding: 0; margin: 0; box-shadow: none; }
                body { background: white; }
                .no-print { display: none !important; }
                .page-break { page-break-before: always; }
            }

            /* Header */
            .report-header { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; border-bottom: 2px solid #000 !important; border-image: none !important; padding-bottom: 8px !important; margin-bottom: 15px !important; }
            .header-logo h2 { margin: 0; color: #000; font-size: 24pt; font-weight: 800; letter-spacing: -1px; line-height: 1; }
            .header-logo span { color: #2e7d32; }
            .header-info p { margin: 0; font-size: 9pt; color: #666; text-align: right; }

            /* Page Break Fix for Container */
            .report-container > tbody > tr { page-break-inside: auto !important; }
            .report-container > thead > tr { page-break-inside: auto !important; }

            /* Sections */
            .section-header { 
                width: 100%;
                margin-top: 15px !important;
                margin-bottom: 8px !important;
                font-size: 11pt !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                color: #000 !important;
                background: none !important;
                border-bottom: 1px solid #000 !important;
                padding-bottom: 3px !important;
                letter-spacing: 0.5px !important;
                border-radius: 0 !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
            }

            /* Layout Grid */
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
            
            /* Images & Map */
            .feature-image { width: 100%; height: 250px; object-fit: cover; background: #eee; border-radius: 2px; }
            #rep-map-single { width: 100%; height: 250px; background: #eee; border: 1px solid #ddd; border-radius: 2px; page-break-inside: avoid; }

            /* Key-Value Info */
            .info-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
            .info-table td { padding: 6px 0; border-bottom: 1px solid #eee; vertical-align: top; }
            .info-label { font-weight: 600; color: #555; width: 120px; font-size: 8.5pt; }
            .info-value { color: #000; }

            /* Risk Box */
            .risk-box { padding: 12px; background: #fafafa; border-left: 4px solid #333; margin-top: 8px; page-break-inside: avoid; }
            .factors-list { margin: 8px 0 0 0; padding-left: 20px; color: #444; font-size: 9pt; }

            /* Badges */
            .badge { display: inline-block; padding: 3px 8px; border-radius: 2px; font-weight: 700; text-transform: uppercase; color: white; font-size: 7.5pt; letter-spacing: 0.5px; }
            .badge.low { background: #2e7d32; }
            .badge.medium { background: #f57c00; }
            .badge.high { background: #c62828; }
            .badge.extreme { background: #000; }

            .footer { margin-top: 20px; text-align: right; font-size: 8pt; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        </style>

        <div class="report-wrapper-preview">
            <div class="report-header">
                <div class="header-logo">
                    <h2>Arbor<span>IA</span></h2>
                    <div style="font-size: 10pt; font-weight: 500; color: #333; margin-top: 5px;">Ficha Técnica Individual</div>
                </div>
                <div class="header-info">
                    <p><strong>ID da Árvore:</strong> #${tree.id}</p>
                    <p><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div class="grid-2">
                <div>
                     ${imageUrl
            ? `<img src="${imageUrl}" class="feature-image" alt="${tree.especie}">`
            : `<div class="feature-image" style="display:flex;align-items:center;justify-content:center;color:#ccc;">Sem Foto</div>`
        }
                </div>
                <div>
                     <div id="rep-map-single"></div>
                </div>
            </div>

            <div class="grid-2">
                <div>
                    <h3 class="section-header">Dados da Árvore</h3>
                    <table class="info-table">
                        <tr><td class="info-label">Espécie:</td><td class="info-value" style="font-style:italic;">${tree.especie}</td></tr>
                        <tr><td class="info-label">Altura (Est.):</td><td class="info-value">${tree.altura || '-'} m</td></tr>
                        <tr><td class="info-label">DAP:</td><td class="info-value">${tree.dap || '-'} cm</td></tr>
                        <tr><td class="info-label">Coordenadas:</td><td class="info-value">${tree.coordY || ''}, ${tree.coordX || ''}</td></tr>
                        <tr><td class="info-label">Localização:</td><td class="info-value">${tree.local || 'Não informado'}</td></tr>
                        <tr><td class="info-label">Avaliador:</td><td class="info-value">${tree.avaliador || '-'}</td></tr>
                    </table>
                </div>
                
                <div>
                    <h3 class="section-header">Avaliação de Risco</h3>
                    <div class="risk-box" style="border-left-color: ${riskColor};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <span style="font-weight:700; color:#333;">Classificação de Risco</span>
                            <span class="badge" style="background-color:${riskColor}">${tree.risco}</span>
                        </div>
                        <div style="font-size:9pt; font-weight:600; text-transform:uppercase; color:#555;">Fatores Agravantes</div>
                        ${riskFactorsHTML}
                    </div>

                    <h3 class="section-header" style="margin-top:20px;">Observações</h3>
                    <div style="font-size:10pt; color:#333; line-height:1.5; background:#f9f9f9; padding:10px; border-radius:2px;">
                        ${tree.observacoes || 'Nenhuma observação registrada.'}
                    </div>
                </div>
            </div>

            <div class="footer">
                ArborIA - Sistema de Inventário Arbóreo
            </div>
        </div>
    `;

    const mapRenderCallback = () => {
        console.log('[IndividualReport] mapRenderCallback chamado');

        if (typeof window.maplibregl === 'undefined') {
            console.error('[IndividualReport] MapLibre GL JS não está carregado');
            const container = document.getElementById('rep-map-single');
            if (container) {
                container.innerHTML = '<p style="text-align:center; padding:20px; color: #999;">Erro ao carregar mapa.</p>';
            }
            return;
        }

        const maplibregl = window.maplibregl;
        const mapContainer = document.getElementById('rep-map-single');

        if (!mapContainer) {
            console.error('[IndividualReport] Container #rep-map-single não encontrado');
            return;
        }

        if (tree.coordY && tree.coordX) {
            let lat = parseFloat(tree.coordY);
            let lng = parseFloat(tree.coordX);

            if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
                const coords = utmToLatLon(lng, lat, 23, 'S');
                lat = coords.lat;
                lng = coords.lon;
            }

            if (!isNaN(lat) && !isNaN(lng)) {
                const map = new maplibregl.Map({
                    container: mapContainer,
                    style: {
                        version: 8,
                        sources: {
                            'satellite': {
                                type: 'raster',
                                tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                                tileSize: 256,
                                attribution: '© Google'
                            }
                        },
                        layers: [{
                            id: 'satellite-layer',
                            type: 'raster',
                            source: 'satellite',
                            minzoom: 0,
                            maxzoom: 20
                        }]
                    },
                    center: [lng, lat],
                    zoom: 18
                });

                const color = getRiskColor(tree.risco);
                map.on('load', () => {
                    map.addSource('single-tree', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [lng, lat]
                            },
                            properties: {
                                especie: tree.especie,
                                id: tree.id,
                                risco: tree.risco,
                                color: color
                            }
                        }
                    });

                    map.addLayer({
                        id: 'single-tree-marker',
                        type: 'circle',
                        source: 'single-tree',
                        paint: {
                            'circle-radius': 10,
                            'circle-color': 'white',
                            'circle-stroke-color': ['get', 'color'],
                            'circle-stroke-width': 3,
                            'circle-opacity': 0.9
                        }
                    });

                    // Adicionar popup
                    new maplibregl.Popup({ closeButton: false })
                        .setLngLat([lng, lat])
                        .setHTML(`< b > ${tree.especie}</b > <br>ID: ${tree.id}<br>Risco: ${tree.risco}`)
                        .addTo(map);
                });
            } else {
                mapContainer.innerHTML = '<p style="text-align:center; padding:20px; color: #999;">Coordenadas inválidas.</p>';
            }
        } else {
            mapContainer.innerHTML = '<p style="text-align:center; padding:20px; color: #999;">Coordenadas não disponíveis.</p>';
        }
    };

    openReportPreview(reportHTML, mapRenderCallback);
}
