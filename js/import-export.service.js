// js/import-export.service.js

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';
import { TableUI } from './table.ui.js';

function getCSVData() {
    if (state.getRegisteredTrees().length === 0) return null;
    const headers = ["ID", "Data", "Especie", "CoordX", "CoordY", "ZonaN", "ZonaL", "DAP", "Altura", "Distancia", "Local", "Avaliador", "Pontos", "Risco", "Obs", "Fatores", "Foto"];
    let csv = "\uFEFF" + headers.join(";") + "\n";
    state.getRegisteredTrees().forEach(t => {
        const c = (s) => (s || '').toString().replace(/[\n;]/g, ' ');
        const rf = (t.riskFactors || []).join(',');
        const r = [
            t.id, t.data, c(t.especie), t.coordX, t.coordY, t.utmZoneNum, t.utmZoneLetter,
            t.dap, t.altura, t.distancia, c(t.local), c(t.avaliador), t.pontuacao, t.risco, c(t.observacoes), rf, t.hasPhoto ? 'Sim' : 'Nao'
        ];
        csv += r.join(";") + "\n";
    });
    return csv;
}

export function sendEmailReport() {
    const csvData = getCSVData();
    if (!csvData) {
        utils.showToast("Nenhum dado para enviar.", "error");
        return;
    }

    const subject = "Laudo de Avaliação Arbórea - ArborIA";
    const body = `Olá,\n\nSegue o laudo gerado pelo aplicativo ArborIA.\n\n---\n${csvData}\n---\n\nAtenciosamente,\nEquipe ArborIA`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Create a temporary link to trigger the mail client
    const link = document.createElement('a');
    link.href = mailtoLink;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    utils.showToast("Cliente de e-mail aberto.", "success");
}

export function exportActionZip() {
    if (typeof JSZip === 'undefined') { utils.showToast("Erro: JSZip.", 'error'); return; }
    if (state.getRegisteredTrees().length === 0) { utils.showToast("Sem dados.", 'error'); return; }

    const zipStatus = document.getElementById('zip-status');
    if (zipStatus) zipStatus.style.display = 'flex';

    try {
        const zip = new JSZip();
        const csv = getCSVData();
        if (csv) zip.file("manifesto_dados.csv", csv);

        db.getAllImagesFromDB().then(images => {
            if (images.length > 0) {
                const imgFolder = zip.folder("images");
                images.forEach(img => {
                    const t = state.getRegisteredTrees().find(x => x.id === img.id);
                    if (t && t.hasPhoto) {
                        let ext = img.imageBlob.type.includes('png') ? 'png' : 'jpg';
                        imgFolder.file(`tree_id_${img.id}.${ext}`, img.imageBlob);
                    }
                });
            }
            zip.generateAsync({ type: "blob" }).then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `Backup_ArborIA_${new Date().toISOString().slice(0, 10)}.zip`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                utils.showToast('ZIP criado!', 'success');
                if (zipStatus) zipStatus.style.display = 'none';
            });
        });
    } catch (e) {
        
        if (zipStatus) zipStatus.style.display = 'none';
    }
}

import { calculateRiskFromFactors } from './tree.service.js';

// ... (rest of the file)

export async function handleImportZip(event) {
    if (typeof JSZip === 'undefined') return;
    const file = event.target.files[0]; if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);
        const csvFile = zip.file("manifesto_dados.csv");
        if (!csvFile) throw new Error("CSV não encontrado.");

        const csvContent = await csvFile.async("string");
        const lines = csvContent.split('\n').filter(l => l.trim() !== '');

        let newTrees = [...state.getRegisteredTrees()];
        let maxId = newTrees.length > 0 ? Math.max(...newTrees.map(t => t.id)) : 0;

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(';');
            if (row.length < 5) continue;

            const riskFactors = (row[15] || '').split(',').map(Number);
            const riskCalculation = calculateRiskFromFactors(riskFactors);

            const newId = ++maxId;
            const tree = {
                id: newId, data: row[1], especie: row[2], coordX: row[3], coordY: row[4],
                utmZoneNum: parseInt(row[5]), utmZoneLetter: row[6],
                dap: row[7], altura: row[8], distancia: row[9],
                local: row[10], avaliador: row[11],
                observacoes: row[14],
                riskFactors: riskFactors,
                hasPhoto: (row[16] && row[16].trim().toLowerCase() === 'sim'),
                
                // Recalculated values
                pontuacao: riskCalculation.pontuacao,
                risco: riskCalculation.risco,
                riscoClass: riskCalculation.riscoClass
            };

            if (tree.hasPhoto) {
                const oldId = row[0];
                const imgFile = zip.file(`images/tree_id_${oldId}.jpg`) || zip.file(`images/tree_id_${oldId}.png`);
                if (imgFile) {
                    const blob = await imgFile.async("blob");
                    db.saveImageToDB(newId, blob);
                } else {
                    
                    tree.hasPhoto = false; // Corrige o estado se a foto não for encontrada
                }
            }
            newTrees.push(tree);
        }

        state.setRegisteredTrees(newTrees);
        state.saveDataToStorage();
        TableUI.render();
        utils.showToast("Importação concluída!", "success");

    } catch (e) {
        
        utils.showToast("Erro na importação.", "error");
    } finally {
        event.target.value = null;
    }
}

