/* js/utils.js (vFinal - Refatorado)
   Utilitários Compartilhados: UI, GPS, Imagens e Helpers.
   Contém lógica robusta de Proj4 e Otimização de Imagens via Canvas.
*/

// Variável local para controle de timer (evita dependência circular com State)
let internalToastTimer = null;

// === 1. UTILITÁRIOS GERAIS ===

/**
 * Gera um ID único (Timestamp + Random)
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Formata data ISO para PT-BR (DD/MM/AAAA)
 */
export function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        // Ajuste de fuso horário simples (evita mostrar dia anterior)
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        return new Intl.DateTimeFormat('pt-BR').format(adjustedDate);
    } catch (e) {
        return dateString;
    }
}

/**
 * Sanitiza strings para evitar XSS básico na renderização HTML
 */
export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}

/**
 * Debounce: Limita a frequência de execução de uma função
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Converte Graus para Radianos (Matemática)
 */
export function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// === 2. FEEDBACK DE UI (TOAST) ===

/**
 * Exibe notificação flutuante no topo da tela.
 * @param {string} message - Texto da mensagem
 * @param {string} type - 'success', 'error' ou 'warning'
 */
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    // Limpa timer anterior se houver (reset)
    if (internalToastTimer) {
        clearTimeout(internalToastTimer);
        internalToastTimer = null;
    }

    // Define conteúdo e estilo
    toast.textContent = message;
    toast.className = `show ${type}`; // Reseta classes e aplica show + tipo

    // Timer para esconder
    internalToastTimer = setTimeout(() => {
        toast.className = toast.className.replace('show', '').trim();
        internalToastTimer = null;
    }, 3500); // 3.5 segundos
}

// === 3. OTIMIZAÇÃO DE IMAGEM (Canvas API) ===

/**
 * Redimensiona e comprime imagem no client-side antes do upload.
 * @param {File} imageFile - Arquivo de entrada
 * @param {number} maxWidth - Largura máxima (ex: 800px)
 * @param {number} quality - Qualidade JPEG (0.0 a 1.0)
 * @returns {Promise<Blob>} - Blob da imagem processada
 */
export async function optimizeImage(imageFile, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (!imageFile.type.startsWith('image/')) {
            reject(new Error('Arquivo não é uma imagem.'));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Cálculo de proporção
                let { width, height } = img;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Desenha (Resample)
                ctx.drawImage(img, 0, 0, width, height);
                
                // Exporta
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Falha na compressão da imagem via Canvas."));
                    }
                }, 'image/jpeg', quality);
            };
            
            img.onerror = (err) => reject(err);
        };
        
        reader.onerror = (err) => reject(err);
    });
}

// === 4. GIS (GPS & PROJ4) ===

/**
 * Converte Lat/Lon (WGS84) para UTM usando a biblioteca Proj4.
 * Requer window.proj4 carregado via CDN ou script.
 */
export function convertLatLonToUtm(lat, lon) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
        console.warn("[Utils] Coordenadas inválidas para conversão.");
        return null;
    }

    // Verifica se a lib existe no escopo global
    const proj4Lib = (typeof window !== 'undefined' && window.proj4) || (typeof proj4 !== 'undefined' && proj4);

    if (!proj4Lib) {
        console.warn("[Utils] Biblioteca Proj4 não encontrada. Retornando nulo.");
        showToast("Erro: Biblioteca GIS (Proj4) não carregou.", "warning");
        return null;
    }

    try {
        // 1. Determina Zona UTM (Fórmula padrão)
        const zoneNum = Math.floor((lonNum + 180) / 6) + 1;
        const hemisphere = latNum < 0 ? '+south' : ''; 
        
        // 2. Definições de Projeção
        const wgs84 = "EPSG:4326";
        const utmDef = `+proj=utm +zone=${zoneNum} ${hemisphere} +datum=WGS84 +units=m +no_defs`;

        // 3. Executa Conversão
        const [easting, northing] = proj4Lib(wgs84, utmDef, [lonNum, latNum]);
        
        // 4. Calcula Letra da Zona (Opcional, mas útil)
        const zoneLetters = "CDEFGHJKLMNPQRSTUVWXX";
        let zoneLetter = "Z"; 
        if (latNum >= -80 && latNum <= 84) {
            zoneLetter = zoneLetters.charAt(Math.floor((latNum + 80) / 8));
        }

        return { 
            easting: parseFloat(easting.toFixed(2)), 
            northing: parseFloat(northing.toFixed(2)), 
            zoneNum: zoneNum, 
            zoneLetter: zoneLetter 
        };

    } catch (e) {
        console.error("[Utils] Erro matemático no Proj4:", e);
        return null;
    }
}

// === EXPORTAÇÃO PADRÃO (COMPATIBILIDADE) ===
// Permite: import Utils from './utils.js'
const Utils = {
    generateId,
    formatDate,
    escapeHTML,
    debounce,
    deg2rad,
    showToast,
    optimizeImage,
    convertLatLonToUtm
};

export default Utils;
