// js/utils.js (v26.2 - Completo com optimizeImage e GPS Fix)

import { toastTimer, setToastTimer } from './state.js';

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
    if (toastTimer) {
        clearTimeout(toastTimer);
    }

    toast.textContent = message;
    toast.className = 'show'; 
    toast.classList.add(type);

    // Cria novo timer para esconder
    const newTimer = setTimeout(() => {
        toast.className = toast.className.replace('show', '');
        toast.classList.remove(type); 
        setToastTimer(null);
    }, 3000);
    
    setToastTimer(newTimer);
}

// === 3. OTIMIZAÇÃO DE IMAGEM (Esta é a função que estava faltando) ===

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
