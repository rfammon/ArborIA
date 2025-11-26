// js/pdf.generator.js (v80.0 - Rebranding ArborIA Final)

import * as state from './state.js';
import { getActiveTab } from './state.js';
import { getImageFromDB } from './database.js';
import { showToast } from './utils.js';
import { UI } from './ui.js'; 
import { prepareMapForScreenshot, initializeMap, currentLayerType, toggleMapLayer } from './map.ui.js'; 
import { RISK_LABELS } from './constants.js';

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

    // === CONFIG DA LOGO ===
    // Cole sua string Base64 aqui entre as aspas
    const logoBase64 = ""; 

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let cursorY = 20;

    // === 1. CAPTURA DO MAPA ===
    let mapImageParams = null;
    const mapContainer = document.getElementById('map-container');
    const originalActiveTab = getActiveTab();

    try {
        // Força a navegação para a visualização do mapa para a captura de tela
        UI.navigateTo('calculadora-view');
        document.querySelector('.sub-nav-btn[data-target="tab-content-mapa"]').click();

        // Prepara o mapa para a captura de tela
        await prepareMapForScreenshot();
        
        const canvas = await html2canvas(mapContainer, {
            useCORS: true, scale: 1.5, logging: false, backgroundColor: '#ffffff'
        });
        
        mapImageParams = { data: canvas.toDataURL('image/jpeg', 0.8), w: 180, h: 120 }; 
        
    } catch (e) {
        
    } finally {
        // Restaura a visualização original da UI
        if (originalActiveTab) {
            UI.navigateTo(originalActiveTab);
            // Nota: A restauração da sub-aba (Resumo/Mapa) não é feita para simplificar,
            // mas a navegação principal é restaurada corretamente.
        }
        if (state.mapInstance) state.mapInstance.invalidateSize();
    }

    // === FUNÇÃO DE CABEÇALHO & RODAPÉ ARBORIA ===
    const printHeaderFooter = (isCover) => {
        const pageNum = doc.internal.getCurrentPageInfo().pageNumber;

        // --- CABEÇALHO ---
        // Logo
        if (logoBase64) { 
            try { doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25); } catch(e){} 
        }
        
        const textX = logoBase64 ? 45 : margin; 

        if (isCover) {
            // Capa: Título Grande
            doc.setFontSize(22); doc.setFont(undefined, 'bold');
            
            // Texto colorido "ArborIA"
            doc.setTextColor(10, 50, 137); // Azul Arbor (#0A3289)
            doc.text("Arbor", textX, 22);
            const widthArbor = doc.getTextWidth("Arbor");
            doc.setTextColor(46, 125, 50); // Verde IA (#2E7D32)
            doc.text("IA", textX + widthArbor, 22);

            // Subtítulo
            doc.setFontSize(12); doc.setTextColor(100); doc.setFont(undefined, 'normal');
            doc.text("Sistema de Manejo Integrado Arbóreo", textX, 30);
            
            // Título do Relatório
            doc.setFontSize(16); doc.setTextColor(0, 77, 64); doc.setFont(undefined, 'bold');
            doc.text("Relatório Técnico de Vistoria", textX, 42);

            doc.setLineWidth(0.5); doc.setDrawColor(0, 77, 64);
            doc.line(margin, 48, pageWidth - margin, 48);
            return 60; // Y inicial do conteúdo
        } else {
            // Páginas Seguintes: Cabeçalho Compacto
            doc.setFontSize(12); doc.setFont(undefined, 'bold');
            doc.setTextColor(10, 50, 137); doc.text("Arbor", textX, 20);
            const wArbor = doc.getTextWidth("Arbor");
            doc.setTextColor(46, 125, 50); doc.text("IA", textX + wArbor, 20);

            doc.setFontSize(10); doc.setTextColor(80); doc.setFont(undefined, 'normal');
            doc.text("Relatório de Vistoria", textX, 26);

            doc.setFontSize(9); doc.setTextColor(100);
            doc.text(`Pág. ${pageNum}`, pageWidth - margin, 20, { align: 'right' });
            doc.text(`${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 26, { align: 'right' });

            doc.setLineWidth(0.2); doc.setDrawColor(200);
            doc.line(margin, 32, pageWidth - margin, 32);
            return 40; 
        }
    };
    
    // Função Rodapé (chamada ao final de cada página)
    const printFooter = () => {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8); doc.setTextColor(150);
            doc.text("ArborIA - Soluções em Tecnologia Florestal", pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
    };

    // === 2. INÍCIO DO CONTEÚDO ===
    cursorY = printHeaderFooter(true);

    // Metadados da Capa
    doc.setFontSize(11); doc.setTextColor(50);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, 55);
    doc.text(`Total de Indivíduos: ${state.registeredTrees.length}`, pageWidth-margin, 55, {align:'right'});

    // === 3. TABELA RESUMO ===
    const tableHeaders = [['ID', 'Data', 'Espécie', 'DAP', 'Local', 'Risco', 'Obs']];
    const tableData = state.registeredTrees.map(t => [
        t.id, t.data.split('-').reverse().join('/'), t.especie, 
        t.dap, t.local, t.risco, t.observacoes || '-'
    ]);

    doc.autoTable({
        startY: cursorY, head: tableHeaders, body: tableData, 
        theme: 'striped', 
        headStyles: { fillColor: [0, 121, 107] }, // Verde principal
        styles: { fontSize: 8, cellPadding: 2 }, 
        margin: { left: margin, right: margin },
        columnStyles: { 0: {cellWidth: 10}, 1: {cellWidth: 20}, 2: {cellWidth: 30}, 3: {cellWidth: 12}, 4: {cellWidth: 30}, 5: {cellWidth: 20}, 6: {cellWidth: 'auto'} },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.text[0].includes('Alto')) data.cell.styles.textColor = [198, 40, 40];
                else if (data.cell.text[0].includes('Médio')) data.cell.styles.textColor = [230, 81, 0];
                else data.cell.styles.textColor = [46, 125, 50];
            }
        },
        didDrawPage: function (data) { 
            if (doc.internal.getCurrentPageInfo().pageNumber > 1) printHeaderFooter(false); 
        }
    });
    cursorY = doc.lastAutoTable.finalY + 15;

    // === 4. MAPA ===
    if (mapImageParams) {
        if (cursorY + mapImageParams.h + 25 > pageHeight - 20) { 
            doc.addPage(); cursorY = printHeaderFooter(false); 
        }
        
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
    cursorY = printHeaderFooter(false);
    doc.setFontSize(14); doc.setTextColor(0, 77, 64); doc.setFont(undefined, 'bold');
    doc.text("Detalhamento Técnico Individual", margin, cursorY);
    cursorY += 10;

    for (let i = 0; i < state.registeredTrees.length; i++) {
        const tree = state.registeredTrees[i];
        
        // Métricas
        const alturaNum = parseFloat(tree.altura) || 0;
        const dapNum = parseFloat(tree.dap) || 0;
        const dapM = dapNum / 100;
        const rcq = (alturaNum * 1.5).toFixed(1); 
        const rcr = (dapM * 1.5).toFixed(1);       
        
        let bgColor, riskColor;
        if (tree.risco === 'Alto Risco') { bgColor = [255, 235, 238]; riskColor = [198, 40, 40]; }
        else if (tree.risco === 'Médio Risco') { bgColor = [255, 243, 224]; riskColor = [230, 81, 0]; }
        else { bgColor = [232, 245, 233]; riskColor = [46, 125, 50]; }

        const risksList = (tree.riskFactors || []).map((val, idx) => val === 1 ? RISK_LABELS[idx] : null).filter(v => v !== null);
        
        // Cálculo de Altura da Caixa (CORRIGIDO COM VARIÁVEL FINAL)
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
            cursorY = printHeaderFooter(false);
        }

        const finalBoxHeight = boxHeight; // Variável segura

        // Desenho Caixa
        doc.setDrawColor(200); doc.setFillColor(...bgColor);
        doc.rect(margin, cursorY, pageWidth - (margin*2), finalBoxHeight, 'FD');
        doc.setFillColor(...riskColor); doc.rect(margin, cursorY, 2, finalBoxHeight, 'F');

        // Cabeçalho Card
        doc.setFontSize(11); doc.setTextColor(0); doc.setFont(undefined, 'bold');
        doc.text(`ID: ${tree.id} - ${tree.especie}`, margin + 6, cursorY + 8);
        doc.setTextColor(...riskColor);
        doc.text(tree.risco.toUpperCase(), pageWidth - margin - 5, cursorY + 8, { align: 'right' });

        // Coluna Esquerda
        doc.setTextColor(50); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
        const col1X = margin + 6; let lineY = cursorY + 16;
        
        doc.setFont(undefined, 'bold'); doc.text(`Altura: ${alturaNum.toFixed(1)} m`, col1X, lineY);
        doc.text(`DAP: ${tree.dap} cm`, col1X + 40, lineY); lineY += 5;
        doc.text(`Raio Queda (RCQ): ${rcq} m`, col1X, lineY);
        doc.text(`Raio Radicular (RCR): ${rcr} m`, col1X + 40, lineY); lineY += 7;

        doc.setFont(undefined, 'normal'); doc.text(`Local: ${tree.local}`, col1X, lineY); lineY += 5;
        doc.text(`Coord: ${tree.coordX} / ${tree.coordY}`, col1X, lineY);
        doc.text(`Zona: ${tree.utmZoneNum}${tree.utmZoneLetter}`, col1X + 60, lineY); lineY += 8;

        doc.setFont(undefined, 'bold'); doc.setTextColor(0);
        doc.text("Fatores de Risco:", col1X, lineY); doc.setFont(undefined, 'normal'); doc.setTextColor(50); lineY += 5;
        if (risksList.length > 0) { risksList.forEach(risk => { doc.text(`• ${risk}`, col1X, lineY); lineY += 5; }); } 
        else { doc.text("• Nenhum fator crítico.", col1X, lineY); }

        // Coluna Direita
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
            } catch (e) { }
        }
        doc.setFont(undefined, 'bold'); doc.setTextColor(0);
        doc.text("Observações:", rightColX, contentY); doc.setFont(undefined, 'normal'); doc.setTextColor(50); contentY += 5;
        doc.text(obsLines, rightColX, contentY);

        cursorY += finalBoxHeight + 8; 
    }

    // Imprime rodapés em todas as páginas no final
    printFooter();

    const filename = `Relatorio_ArborIA_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    showToast("PDF Gerado com Sucesso!", "success");
}

/**
 * [NOVO] Gera um laudo PDF individual para uma árvore específica.
 */
export async function generateSingleTreePDF(tree) {
    if (!tree) return;

    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast("Erro: Biblioteca PDF não carregada.", "error");
        return;
    }

    showToast(`Gerando laudo para ${tree.especie}...`, "info");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let cursorY = 20;

    // --- CABEÇALHO ---
    doc.setFontSize(18); doc.setTextColor(0, 77, 64); doc.setFont(undefined, 'bold');
    doc.text("Ficha Técnica de Indivíduo Arbóreo", pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;
    
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} • Sistema ArborIA`, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 15;

    doc.setLineWidth(0.5); doc.setDrawColor(0, 77, 64);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 15;

    // --- DADOS PRINCIPAIS ---
    doc.setFontSize(14); doc.setTextColor(0); doc.setFont(undefined, 'bold');
    doc.text(`ID ${tree.id}: ${tree.especie}`, margin, cursorY);
    
    // Badge de Risco no PDF
    let riskColor = [46, 125, 50]; // Verde
    if (tree.risco === 'Alto Risco') riskColor = [198, 40, 40];
    else if (tree.risco === 'Médio Risco') riskColor = [230, 81, 0];
    
    doc.setTextColor(...riskColor);
    doc.text(tree.risco.toUpperCase(), pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 15;

    // --- GRID DE DADOS ---
    doc.setFontSize(11); doc.setTextColor(50); doc.setFont(undefined, 'normal');
    const col1 = margin;
    const col2 = pageWidth / 2 + 10;
    const lineHeight = 8;

    const addField = (label, value, x, y) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, x, y);
        doc.setFont(undefined, 'normal');
        doc.text(`${value}`, x + doc.getTextWidth(`${label}: `), y);
    };

    addField("Data", tree.data.split('-').reverse().join('/'), col1, cursorY);
    addField("Avaliador", tree.avaliador, col2, cursorY); cursorY += lineHeight;

    addField("Local", tree.local, col1, cursorY);
    addField("Coordenadas", `${tree.coordX} / ${tree.coordY}`, col2, cursorY); cursorY += lineHeight;

    addField("Altura", `${tree.altura} m`, col1, cursorY);
    addField("DAP", `${tree.dap} cm`, col2, cursorY); cursorY += lineHeight;

    cursorY += 5;

    // --- OBSERVAÇÕES ---
    doc.setFillColor(245, 245, 245); doc.rect(margin, cursorY, pageWidth - (margin*2), 25, 'F');
    doc.setFont(undefined, 'bold'); doc.text("Observações de Campo:", margin + 5, cursorY + 8);
    doc.setFont(undefined, 'normal'); doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(tree.observacoes || "Sem observações.", pageWidth - (margin*2) - 10);
    doc.text(obsLines, margin + 5, cursorY + 16);
    cursorY += 35;

    // --- FATORES DE RISCO ---
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(0);
    doc.text("Fatores de Risco Identificados", margin, cursorY); cursorY += 8;
    
    const activeRisks = (tree.riskFactors || []).map((val, idx) => val === 1 ? RISK_LABELS[idx] : null).filter(Boolean);
    
    if (activeRisks.length > 0) {
        doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(50);
        activeRisks.forEach(risk => {
            doc.text(`• ${risk}`, margin + 5, cursorY);
            cursorY += 6;
        });
    } else {
        doc.setFont(undefined, 'italic'); doc.setTextColor(100);
        doc.text("Nenhum fator de risco crítico assinalado.", margin + 5, cursorY);
        cursorY += 6;
    }
    cursorY += 10;

    // --- FOTO (SE HOUVER) ---
    if (tree.hasPhoto) {
        try {
            const imageBlob = await new Promise(resolve => getImageFromDB(tree.id, resolve));
            if (imageBlob) {
                const imgData = await blobToDataURL(imageBlob);
                const imgFormat = imageBlob.type === 'image/png' ? 'PNG' : 'JPEG';
                
                // Verifica espaço restante
                if (cursorY + 100 > doc.internal.pageSize.getHeight()) {
                    doc.addPage(); cursorY = 20;
                }
                
                doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(0);
                doc.text("Registro Fotográfico", margin, cursorY); cursorY += 10;
                
                // Centraliza imagem
                const imgW = 120;
                const imgH = 90;
                const imgX = (pageWidth - imgW) / 2;
                doc.addImage(imgData, imgFormat, imgX, cursorY, imgW, imgH);
            }
        } catch (e) {
            
        }
    }

    // Salva
    const safeName = tree.especie.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Laudo_${tree.id}_${safeName}.pdf`);
    showToast("Laudo Individual Baixado!", "success");
}
