// js/pdf.generator.js (v5.0 - Rebranding ArborIA)

// Assume que window.jsPDF e window.html2canvas já estão carregados via <script> tags no index.html

/**
 * Gera um relatório PDF a partir dos dados das árvores cadastradas.
 * @param {Array<Object>} treeData Array de objetos de árvores.
 * @param {Array<Object>} glossaryData Array de objetos do glossário para tooltips.
 */
export async function generatePDF(treeData, glossaryData) {
    if (!treeData || treeData.length === 0) {
        showToast("Nenhuma árvore cadastrada para gerar o PDF.", "warning");
        return;
    }

    const doc = new window.jsPDF.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yOffset = margin;

    // --- Paleta de Cores ArborIA para o PDF ---
    const arborBlue = '#0A3289'; // Cor para 'Arbor'
    const iaGreen = '#2E7D32';   // Cor para 'IA'
    const primaryDark = '#004d40'; // Títulos
    const accentColor = '#ffb300'; // Destaques (se necessário)
    const grayText = '#555555';    // Texto geral
    const lightGray = '#dddddd';  // Linhas de tabela

    // Função para adicionar cabeçalho e rodapé em cada página
    const addHeaderFooter = (pageNumber) => {
        // --- CABEÇALHO ---
        // Logo ArborIA (garanta que img/icons/favicon.png exista e seja PNG)
        try {
            // A imagem precisa estar em Base64 ou um caminho acessível pelo navegador
            // No Node.js ou em um ambiente de build, você pode pré-processar.
            // Para o navegador, um caminho relativo direto pode funcionar se o servidor web o servir.
            doc.addImage('img/icons/favicon.png', 'PNG', 15, 10, 20, 20); // x, y, width, height
        } catch (e) {
            console.warn("Não foi possível carregar a imagem da logo para o PDF.", e);
            // Fallback para texto se a imagem falhar
            doc.setFontSize(10);
            doc.setTextColor(primaryDark);
            doc.text("ArborIA", 15, 15);
        }

        // Título estilizado "ArborIA"
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(arborBlue);
        doc.text("Arbor", 40, 25);
        doc.setTextColor(iaGreen);
        doc.text("IA", doc.getStringUnitWidth("Arbor", { font: 'helvetica', fontStyle: 'bold', fontSize: 22 }) * doc.internal.scaleFactor + 40, 25);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(grayText);
        doc.text("Sistema de Manejo Integrado Arbóreo", 40, 30);
        
        // Data e Hora
        doc.setFontSize(9);
        doc.setTextColor(grayText);
        const now = new Date();
        doc.text(`Gerado em: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, pageWidth - margin, 15, { align: 'right' });
        doc.text(`Página ${pageNumber} de ${doc.internal.getNumberOfPages()}`, pageWidth - margin, 20, { align: 'right' });

        // Linha divisória
        doc.setDrawColor(primaryDark);
        doc.setLineWidth(0.5);
        doc.line(margin, 35, pageWidth - margin, 35);


        // --- RODAPÉ ---
        doc.setFontSize(9);
        doc.setTextColor(grayText);
        doc.text("ArborIA - Soluções em Tecnologia Florestal", pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // Adiciona a primeira página (vazia para o header/footer serem adicionados depois)
    doc.addPage(); 
    doc.deletePage(1); // Remove a página em branco inicial

    for (const [index, tree] of treeData.entries()) {
        if (yOffset > pageHeight - margin - 80) { // Verifica espaço para adicionar nova árvore
            doc.addPage();
            yOffset = margin;
        }
        
        doc.addPage(); // Adiciona uma nova página para cada árvore para melhor organização
        yOffset = margin + 30; // Ajusta yOffset para o conteúdo começar abaixo do cabeçalho

        addHeaderFooter(doc.internal.getNumberOfPages()); // Adiciona header/footer à nova página

        // --- TÍTULO DA ÁRVORE ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(primaryDark);
        doc.text(`Árvore #${index + 1}: ${tree.especie || 'Não Identificada'}`, margin, yOffset);
        yOffset += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(grayText);

        // --- INFORMAÇÕES GERAIS ---
        doc.text(`Local: ${tree.local || 'N/A'}`, margin, yOffset);
        doc.text(`Data da Coleta: ${tree.data || 'N/A'}`, pageWidth / 2, yOffset);
        yOffset += 7;
        doc.text(`Avaliador: ${tree.avaliador || 'N/A'}`, margin, yOffset);
        doc.text(`Altura: ${tree.altura || 'N/A'}m`, pageWidth / 2, yOffset);
        yOffset += 7;
        doc.text(`DAP: ${tree.dap || 'N/A'}cm`, margin, yOffset);
        doc.text(`Coordenadas: ${tree.coordX || 'N/A'}, ${tree.coordY || 'N/A'}`, pageWidth / 2, yOffset);
        yOffset += 10;
        
        doc.setDrawColor(lightGray);
        doc.setLineWidth(0.2);
        doc.line(margin, yOffset, pageWidth - margin, yOffset);
        yOffset += 5;

        // --- OBSERVAÇÕES ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryDark);
        doc.text('Observações:', margin, yOffset);
        yOffset += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(grayText);
        const obsLines = doc.splitTextToSize(tree.obs || 'Nenhuma observação.', pageWidth - 2 * margin);
        doc.text(obsLines, margin, yOffset);
        yOffset += (obsLines.length * 5) + 5; // Ajusta yOffset com base no número de linhas

        // --- FOTO DA ÁRVORE ---
        if (tree.photo) {
            if (yOffset > pageHeight - margin - 70) { // Verifica se há espaço para a foto
                doc.addPage();
                yOffset = margin + 30;
                addHeaderFooter(doc.internal.getNumberOfPages());
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(primaryDark);
            doc.text('Foto:', margin, yOffset);
            yOffset += 5;

            try {
                const img = new Image();
                img.src = tree.photo;
                await new Promise((resolve) => { img.onload = resolve; });

                const imgWidth = img.width;
                const imgHeight = img.height;
                const maxWidth = pageWidth - 2 * margin;
                const maxHeight = 80; // Altura máxima para a imagem no PDF

                let finalWidth = imgWidth;
                let finalHeight = imgHeight;

                if (imgWidth > maxWidth) {
                    finalWidth = maxWidth;
                    finalHeight = (imgHeight * maxWidth) / imgWidth;
                }
                if (finalHeight > maxHeight) {
                    finalHeight = maxHeight;
                    finalWidth = (imgWidth * maxHeight) / imgHeight;
                }
                
                // Centraliza a imagem
                const imgX = margin + (maxWidth - finalWidth) / 2;

                doc.addImage(tree.photo, 'JPEG', imgX, yOffset, finalWidth, finalHeight);
                yOffset += finalHeight + 10;

            } catch (e) {
                console.warn("Erro ao adicionar foto ao PDF:", e);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(grayText);
                doc.text("Erro ao carregar imagem.", margin, yOffset);
                yOffset += 10;
            }
        }
        
        // --- RESULTADO DO RISCO ---
        if (yOffset > pageHeight - margin - 70) { // Verifica se há espaço para o risco
            doc.addPage();
            yOffset = margin + 30;
            addHeaderFooter(doc.internal.getNumberOfPages());
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryDark);
        doc.text('Avaliação de Risco:', margin, yOffset);
        yOffset += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(grayText);
        doc.text(`Risco Total: ${tree.riskScore || '0'} pontos`, margin, yOffset);
        const riskLevelText = `Nível de Risco: ${tree.riskLevel || 'N/A'}`;
        const riskColor = getRiskColor(tree.riskLevel);
        
        doc.setTextColor(riskColor);
        doc.text(riskLevelText, pageWidth / 2, yOffset);
        yOffset += 10;
        
        doc.setTextColor(grayText); // Volta à cor padrão para o resto do texto
        
        // --- TABELA DE ITENS DE VERIFICAÇÃO ---
        const checklistColumns = [
            { header: 'Nº', dataKey: 'num', width: 10 },
            { header: 'Item de Verificação', dataKey: 'pergunta', width: 100 },
            { header: 'Peso', dataKey: 'peso', width: 15 },
            { header: 'Sim', dataKey: 'sim', width: 15 }
        ];

        const checklistRows = tree.checklist.map((item, i) => ({
            num: i + 1,
            pergunta: item.pergunta,
            peso: item.peso,
            sim: item.sim ? '✔' : ''
        }));

        doc.autoTable({
            startY: yOffset,
            head: [checklistColumns.map(col => col.header)],
            body: checklistRows.map(row => checklistColumns.map(col => row[col.dataKey])),
            styles: {
                fontSize: 8,
                cellPadding: 2,
                textColor: grayText,
                lineColor: lightGray,
                lineWidth: 0.1,
                overflow: 'linebreak',
            },
            headStyles: {
                fillColor: primaryDark,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
            },
            bodyStyles: {
                halign: 'center',
                valign: 'middle',
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: checklistColumns[0].width },
                1: { halign: 'left', cellWidth: checklistColumns[1].width },
                2: { halign: 'center', cellWidth: checklistColumns[2].width },
                3: { halign: 'center', cellWidth: checklistColumns[3].width },
            },
            didDrawPage: (data) => {
                // Adiciona cabeçalho e rodapé em páginas subsequentes da tabela
                if (data.pageNumber > 1) { // Só a partir da 2ª página da tabela
                    addHeaderFooter(doc.internal.getNumberOfPages());
                }
            },
            didParseCell: (data) => {
                // Adiciona tooltip (se houver) para termos do checklist
                if (data.section === 'body' && data.column.dataKey === 'pergunta') {
                    const originalText = checklistRows[data.row.index].pergunta;
                    const regex = /<span class="checklist-term" data-term-key="([^"]+)">([^<]+)<\/span>/g;
                    let match;
                    let plainText = originalText;
                    let tooltipFound = false;

                    while ((match = regex.exec(originalText)) !== null) {
                        const termKey = match[1];
                        const termText = match[2];
                        const glossaryTerm = glossaryData.find(g => g.key === termKey);
                        if (glossaryTerm) {
                            plainText = plainText.replace(match[0], termText); // Remove a tag, mantém o texto
                            data.cell.text.push(`(Ver: ${glossaryTerm.term})`);
                            tooltipFound = true;
                        }
                    }
                    if (tooltipFound) {
                        data.cell.text = doc.splitTextToSize(plainText, data.column.width - 5);
                    } else {
                        data.cell.text = doc.splitTextToSize(plainText, data.column.width - 5);
                    }
                }
            },
            margin: { top: yOffset + 5, right: margin, bottom: margin, left: margin }
        });

        // Atualiza o yOffset após a tabela
        yOffset = doc.autoTable.previous.finalY + 15;
    }

    doc.save(`ArborIA_Relatorio_Vistoria_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("PDF gerado com sucesso!", "success");
}

/**
 * Retorna a cor correspondente ao nível de risco para o PDF.
 * @param {string} riskLevel Nível de risco (Alto Risco, Médio Risco, Baixo Risco).
 * @returns {string} Código hexadecimal da cor.
 */
function getRiskColor(riskLevel) {
    switch (riskLevel) {
        case 'Alto Risco': return '#C62828'; // Vermelho
        case 'Médio Risco': return '#E65100'; // Laranja
        case 'Baixo Risco': return '#2E7D32'; // Verde
        default: return '#555555'; // Cinza
    }
}
