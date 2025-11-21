/* js/utils.js (v26.2 - Completo & Otimizado)
   Utilitários: Performance, UI (Toast), Imagens e GPS.
   Mantém a lógica original robusta solicitada.
*/

// Variável local para controlar o Toast (substitui a dependência circular com State)
let internalToastTimer = null;

// === 1. UTILITÁRIO DE PERFORMANCE (DEBOUNCE) ===

/**
 * Cria uma versão "debounced" de uma função.
 * Útil para inputs de pesquisa e eventos de scroll.
 */
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

// === 2. UTILITÁRIO DE UI (TOAST) ===

/**
 * Exibe notificação flutuante.
 */
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    // Limpa timer anterior
    if (internalToastTimer) {
        clearTimeout(internalToastTimer);
    }

    toast.textContent = message;
    // Reseta classes mantendo a base se existir, ou define 'show'
    toast.className = `show ${type}`; 

    // Cria novo timer para esconder
    internalToastTimer = setTimeout(() => {
        toast.className = toast.className.replace('show', '').trim();
        toast.classList.remove(type); 
        internalToastTimer = null;
    }, 3000);
}

// === 3. OTIMIZAÇÃO DE IMAGEM ===

/**
 * Redimensiona e comprime uma imagem (Blob/File) no cliente.
 * @param {File} imageFile - O arquivo original.
 * @param {number} maxWidth - Largura máxima (padrão 800px).
 * @param {number} quality - Qualidade JPEG (0 a 1).
 * @returns {Promise<Blob>} - A imagem processada.
 */
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
                
                // Lógica de redimensionamento proporcional
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Desenha no canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Exporta como Blob JPEG
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

// === 4. GIS (CONVERSÃO DE COORDENADAS) ===

/**
 * Converte Lat/Lon (WGS84) para UTM usando Proj4.
 * Verifica window.proj4 para evitar erros se a CDN falhar.
 */
export function convertLatLonToUtm(lat, lon) {
    
    // Validação de números
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
        console.error("GPS: Coordenadas inválidas (NaN).");
        return null;
    }

    // Tenta encontrar a biblioteca proj4 (no window ou global)
    const proj4Lib = (typeof window !== 'undefined' && window.proj4) || (typeof proj4 !== 'undefined' && proj4) || null;

    if (!proj4Lib) {
        console.error("GPS: Biblioteca Proj4 não encontrada.");
        showToast("Erro: Biblioteca GIS (Proj4) não carregou.", "error");
        return null;
    }

    try {
        // Cálculo da Zona UTM
        const zoneNum = Math.floor((lonNum + 180) / 6) + 1;
        const hemisphereParam = latNum < 0 ? '+south' : ''; 
        
        // Definições de projeção
        const wgs84 = "EPSG:4326";
        const utmDef = `+proj=utm +zone=${zoneNum} ${hemisphereParam} +datum=WGS84 +units=m +no_defs`;

        // Executa a conversão
        const [easting, northing] = proj4Lib(wgs84, utmDef, [lonNum, latNum]);
        
        // Define a letra da zona (apenas para visualização)
        const zoneLetters = "CDEFGHJKLMNPQRSTUVWXX";
        let zoneLetter = "Z"; 
        if (latNum >= -80 && latNum <= 84) {
            zoneLetter = zoneLetters.charAt(Math.floor((latNum + 80) / 8));
        }

        return { 
            easting: parseFloat(easting.toFixed(0)), 
            northing: parseFloat(northing.toFixed(0)), 
            zoneNum: zoneNum, 
            zoneLetter: zoneLetter 
        };

    } catch (e) {
        console.error("GPS: Erro na conversão matemática Proj4:", e);
        showToast("Erro ao calcular coordenadas UTM.", "error");
        return null;
    }
}

// === 5. HELPERS GERAIS (Adicionados para compatibilidade com UI) ===

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR').format(date);
    } catch (e) {
        return dateString;
    }
}

export function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    } catch (e) {
        return dateString;
    }
}

export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// Objeto Default para compatibilidade com import Utils from ...
const Utils = {
    debounce,
    showToast,
    optimizeImage,
    convertLatLonToUtm,
    generateId,
    formatDate,
    formatDateTime,
    escapeHTML
};

export default Utils;
