// js/pdf.generator.js (v52.0 - Final Corrigido)

import * as state from './state.js';
import { getImageFromDB } from './database.js';
import { showToast } from './utils.js';
import { prepareMapForScreenshot, initializeMap } from './map.ui.js'; 
import { checklistData } from './content.js'; 

const RISK_LABELS = [
    "1. Galhos Mortos > 5cm", "2. Rachaduras/Fendas", "3. Sinais de Apodrecimento",
    "4. Casca Inclusa (União em V)", "5. Galhos Cruzados", "6. Copa Assimétrica",
    "7. Inclinação Anormal", "8. Próxima a Vias Públicas", "9. Risco de Queda sobre Alvos",
    "10. Interferência em Redes", "11. Espécie com Histórico de Falhas", "12. Poda Drástica/Brotação",
    "13. Calçadas Rachadas", "14. Perda de Raízes", "15. Compactação/Asfixia", "16. Apodrecimento Raízes"
];

const blobToDataURL = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export async function generatePDF() {
    if (state.registeredTrees.length === 0) {
        showToast("Sem dados para gerar relatório.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    if (!jsPDF || !window.html2canvas) {
        showToast("Bibliotecas PDF não carregadas.", "error");
        return;
    }

    showToast("Preparando mapa e gerando PDF...", "success");

    // COLE SUA BASE64 DA LOGO AQUI
    const logoBase64 = ""; 

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let cursorY = 20;

    // === 1. CAPTURA DO MAPA (Configuração de Abas e Estados) ===
    let mapImageParams = null;
    const mapTabContent = document.getElementById('tab-content-mapa');
    const summaryTabContent = document.getElementById('tab-content-summary');
    const mapContainer = document.getElementById('map-container');
    
    const originalWidth = mapContainer.style.width;
    const originalHeight = mapContainer.style.height;
    let wasSummaryActive = false;
    let originalLayerType = 'satellite';

    try {
        if (mapTabContent && summaryTabContent) {
            wasSummaryActive = summaryTabContent.classList.contains('active');
            originalLayerType = window.currentLayerType || 'satellite'; 

            summaryTabContent.classList.remove('active');
            summaryTabContent.style.display = 'none';
            mapTabContent.classList.add('active');
            mapTabContent.style.display = 'block'; 
        }
        
        mapContainer.style.width = "800px";
        mapContainer.style.height = "600px";

        initializeMap();
        await prepareMapForScreenshot();
        
        const canvas = await html2canvas(mapContainer, {
            useCORS: true, scale: 1.5, logging: false, backgroundColor: '#ffffff'
        });
        
        mapImageParams = { data: canvas.toDataURL('image/jpeg', 0.8), w: 180, h: 120 }; 
        
    } catch (e) {
        console.error("Erro ao capturar mapa:", e);
        showToast("Aviso: O mapa não pôde ser gerado.", "warning");
    } finally {
        mapContainer.style.width = originalWidth;
        mapContainer.style.height = originalHeight;

        // Restaura estados (Abas e Camada)
        if (mapTabContent && summaryTabContent) {
            mapTabContent.style.display = ''; summaryTabContent.style.display = '';
            if (wasSummaryActive) { summaryTabContent.classList.add('active'); mapTabContent.classList.remove('active'); }
            
            if (originalLayerType !== 'satellite' && window.toggleMapLayer) { 
                 window.toggleMapLayer(); 
            }
        }
        if (window.mapInstance) window.mapInstance.invalidateSize();
    }

    // === CABEÇALHO RECORRENTE ===
    const printHeader = (isCover) => {
        if (logoBase64) { try { doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25); } catch(e){} }
        const textX = logoBase64 ? 45 : pageWidth/2;
        const align = logoBase64 ? "left" : "center";

        if (isCover) {
            doc.setFontSize(16); doc.setTextColor(0, 77, 64); doc.text("RAFAEL AMMON", textX, 18, { align: align });
            doc.setFontSize(10); doc.setTextColor(100); doc.text("ENGENHEIRO FLORESTAL", textX, 24, { align: align });
            doc.setFontSize(14); doc.setTextColor(0); doc.text("Relatório Técnico de Avaliação Arbórea", textX, 32, { align: align });
            doc.setLineWidth(0.5); doc.setDrawColor(0, 77, 64); doc.line(margin, 38, pageWidth - margin, 38);
            return 55;
        } else {
            doc.setFontSize(12); doc.setTextColor(0, 77, 64); doc.text("Relatório Técnico de Avaliação Arbórea", textX, 25, { align: align });
            doc.setFontSize(9); doc.setTextColor(100); doc.text(`Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - margin, 25, { align: 'right' });
            doc.setLineWidth(0.2); doc.setDrawColor(0, 77, 64); doc.line(margin, 40, pageWidth - margin, 40);
            return 50; 
        }
    };

    // === 2. INÍCIO DO PDF ===
    cursorY = printHeader(true);

    doc.setFontSize(11); doc.setTextColor(50);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, margin, 45);
    doc.text(`Total Avaliado: ${state.registeredTrees.length} árvores`, pageWidth-margin, 45, {align:'right'});

    // === 3. TABELA RESUMO ===
    const tableHeaders = [['ID', 'Data', 'Espécie', 'DAP', 'Altura', 'Local', 'Risco']];
    const tableData = state.registeredTrees.map(t => [
        t.id, t.data.split('-').reverse().join('/'), t.especie, 
        t.dap, t.altura || '-', 
        t.local, t.risco
    ]);

    doc.autoTable({
        startY: cursorY, head: tableHeaders, body: tableData, theme: 'striped', headStyles: { fillColor: [0, 121, 107] },
        styles: { fontSize: 8, cellPadding: 2 }, margin: { left: margin, right: margin },
        columnStyles: { 0: {cellWidth: 10}, 1: {cellWidth: 20}, 2: {cellWidth: 30}, 3: {cellWidth: 12}, 4: {cellWidth: 12}, 5: {cellWidth: 30}, 6: {cellWidth: 'auto'} },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.text[0].includes('Alto')) data.cell.styles.textColor = [198, 40, 40];
                else if (data.cell.text[0].includes('Médio')) data.cell.styles.textColor = [230, 81, 0];
                else data.cell.styles.textColor = [46, 125, 50];
            }
        },
        didDrawPage: function (data) { if (doc.internal.getCurrentPageInfo().pageNumber > 1) printHeader(false); }
    });
    cursorY = doc.lastAutoTable.finalY + 15;

    // === 4. MAPA ===
    if (mapImageParams) {
        if (cursorY + mapImageParams.h + 25 > pageHeight - 20) { doc.addPage(); cursorY = printHeader(false); }
        
        doc.setFontSize(12); doc.setTextColor(0); doc.setFont(undefined, 'bold');
        doc.text("Mapa de Localização (Satélite)", margin, cursorY);
        cursorY += 5;
        
        const mapX = (pageWidth - mapImageParams.w) / 2;
        doc.addImage(mapImageParams.data, 'PNG', mapX, cursorY, mapImageParams.w, mapImageParams.h);
        cursorY += mapImageParams.h + 5;
        
        // Legenda
        doc.setFontSize(9); doc.setFont(undefined, 'normal');
        let lx = mapX; const dSz = 2; const spc = 25;
        doc.setFillColor(198, 40, 40); doc.circle(lx+dSz, cursorY+dSz, dSz, 'F'); doc.setTextColor(0); doc.text("Alto Risco", lx+6, cursorY+dSz+1); lx += spc + 10;
        doc.setFillColor(230, 81, 0); doc.circle(lx+dSz, cursorY+dSz, dSz, 'F'); doc.text("Médio Risco", lx+6, cursorY+dSz+1); lx += spc + 15;
        doc.setFillColor(46, 125, 50); doc.circle(lx+dSz, cursorY+dSz, dSz, 'F'); doc.text("Baixo Risco", lx+6, cursorY+dSz+1);
        cursorY += 15;
    }

    // === 5. FICHAS INDIVIDUAIS ===
    doc.addPage();
    cursorY = printHeader(false);
    doc.setFontSize(14); doc.setTextColor(0, 77, 64); doc.setFont(undefined, 'bold');
    doc.text("Detalhamento Técnico Individual", margin, cursorY);
    cursorY += 10;

    for (let i = 0; i < state.registeredTrees.length; i++) {
        const tree = state.registeredTrees[i];
        
        // CÁLCULO DAS MÉTRICAS DE SEGURANÇA
        const alturaNum = parseFloat(tree.altura) || 0;
        const dapNum = parseFloat(tree.dap) || 0;
        const dapM = dapNum / 100;
        const rcq = (alturaNum * 1.5).toFixed(1); 
        const rcr = (dapM * 1.5).toFixed(1);       
        
        // Cores
        let bgColor, riskColor;
        if (tree.risco === 'Alto Risco') { bgColor = [255, 235, 238]; riskColor = [198, 40, 40]; }
        else if (tree.risco === 'Médio Risco') { bgColor = [255, 243, 224]; riskColor = [230, 81, 0]; }
        else { bgColor = [232, 245, 233]; riskColor = [46, 125, 50]; }

        // Fatores de Risco
        const risksList = tree.riskFactors.map((val, idx) => val === 1 ? RISK_LABELS[idx] : null).filter(v => v !== null);
        
        // Cálculo de Altura da Caixa
        const rightColX = margin + 85; 
        const obsWidth = pageWidth - rightColX - margin - 2; 
        const obsLines = doc.splitTextToSize(tree.observacoes || '—', obsWidth);
        
        const risksHeight = risksList.length * 5;
        const dataLines = 4 * 5; 
        
        const leftHeight = dataLines + risksHeight + 20; 
        
        let rightHeight = 20 + 10 + (obsLines.length * 4) + 10;
        if (tree.hasPhoto) rightHeight += 50; 

        const boxHeight = Math.max(leftHeight, rightHeight, 60) + 5;

        // Quebra de página
        if (cursorY + boxHeight + 10 > pageHeight - 10) {
            doc.addPage();
            cursorY = printHeader(false);
        }

        // Desenha Caixa
        const finalBoxHeight = boxHeight; // [FIX] Variável local definida para uso abaixo
        doc.setDrawColor(200); doc.setFillColor(...bgColor);
        doc.rect(margin, cursorY, pageWidth - (margin*2), finalBoxHeight, 'FD');
        doc.setFillColor(...riskColor); doc.rect(margin, cursorY, 2, finalBoxHeight, 'F');

        // Conteúdo Card
        doc.setFontSize(11); doc.setTextColor(0); doc.setFont(undefined, 'bold');
        doc.text(`ID: ${tree.id} - ${tree.especie}`, margin + 6, cursorY + 8);
        doc.setTextColor(...riskColor);
        doc.text(tree.risco.toUpperCase(), pageWidth - margin - 5, cursorY + 8, { align: 'right' });

        // COLUNA ESQUERDA (Dados Métricos)
        doc.setTextColor(50); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
        const col1X = margin + 6;
        let lineY = cursorY + 16;
        
        doc.text(`Altura: ${alturaNum.toFixed(1)} m`, col1X, lineY);
        doc.text(`DAP: ${tree.dap} cm`, col1X + 40, lineY);
        lineY += 5;
        
        doc.text(`Raio Queda (RCQ): ${rcq} m`, col1X, lineY);
        doc.text(`Raio Radicular (RCR): ${rcr} m`, col1X + 40, lineY);
        lineY += 7;

        doc.setFont(undefined, 'normal'); doc.text(`Local: ${tree.local}`, col1X, lineY);
        lineY += 5;
        doc.text(`Coord: ${tree.coordX} / ${tree.coordY}`, col1X, lineY);
        doc.text(`Zona: ${tree.utmZoneNum}${tree.utmZoneLetter}`, col1X + 60, lineY);
        lineY += 8;


        // Fatores de Risco
        doc.setFont(undefined, 'bold'); doc.setTextColor(0);
        doc.text("Fatores de Risco:", col1X, lineY);
        doc.setFont(undefined, 'normal'); doc.setTextColor(50);
        lineY += 5;
        
        if (risksList.length > 0) {
            risksList.forEach(risk => { doc.text(`• ${risk}`, col1X, lineY); lineY += 5; });
        } else { doc.text("• Nenhum fator crítico.", col1X, lineY); }


        // COLUNA DIREITA (Observações e Foto)
        let contentY = cursorY + 16;
        
        if (tree.hasPhoto) {
            try {
                const imageBlob = await new Promise(resolve => getImageFromDB(tree.id, resolve));
                if (imageBlob) {
                    const imgData = await blobToDataURL(imageBlob);
                    const imgFormat = imageBlob.type === 'image/png' ? 'PNG' : 'JPEG';
                    doc.addImage(imgData, imgFormat, pageWidth - margin - 48, contentY - 4, 45, 45);
                    contentY += 50;
                }
            } catch (e) { console.warn(e); }
        }

        doc.setFont(undefined, 'bold'); doc.setTextColor(0);
        doc.text("Observações:", rightColX, contentY);
        doc.setFont(undefined, 'normal'); doc.setTextColor(50);
        contentY += 5;
        doc.text(obsLines, rightColX, contentY);

        cursorY += finalBoxHeight + 8; 
    }

    const filename = `Relatorio_Arboreo_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    showToast("PDF Gerado com Sucesso!", "success");
}
