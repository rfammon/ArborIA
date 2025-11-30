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
    for (const tree of trees) {
        const rowClass = getRiskRowClass(tree.risco);
        const badgeClass = getRiskBadgeClass(tree.risco);
        
        let mainFactor = 'Nenhum';
        if (tree.riskFactors && tree.riskFactors.length > 0) {
            const firstIndex = tree.riskFactors.findIndex(f => f === true);
            if (firstIndex !== -1) {
                mainFactor = RISK_LABELS[firstIndex];
            }
        }

        tableRowsHTML += `
            <tr class="${rowClass}">
                <td style="font-weight: 600;">${tree.id}</td>
                <td>${tree.especie}</td>
                <td style="font-size: 0.8rem;">${tree.coordY || 'N/A'}, ${tree.coordX || 'N/A'}</td>
                <td style="text-align: center;">${tree.dap || 'N/A'} cm</td>
                <td style="text-align: center;">${tree.altura || 'N/A'} m</td>
                <td>${mainFactor}</td>
                <td style="text-align: center;">
                    <span class="risk-badge ${badgeClass}">${tree.risco}</span>
                </td>
            </tr>
        `;
    }

    // ========== SEÇÃO 2: FICHAS DETALHADAS ==========
    let detailCardsHTML = '';
    for (const tree of trees) {
        const imageUrl = await blobToDataURL(await getImageFromDB(tree.id));
        const riskColor = getRiskColor(tree.risco);
        const riskFactorsHTML = getRiskFactorsHTML(tree.riskFactors);

        detailCardsHTML += `
            <div class="detail-card">
                <div class="detail-card-header" style="border-top: 4px solid ${riskColor}; background-color: #f8f9fa; padding: 6px 10px;">
                    <span style="font-weight: 600; font-size: 0.9rem;">ID: ${tree.id} - ${tree.especie}</span>
                    <span style="float: right; font-size: 0.8rem;">${tree.risco}</span>
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
            html, body {
                margin: 0;
                padding: 0;
                background: white; /* Fundo branco para a aplicação */
                font-family: Arial, sans-serif;
            }

            /* Configuração de Página para Impressão - Margens Estreitas 5mm */
            @page {
                size: A4;
                margin: 5mm;
            }

            /* --- MODO TELA (PREVIEW WYSIWYG) --- */
            @media screen {
                /* Container Pai (O que envolve a folha na tela) */
                #report-preview-overlay {
                    background: white !important; /* Tela inteira branca */
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    overflow-y: auto;
                }

                /* Override nos estilos inline do utils.js para garantir controle total */
                #report-paper {
                    padding: 0 !important;
                    width: auto !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    display: block !important;
                }

                /* A "Folha" na tela */
                .report-wrapper-preview {
                    width: 210mm; /* Largura A4 Fixa */
                    min-height: 297mm; /* Altura A4 Mínima */
                    margin: 0 auto;
                    background: white;
                    padding: 5mm; /* Simula a margem da impressão (visual apenas) */
                    box-sizing: border-box; /* Garante que 210mm inclui o padding */
                    /* Sem sombra ou borda conforme pedido de "fundo branco", mas útil para debug visual se o fundo fosse colorido. 
                       Como o fundo é branco, a folha se funde. */
                }
            }

            /* --- MODO IMPRESSÃO --- */
            @media print {
                body {
                    background: white;
                }

                .report-wrapper-preview {
                    width: 100%;
                    padding: 0; /* Importante: A margem vem do @page */
                    margin: 0;
                }

                /* Esconde elementos de UI da tela se vazarem */
                .no-print, button, #btn-close-report, #btn-print-report {
                    display: none !important;
                }
                
                /* Layout de Alta Densidade */
                .detail-card {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    display: block;
                }
                
                tr { page-break-inside: avoid; }
                .section-header { page-break-after: avoid; }
            }

            /* --- ESTILOS DE CONTEÚDO (Compartilhado) --- */
            
            /* Tabela Principal */
            .report-container {
                width: 100%;
                margin-top: 0; /* Topo Absoluto */
            }

            /* Cabeçalho */
            .report-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #0d47a1;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }

            .section-header {
                margin-top: 15px;
                font-size: 1.1rem;
                color: #222;
                border-bottom: 1px solid #ccc;
                padding-bottom: 4px;
            }

            /* Tabela de Dados */
            .report-table {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
                font-size: 9pt; /* Fonte reduzida para densidade */
            }
            .report-table th, .report-table td {
                border: 1px solid #ddd;
                padding: 4px 6px;
                text-align: left;
            }
            .report-table th {
                background-color: #f2f2f2;
                font-weight: bold;
                text-transform: uppercase;
                font-size: 8pt;
            }

            /* Mapa */
            #rep-map-all {
                width: 100%;
                height: 350px;
                border: 1px solid #ccc;
                border-radius: 4px;
                margin-top: 10px;
                margin-bottom: 20px;
            }

            /* Cards de Árvores (Alta Densidade) */
            .detail-card {
                 border: 1px solid #cfd8dc;
                 border-radius: 4px;
                 overflow: hidden;
                 background: #fff;
                 margin-bottom: 10px;
                 font-size: 10pt; /* Fonte reduzida */
            }
            .detail-card-body {
                display: flex;
                gap: 10px;
                padding: 8px;
            }
            .detail-card-photo {
                width: 100%;
                height: 100px;
                object-fit: cover;
                border-radius: 2px;
                background: #f0f0f0;
                border: 1px solid #eee;
            }
            .detail-card-info p {
                margin: 2px 0;
                line-height: 1.3;
            }
            .detail-card-factors {
                margin-top: 5px;
                font-size: 9pt;
            }
            .detail-card-factors ul {
                padding-left: 15px;
                margin: 0;
            }

            /* Indicadores de Risco */
            .row-risk-extreme { border-left: 4px solid #212121; }
            .row-risk-high { border-left: 4px solid #c62828; }
            .row-risk-medium { border-left: 4px solid #f57c00; }
            .row-risk-low { border-left: 4px solid #2e7d32; }

            .risk-badge {
                padding: 2px 6px;
                border-radius: 4px;
                color: white;
                font-size: 8pt;
                font-weight: bold;
                display: inline-block;
            }
            .risk-badge.extreme { background-color: #212121; }
            .risk-badge.high { background-color: #c62828; }
            .risk-badge.medium { background-color: #f57c00; }
            .risk-badge.low { background-color: #2e7d32; }

        </style>

        <div class="report-wrapper-preview">
            <table class="report-container">
                <thead>
                    <tr>
                        <td>
                            <div class="report-header">
                                <div>
                                    <h2 style="color: #0d47a1; font-weight: 800; font-size: 1.6rem; margin: 0;">Arbor<span style="color: #1b5e20;">IA</span></h2>
                                    <p style="font-size: 1rem; color: #37474f; font-weight: 500; margin: 0;">Relatório Geral de Inventário Arbóreo</p>
                                </div>
                                <div style="text-align: right;">
                                    <p style="font-size: 0.8rem; color: #546e7a; margin: 0;"><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
                                </div>
                            </div>
                        </td>
                    </tr>
                </thead>
                
                <tbody>
                    <tr>
                        <td>
                            <h3 class="section-header">📊 Resumo Executivo</h3>
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th style="width: 5%;">ID</th>
                                        <th style="width: 20%;">Espécie</th>
                                        <th style="width: 18%;">Coordenadas</th>
                                        <th style="width: 8%;">DAP</th>
                                        <th style="width: 8%;">Altura</th>
                                        <th style="width: 21%;">Fator Principal</th>
                                        <th style="width: 12%;">Risco</th>
                                    </tr>
                                </thead>
                                <tbody>${tableRowsHTML}</tbody>
                            </table>
                            
                            <h3 class="section-header">🗺️ Distribuição Espacial das Árvores</h3>
                            <div id="rep-map-all"></div>

                            <h3 class="section-header">🌳 Fichas Técnicas Individuais</h3>
                            ${detailCardsHTML}
                        </td>
                    </tr>
                </tbody>

                <tfoot>
                    <tr>
                        <td>
                            <div class="footer" style="width: 100%; text-align: right; font-size: 10pt; padding-top: 10px; color: #555;">
                                Página <span class="page-number"></span>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    // ========== CALLBACK DO MAPA ==========
    const mapRenderCallback = () => {
        const L = window.L;
        const map = L.map('rep-map-all').setView([-15.78, -47.92], 4);
        L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            attribution: '© Google Maps',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }).addTo(map);

        const markers = [];
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
                    const marker = L.circleMarker([lat, lng], {
                        radius: 6,
                        color: 'white',
                        weight: 1,
                        fillColor: color,
                        fillOpacity: 0.9
                    }).bindTooltip(`<b>ID: ${t.id}</b>`, { direction: 'top' });
                    markers.push(marker);
                }
            }
        });
        
        if (markers.length > 0) {
            const featureGroup = L.featureGroup(markers).addTo(map);
            map.fitBounds(featureGroup.getBounds(), { padding: [40, 40] });
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

    const imageUrl = await blobToDataURL(await getImageFromDB(tree.id));
    const riskColor = getRiskColor(tree.risco);
    const riskFactorsHTML = getRiskFactorsHTML(tree.riskFactors);

    const reportHTML = `
        <style>
            @page {
                size: A4;
                margin: 15mm 10mm 10mm 15mm; /* Margens Reduzidas pela Metade: Sup/Esq 1.5cm, Inf/Dir 1cm */
            }

            @media print {
                html, body {
                    margin: 0;
                    padding: 0;
                    background: white;
                    color: black;
                    font-family: 'Times New Roman', serif;
                    font-size: 12pt;
                }
                
                table.report-container {
                    width: 100%;
                    border-collapse: collapse;
                }

                thead, tfoot {
                    display: table-header-group;
                }

                tfoot {
                    display: table-footer-group;
                }

                .footer {
                    position: fixed;
                    bottom: 0;
                    width: 100%;
                    text-align: right;
                    font-size: 10pt;
                    color: #555;
                }

                .page-number::after {
                    content: counter(page);
                }
                
                .arb-card, .report-table tr {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .section-header {
                     page-break-after: avoid;
                }
                .arb-card, .report-table, .a4-paper {
                    box-shadow: none !important;
                    border-color: #ccc;
                }
            }
            body { font-family: sans-serif; }
            .section-header { margin-top: 25px; font-size: 1.2rem; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .arb-card { border: 1px solid #ddd; border-radius: 6px; margin-top: 15px; }
            .arb-card-body { padding: 15px; line-height: 1.8; }
        </style>

        <table class="report-container">
            <thead>
                <tr>
                    <td>
                        <div class="report-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d47a1; padding-bottom: 10px;">
                            <div>
                                <h2 style="color: #0d47a1; font-weight: 800; font-size: 1.8rem; margin: 0;">Arbor<span style="color: #1b5e20;">IA</span></h2>
                                <p style="font-size: 1.1rem; color: #37474f; font-weight: 500; margin: 0;">Ficha Técnica Individual - ID ${tree.id}</p>
                            </div>
                            <div style="text-align: right;">
                                <p style="font-size: 0.85rem; color: #546e7a; margin: 0;"><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
                            </div>
                        </div>
                    </td>
                </tr>
            </thead>
            
            <tbody>
                <tr>
                    <td>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                            <div class="arb-card" style="margin: 0;">
                                ${imageUrl 
                                    ? `<img src="${imageUrl}" alt="Foto de ${tree.especie}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 6px;">` 
                                    : `<div style="text-align:center; padding: 20px; height: 300px; display:flex; align-items:center; justify-content:center; background: #f5f5f5; border-radius: 6px; color: #999;">Sem imagem</div>`
                                }
                            </div>
                            <div id="rep-map-single" style="border: 1px solid #ccc; border-radius: 6px; min-height: 300px;"></div>
                        </div>

                        <h3 class="section-header">📋 Dados Dendrométricos e Localização</h3>
                        <div class="arb-card" style="margin-top: 0;">
                            <div class="arb-card-body">
                                <p><strong>Espécie:</strong> ${tree.especie}</p>
                                <p><strong>Local:</strong> ${tree.local || 'Não informado'}</p>
                                <p><strong>Avaliador:</strong> ${tree.avaliador || 'Não informado'}</p>
                                <hr style="border:0; border-top:1px solid #eee; margin: 12px 0;">
                                <p><strong>Altura Estimada:</strong> ${tree.altura || 'N/A'} m</p>
                                <p><strong>DAP:</strong> ${tree.dap || 'N/A'} cm</p>
                                <p><strong>Coordenadas:</strong> ${tree.coordY || 'N/A'}, ${tree.coordX || 'N/A'}</p>
                                <hr style="border:0; border-top:1px solid #eee; margin: 12px 0;">
                                <p><strong>Nível de Risco:</strong> <span style="font-weight:bold; color:${riskColor};">${tree.risco}</span></p>
                            </div>
                        </div>

                        <h3 class="section-header">⚠️ Fatores de Risco Identificados (TRAQ)</h3>
                        <div class="arb-card" style="margin-top: 0;">
                            <div class="arb-card-body">${riskFactorsHTML}</div>
                        </div>
                        
                        <h3 class="section-header">📝 Observações de Campo</h3>
                        <div class="arb-card" style="margin-top: 0;">
                            <div class="arb-card-body">
                                <p style="margin:0; line-height: 1.6;">${tree.observacoes || 'Nenhuma observação.'}</p>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>

            <tfoot>
                <tr>
                    <td>
                        <div class="footer" style="width: 100%; text-align: right; font-size: 10pt;">
                            Página <span class="page-number"></span>
                        </div>
                    </td>
                </tr>
            </tfoot>
        </table>
    `;

    const mapRenderCallback = () => {
        const L = window.L;
        const mapContainer = document.getElementById('rep-map-single');
        
        if (tree.coordY && tree.coordX) {
            let lat = parseFloat(tree.coordY);
            let lng = parseFloat(tree.coordX);

            if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
                const coords = utmToLatLon(lng, lat, 23, 'S');
                lat = coords.lat;
                lng = coords.lon;
            }

            if (!isNaN(lat) && !isNaN(lng)) {
                const map = L.map(mapContainer).setView([lat, lng], 18);
                L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                    attribution: '© Google Maps',
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
                }).addTo(map);
                
                const color = getRiskColor(tree.risco);
                L.circleMarker([lat, lng], {
                    radius: 10,
                    color: 'white',
                    weight: 3,
                    fillColor: color,
                    fillOpacity: 0.9
                }).addTo(map)
                    .bindPopup(`<b>${tree.especie}</b><br>ID: ${tree.id}<br>Risco: ${tree.risco}`).openPopup();
            } else {
                 mapContainer.innerHTML = '<p style="text-align:center; padding:20px; color: #999;">Coordenadas inválidas.</p>';
            }
        } else {
            mapContainer.innerHTML = '<p style="text-align:center; padding:20px; color: #999;">Coordenadas não disponíveis.</p>';
        }
    };

    openReportPreview(reportHTML, mapRenderCallback);
}
