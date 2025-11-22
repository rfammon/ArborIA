// js/pdf.generator.js (v82.0 - Professional Redesign)

import * as state from './state.js';
import { getImageFromDB } from './database.js';
import { showToast } from './utils.js';

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

const getLogoBase64 = () => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = 'img/icons/icon-512x512.png'; // Caminho para o logo profissional
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            console.error("Erro ao carregar o logo.");
            resolve(null); 
        };
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

    showToast("Iniciando geração do laudo...", "success");

    const logoBase64 = await getLogoBase64();
    
    const COLORS = {
        primary: [0, 100, 80],       // Verde escuro para títulos e destaques
        secondary: [39, 174, 96],    // Verde mais claro para sub-elementos
        text: [52, 73, 94],          // Cinza escuro para corpo de texto
        textLight: [149, 165, 166],  // Cinza claro para detalhes
        border: [236, 240, 241],     // Cinza muito claro para bordas
        riskHigh: [192, 57, 43],     // Vermelho para risco alto
        riskMedium: [243, 156, 18],  // Laranja para risco médio
        riskLow: [39, 174, 96],      // Verde para risco baixo
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let cursorY = 0;

    let mapImageParams = null;
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        try {
            const canvas = await html2canvas(mapContainer, { useCORS: true, scale: 2.5, logging: false, backgroundColor: '#ffffff' });
            mapImageParams = { data: canvas.toDataURL('image/jpeg', 0.8), w: pageWidth - margin * 2, h: 110 };
        } catch (e) {
            console.error("Erro ao renderizar mapa para PDF:", e);
        }
    }

    const printHeaderFooter = (pageNumber) => {
        // Cabeçalho
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', margin, 8, 18, 18);
            } catch (e) {
                 console.error("Erro ao adicionar o logo:", e);
            }
        }
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...COLORS.primary);
        doc.text("Laudo de Vistoria de Risco Arbóreo", margin + 25, 19);

        doc.setDrawColor(...COLORS.primary);
        doc.setLineWidth(0.6);
        doc.line(margin, 28, pageWidth - margin, 28);

        // Rodapé
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...COLORS.textLight);
        doc.text(`Página ${pageNumber} de ${doc.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, pageHeight - 12);
        doc.text("ArborIA Tech", pageWidth - margin, pageHeight - 12, { align: 'right' });
    };

    // --- PÁGINA 1: CAPA ---
    cursorY = 45;
    doc.setFontSize(26); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.text);
    doc.text("LAUDO TÉCNICO DE AVALIAÇÃO", pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;
    doc.text("DE RISCO EM ÁRVORES", pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 15;
    doc.setFontSize(11); doc.setFont(undefined, 'italic'); doc.setTextColor(...COLORS.textLight);
    doc.text("Em conformidade com as boas práticas de manejo e a legislação vigente.", pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 25;

    doc.autoTable({
        startY: cursorY,
        body: [
            ['Responsável Técnico:', '_________________________', 'Nº de Árvores:', state.registeredTrees.length],
            ['Local da Vistoria:', '_________________________', 'Cliente:', '_________________________'],
        ],
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 4, textColor: COLORS.text },
        headStyles: { fillColor: COLORS.primary },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
    });
    cursorY = doc.lastAutoTable.finalY + 12;

    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.primary);
    doc.text("Resumo do Inventário Arbóreo", margin, cursorY);
    cursorY += 8;
    
    const tableHeaders = [['ID', 'Espécie', 'DAP (cm)', 'Geolocalização', 'Risco']];
    const tableData = state.registeredTrees.map(t => [t.id, t.especie, t.dap, `${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}`, t.risco]);
    doc.autoTable({
        startY: cursorY, head: tableHeaders, body: tableData,
        theme: 'grid',
        headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5, lineWidth: 0.1, lineColor: COLORS.border },
        columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 40 } },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
                if (data.cell.text[0].includes('Alto')) data.cell.styles.textColor = COLORS.riskHigh;
                else if (data.cell.text[0].includes('Médio')) data.cell.styles.textColor = COLORS.riskMedium;
                else data.cell.styles.textColor = COLORS.riskLow;
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // --- PÁGINA 2: MAPA ---
    if (mapImageParams) {
        doc.addPage();
        cursorY = 40;
        doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.primary);
        doc.text("Mapa de Localização das Árvores", margin, cursorY);
        cursorY += 10;
        doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.4);
        doc.rect(margin, cursorY, mapImageParams.w, mapImageParams.h, 'S');
        doc.addImage(mapImageParams.data, 'JPEG', margin, cursorY, mapImageParams.w, mapImageParams.h);
    }

    // --- FICHAS INDIVIDUAIS ---
    for (const tree of state.registeredTrees) {
        doc.addPage();
        cursorY = 40;

        // Título da Ficha
        doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.primary);
        doc.text(`Ficha de Avaliação Individual: Árvore ID ${tree.id}`, margin, cursorY);
        cursorY += 8;
        
        // Espécie e Risco
        let riskColor = tree.risco === 'Alto Risco' ? COLORS.riskHigh : tree.risco === 'Médio Risco' ? COLORS.riskMedium : COLORS.riskLow;
        doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(...riskColor);
        doc.text(tree.especie, margin, cursorY);
        cursorY += 12;

        const col1X = margin;
        const col2X = margin + 100;
        let lineY = cursorY;

        // Foto da árvore
        if (tree.hasPhoto) {
            try {
                const imageBlob = await new Promise(resolve => getImageFromDB(tree.id, resolve));
                if (imageBlob) {
                    const imgData = await blobToDataURL(imageBlob);
                    doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.2);
                    doc.rect(col2X - 5, lineY, 90, 90, 'S');
                    doc.addImage(imgData, 'JPEG', col2X - 5, lineY, 90, 90);
                }
            } catch (e) { console.warn("Não foi possível carregar a foto da árvore.", e); }
        }

        // Dados técnicos
        doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.text);
        doc.text("DADOS TÉCNICOS", col1X, lineY); lineY += 7;
        doc.setFont(undefined, 'normal'); doc.setTextColor(...COLORS.textLight);
        const techData = [
            `Data da Vistoria: ${tree.data.split('-').reverse().join('/')}`,
            `Local: ${tree.local}`,
            `Avaliador: ${tree.avaliador}`,
            `DAP (Diâmetro): ${tree.dap} cm`,
            `Altura Estimada: ${tree.altura} m`
        ];
        techData.forEach(item => { doc.text(item, col1X, lineY); lineY += 6; });
        lineY += 5;
        
        // Fatores de Risco
        doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.text);
        doc.text("FATORES DE RISCO IDENTIFICADOS", col1X, lineY); lineY += 7;
        doc.setFont(undefined, 'normal'); doc.setTextColor(...COLORS.textLight);
        const risksList = (tree.riskFactors || []).map((val, idx) => val === 1 ? RISK_LABELS[idx] : null).filter(Boolean);
        if (risksList.length > 0) {
            risksList.forEach(risk => { doc.text(`• ${risk}`, col1X + 2, lineY); lineY += 5; });
        } else {
            doc.text("Nenhum fator de risco crítico identificado.", col1X, lineY); lineY += 5;
        }

        let obsY = Math.max(lineY, (tree.hasPhoto ? cursorY + 95 : cursorY)); // Garante que observações comecem abaixo da foto
        doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.setTextColor(...COLORS.text);
        doc.text("OBSERVAÇÕES E RECOMENDAÇÕES", margin, obsY); obsY += 7;
        doc.setFont(undefined, 'normal'); doc.setTextColor(...COLORS.textLight);
        const obsWidth = pageWidth - margin * 2;
        const obsLines = doc.splitTextToSize(tree.observacoes || 'Nenhuma observação ou recomendação adicional registrada.', obsWidth);
        doc.text(obsLines, margin, obsY);
    }
    
    // Adicionar numeração de página total no final
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        printHeaderFooter(i, totalPages);
    }
    
    const filename = `Laudo_ArborIA_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    showToast("Laudo gerado com sucesso!", "success");
}
