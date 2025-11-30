/**
 * ARBORIA 2.0 - UTILS
 * Funções utilitárias globais: UI, Imagem, GPS e Datas.
 */

// === 1. UTILITÁRIO DE PERFORMANCE (DEBOUNCE) ===
export function debounce(func, delay = 300) {
    let timer;
    return function(...args) {
        const context = this; 
        clearTimeout(timer); 
        timer = setTimeout(() => {
            func.apply(context, args); 
        }, delay);
    };
}

// === 2. UTILITÁRIO DE UI (TOAST E VALIDAÇÃO DE INPUTS) ===

/**
 * Exibe uma notificação temporária na tela.
 * @param {string} message - O texto a ser exibido.
 * @param {string} type - O tipo de alerta: 'success', 'error' ou 'info'.
 */
export function showToast(message, type = 'info') {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    // 1. Define o texto
    toast.textContent = message;

    // 2. Reseta classes antigas e adiciona a nova (tipo)
    toast.className = ''; // Limpa tudo (incluindo 'show')
    toast.classList.add(type);

    // 3. Força um reflow (opcional, mas bom para reiniciar animações)
    void toast.offsetWidth;

    // 4. Mostra o toast
    toast.classList.add("show");

    // 5. Define o temporizador para esconder
    // Limpa timeout anterior se houver (para não piscar se o usuário clicar rápido)
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    
    toast.timeoutId = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500); // 3.5 segundos de exibição
}

/**
 * Exibe uma mensagem de erro abaixo do elemento de input.
 * @param {HTMLElement} inputElement O elemento de input ao qual o erro se refere.
 * @param {string} message A mensagem de erro a ser exibida.
 */
export function showInputError(inputElement, message) {
    if (!inputElement) return;
    clearInputError(inputElement); // Limpa qualquer erro existente

    const errorDiv = document.createElement('div');
    errorDiv.className = 'input-error-message';
    errorDiv.textContent = message;
    
    inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
    inputElement.classList.add('input-error');
}

/**
 * Remove a mensagem de erro e a estilização de erro de um elemento de input.
 * @param {HTMLElement} inputElement O elemento de input do qual remover o erro.
 */
export function clearInputError(inputElement) {
    if (!inputElement) return;
    const existingError = inputElement.parentNode.querySelector('.input-error-message');
    if (existingError) {
        existingError.remove();
    }
    inputElement.classList.remove('input-error');
}

// === 3. HELPERS DE DADOS (Data e UUID) ===
export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const offsetDate = new Date(date.getTime() + userTimezoneOffset);
        return offsetDate.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
}

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// === 4. OTIMIZAÇÃO DE IMAGEM (Compressão Client-Side) ===
export async function optimizeImage(imageFile, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let { width, height } = img;
                
                // Redimensionamento proporcional
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Falha ao gerar Blob da imagem."));
                    }
                }, 'image/jpeg', quality);
            };
            
            img.onerror = (err) => reject(err);
        };
        
        reader.onerror = (err) => reject(err);
    });
}

// === 5. GIS (CONVERSÃO GEOGRÁFICA) ===
export function convertLatLonToUtm(lat, lon) {
    // Validação
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
        
        return null;
    }

    // Acesso à biblioteca Proj4
    const proj4Lib = (typeof window !== 'undefined' && window.proj4) || (typeof proj4 !== 'undefined' && proj4) || null;

    if (!proj4Lib) {
        
        showToast("Erro: Biblioteca GPS ausente.", "error");
        return null;
    }

    try {
        // Lógica de Zona UTM
        const zoneNum = Math.floor((lonNum + 180) / 6) + 1;
        const hemisphereParam = latNum < 0 ? '+south' : ''; 
        
        const wgs84 = "EPSG:4326";
        const utmDef = `+proj=utm +zone=${zoneNum} ${hemisphereParam} +datum=WGS84 +units=m +no_defs`;

        // Conversão
        const [easting, northing] = proj4Lib(wgs84, utmDef, [lonNum, latNum]);
        
        // Letra da Zona (Simplificado mas funcional para Brasil)
        // Para rigor militar completo usaríamos a tabela MGRS completa, mas esta lógica atende
        let zoneLetter = 'N';
        if (latNum < 0) zoneLetter = 'K'; // Maioria do Brasil Central/Sul
        if (latNum < -32) zoneLetter = 'H'; // Extremo Sul
        if (latNum >= 0) zoneLetter = 'M'; // Norte do Equador

        return { 
            easting: parseFloat(easting.toFixed(0)), 
            northing: parseFloat(northing.toFixed(0)), 
            zoneNum: zoneNum, 
            zoneLetter: zoneLetter 
        };

    } catch (e) {
        
        return null;
    }
}

/**
 * [NOVO] Dispara o download de um arquivo Blob pelo navegador.
 * @param {Blob} blob - O conteúdo do arquivo.
 * @param {string} fileName - O nome do arquivo a ser salvo (ex: 'backup.zip').
 */
export function downloadBlob(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Limpeza
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

export function openReportPreview(htmlContent, mapRenderCallback) {
    const overlay = document.getElementById('report-preview-overlay');
    const paper = document.getElementById('report-paper');
    
    // Força o estilo do papel para garantir o crescimento dinâmico
    paper.style.minHeight = '297mm';
    paper.style.height = 'auto';
    paper.style.overflow = 'visible';
    paper.style.padding = '15mm';
    paper.style.background = 'white';

    // Injeta HTML
    paper.innerHTML = htmlContent;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Trava scroll do app

    // Renderiza Mapas (com delay para o DOM estabilizar)
    if (mapRenderCallback) setTimeout(mapRenderCallback, 300);

    // Eventos
    document.getElementById('btn-close-report').onclick = () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        paper.innerHTML = ''; // Limpa memória
        // Reseta estilos para evitar conflitos futuros
        paper.style.minHeight = '';
        paper.style.height = '';
        paper.style.overflow = '';
        paper.style.padding = '';
        paper.style.background = '';
    };
    document.getElementById('btn-print-report').onclick = () => window.print();
}
