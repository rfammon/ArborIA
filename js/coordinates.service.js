/**
 * =====================================================
 * COORDINATES SERVICE V3 - Sistema Inteligente de Coordenadas
 * =====================================================
 *
 * Gerenciamento centralizado com detecção automática de formato.
 * Suporta UTM e Lat/Lon de forma transparente.
 *
 * @module CoordinatesService
 * @version 3.0
 * @author ArborIA Team
 */

// =====================================================
// CONSTANTES E CONFIGURAÇÃO
// =====================================================

const CONFIG = {
  DEFAULT_UTM_ZONE: 23, // São Paulo, Brasil
  DEFAULT_UTM_LETTER: "K", // Hemisfério Sul
  COORDINATE_PRECISION: 2,

  // Limites de validação UTM
  UTM_ZONE_MIN: 1,
  UTM_ZONE_MAX: 60,
  EASTING_MIN: 160000,
  EASTING_MAX: 840000,
  NORTHING_MIN: 0,
  NORTHING_MAX: 10000000,

  // Limites de validação Lat/Lon
  LAT_MIN: -90,
  LAT_MAX: 90,
  LON_MIN: -180,
  LON_MAX: 180,

  // Debug
  DEBUG: true,
};

// =====================================================
// UTILITÁRIOS DE LOG
// =====================================================

const Logger = {
  info: (msg, data) => {
    if (CONFIG.DEBUG) console.log(`[CoordService] ${msg}`, data || "");
  },
  warn: (msg, data) => {
    console.warn(`[CoordService] ⚠️ ${msg}`, data || "");
  },
  error: (msg, data) => {
    console.error(`[CoordService] ❌ ${msg}`, data || "");
  },
};

// =====================================================
// DETECÇÃO AUTOMÁTICA DE FORMATO
// =====================================================

/**
 * Detecta automaticamente o formato das coordenadas
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @returns {string} 'utm' | 'latlon' | 'unknown'
 */
function detectCoordinateFormat(x, y) {
  const xNum = parseFloat(x);
  const yNum = parseFloat(y);

  if (isNaN(xNum) || isNaN(yNum)) return "unknown";

  // Lat/Lon: valores pequenos (-90 a 90 para lat, -180 a 180 para lon)
  const isLikelyLatLon = Math.abs(xNum) <= 180 && Math.abs(yNum) <= 90;

  // UTM: valores grandes (centenas de milhares)
  const isLikelyUTM =
    xNum > 1000 &&
    yNum > 1000 &&
    xNum >= CONFIG.EASTING_MIN &&
    xNum <= CONFIG.EASTING_MAX &&
    yNum >= CONFIG.NORTHING_MIN &&
    yNum <= CONFIG.NORTHING_MAX;

  if (isLikelyUTM) return "utm";
  if (isLikelyLatLon) return "latlon";

  return "unknown";
}

// =====================================================
// VALIDAÇÃO
// =====================================================

/**
 * Valida zona UTM
 */
function isValidUTMZone(zoneNum) {
  if (!zoneNum && zoneNum !== 0) return false;
  const num = parseInt(zoneNum, 10);
  return (
    !isNaN(num) && num >= CONFIG.UTM_ZONE_MIN && num <= CONFIG.UTM_ZONE_MAX
  );
}

/**
 * Valida letra de zona UTM
 */
function isValidUTMZoneLetter(zoneLetter) {
  if (!zoneLetter || typeof zoneLetter !== "string") return false;
  const letter = zoneLetter.toUpperCase();
  return /^[A-HJ-NP-Z]$/.test(letter); // Exclui I e O
}

/**
 * Valida coordenadas UTM completas
 */
function validateUTM(easting, northing, zoneNum, zoneLetter) {
  const errors = [];

  const e = parseFloat(easting);
  if (isNaN(e)) {
    errors.push("Easting inválido");
  } else if (e < CONFIG.EASTING_MIN || e > CONFIG.EASTING_MAX) {
    errors.push(
      `Easting fora do intervalo (${CONFIG.EASTING_MIN}-${CONFIG.EASTING_MAX})`,
    );
  }

  const n = parseFloat(northing);
  if (isNaN(n)) {
    errors.push("Northing inválido");
  } else if (n < CONFIG.NORTHING_MIN || n > CONFIG.NORTHING_MAX) {
    errors.push(
      `Northing fora do intervalo (${CONFIG.NORTHING_MIN}-${CONFIG.NORTHING_MAX})`,
    );
  }

  if (!isValidUTMZone(zoneNum)) {
    errors.push("Zona UTM inválida (1-60)");
  }

  if (!isValidUTMZoneLetter(zoneLetter)) {
    errors.push("Letra da zona UTM inválida");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida coordenadas geográficas
 */
function validateLatLon(lat, lon) {
  const errors = [];

  const latitude = parseFloat(lat);
  if (isNaN(latitude)) {
    errors.push("Latitude inválida");
  } else if (latitude < CONFIG.LAT_MIN || latitude > CONFIG.LAT_MAX) {
    errors.push(
      `Latitude fora do intervalo (${CONFIG.LAT_MIN} a ${CONFIG.LAT_MAX})`,
    );
  }

  const longitude = parseFloat(lon);
  if (isNaN(longitude)) {
    errors.push("Longitude inválida");
  } else if (longitude < CONFIG.LON_MIN || longitude > CONFIG.LON_MAX) {
    errors.push(
      `Longitude fora do intervalo (${CONFIG.LON_MIN} a ${CONFIG.LON_MAX})`,
    );
  }

  return { valid: errors.length === 0, errors };
}

// =====================================================
// CONVERSÃO UTM ↔ LAT/LON
// =====================================================

/**
 * Converte Lat/Lon para UTM usando Proj4
 */
function latLonToUTM(latitude, longitude) {
  const validation = validateLatLon(latitude, longitude);
  if (!validation.valid) {
    Logger.error("Lat/Lon inválidas", validation.errors);
    return null;
  }

  if (typeof window.proj4 === "undefined") {
    Logger.error("Biblioteca proj4 não carregada");
    return null;
  }

  try {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // Calcular zona UTM baseada na longitude
    const zoneNum = Math.floor((lon + 180) / 6) + 1;

    // Determinar hemisfério
    const zoneLetter = lat >= 0 ? "N" : "K";
    const hemisphere = lat >= 0 ? "+north" : "+south";

    // Definir projeções
    const utmProj = `+proj=utm +zone=${zoneNum} ${hemisphere} +datum=WGS84 +units=m +no_defs`;
    const wgs84Proj = "EPSG:4326";

    // Converter
    const [eastingRaw, northingRaw] = window.proj4(wgs84Proj, utmProj, [
      lon,
      lat,
    ]);

    const result = {
      easting: parseFloat(eastingRaw.toFixed(CONFIG.COORDINATE_PRECISION)),
      northing: parseFloat(northingRaw.toFixed(CONFIG.COORDINATE_PRECISION)),
      zoneNum: zoneNum,
      zoneLetter: zoneLetter,
    };

    Logger.info("Conversão Lat/Lon → UTM", result);
    return result;
  } catch (error) {
    Logger.error("Erro na conversão Lat/Lon → UTM", error);
    return null;
  }
}

/**
 * Converte UTM para Lat/Lon usando Proj4
 */
function utmToLatLon(easting, northing, zoneNum, zoneLetter) {
  const validation = validateUTM(easting, northing, zoneNum, zoneLetter);
  if (!validation.valid) {
    Logger.error("Coordenadas UTM inválidas", validation.errors);
    return null;
  }

  if (typeof window.proj4 === "undefined") {
    Logger.error("Biblioteca proj4 não carregada");
    return null;
  }

  try {
    const e = parseFloat(easting);
    const n = parseFloat(northing);
    const zone = parseInt(zoneNum, 10);
    const letter = zoneLetter.toUpperCase();

    // Determinar hemisfério
    const hemisphere = letter >= "N" ? "+north" : "+south";

    // Definir projeções
    const utmProj = `+proj=utm +zone=${zone} ${hemisphere} +datum=WGS84 +units=m +no_defs`;
    const wgs84Proj = "EPSG:4326";

    // Converter
    const [lonRaw, latRaw] = window.proj4(utmProj, wgs84Proj, [e, n]);

    const result = {
      latitude: parseFloat(latRaw.toFixed(7)),
      longitude: parseFloat(lonRaw.toFixed(7)),
    };

    Logger.info("Conversão UTM → Lat/Lon", result);
    return result;
  } catch (error) {
    Logger.error("Erro na conversão UTM → Lat/Lon", error);
    return null;
  }
}

// =====================================================
// NORMALIZAÇÃO INTELIGENTE
// =====================================================

/**
 * Normaliza coordenadas de qualquer formato para padrão UTM
 * Detecta automaticamente o formato de entrada
 */
function normalizeCoordinates(input) {
  if (!input) {
    Logger.warn("Input vazio para normalização");
    return null;
  }

  Logger.info("Normalizando coordenadas", input);

  // Caso 1: Já tem UTM completo e válido
  if (input.easting && input.northing) {
    const zoneNum =
      input.utmZoneNum || input.utmzonenum || CONFIG.DEFAULT_UTM_ZONE;
    const zoneLetter = (
      input.utmZoneLetter ||
      input.utmzoneletter ||
      CONFIG.DEFAULT_UTM_LETTER
    ).toUpperCase();

    const validation = validateUTM(
      input.easting,
      input.northing,
      zoneNum,
      zoneLetter,
    );
    if (validation.valid) {
      Logger.info("✓ Coordenadas UTM já válidas");
      return {
        easting: parseFloat(input.easting),
        northing: parseFloat(input.northing),
        utmZoneNum: parseInt(zoneNum, 10),
        utmZoneLetter: zoneLetter,
      };
    }
  }

  // Caso 2: Tem Lat/Lon explícitos
  if (input.latitude && input.longitude) {
    const validation = validateLatLon(input.latitude, input.longitude);
    if (validation.valid) {
      Logger.info("✓ Convertendo de Lat/Lon para UTM");
      return latLonToUTM(input.latitude, input.longitude);
    }
  }

  // Caso 3: Coordenadas genéricas (coordX/coordY) - detectar formato
  if ((input.coordX || input.coordx) && (input.coordY || input.coordy)) {
    const x = parseFloat(input.coordX || input.coordx);
    const y = parseFloat(input.coordY || input.coordy);

    const format = detectCoordinateFormat(x, y);
    Logger.info(`Formato detectado: ${format}`, { x, y });

    if (format === "utm") {
      const zoneNum =
        input.utmZoneNum || input.utmzonenum || CONFIG.DEFAULT_UTM_ZONE;
      const zoneLetter = (
        input.utmZoneLetter ||
        input.utmzoneletter ||
        CONFIG.DEFAULT_UTM_LETTER
      ).toUpperCase();

      return {
        easting: x,
        northing: y,
        utmZoneNum: parseInt(zoneNum, 10),
        utmZoneLetter: zoneLetter,
      };
    } else if (format === "latlon") {
      // X é longitude, Y é latitude
      return latLonToUTM(y, x);
    }
  }

  Logger.error("Não foi possível normalizar coordenadas", input);
  return null;
}

/**
 * Prepara coordenadas para o banco de dados (formato snake_case)
 */
function prepareForDatabase(treeData) {
  const normalized = normalizeCoordinates(treeData);

  if (!normalized) {
    Logger.warn("Falha ao normalizar - usando valores padrão");
    return {
      easting: 0,
      northing: 0,
      utmzonenum: null,
      utmzoneletter: null,
    };
  }

  const result = {
    easting: normalized.easting,
    northing: normalized.northing,
    utmzonenum: normalized.utmZoneNum,
    utmzoneletter: normalized.utmZoneLetter,
  };

  Logger.info("✓ Preparado para banco", result);
  return result;
}

/**
 * Prepara coordenadas do banco para a aplicação
 * Converte de snake_case para camelCase e adiciona conversões
 */
function prepareFromDatabase(dbRow) {
  if (!dbRow) {
    Logger.warn("Linha do banco vazia");
    return null;
  }

  // Extrair valores (priorizar easting/northing, depois coordx/y)
  const easting = dbRow.easting ?? dbRow.coordx ?? 0;
  const northing = dbRow.northing ?? dbRow.coordy ?? 0;
  const utmZoneNum = dbRow.utmzonenum ?? dbRow.utmZoneNum ?? null;
  const utmZoneLetter = dbRow.utmzoneletter ?? dbRow.utmZoneLetter ?? null;

  Logger.info("Lendo do banco", {
    id: dbRow.id,
    easting,
    northing,
    utmZoneNum,
    utmZoneLetter,
  });

  // Se não tiver zona UTM, usar padrão
  const finalZoneNum = utmZoneNum || CONFIG.DEFAULT_UTM_ZONE;
  const finalZoneLetter = utmZoneLetter || CONFIG.DEFAULT_UTM_LETTER;

  // Converter para Lat/Lon para uso em mapas (se possível)
  let latLon = null;
  if (easting && northing && easting !== 0 && northing !== 0) {
    latLon = utmToLatLon(easting, northing, finalZoneNum, finalZoneLetter);
  }

  const result = {
    // Coordenadas UTM (formato de exibição - camelCase)
    coordX: easting,
    coordY: northing,
    utmZoneNum: finalZoneNum,
    utmZoneLetter: finalZoneLetter,

    // Coordenadas UTM (formato de banco - snake_case)
    easting: easting,
    northing: northing,
    utmzonenum: finalZoneNum,
    utmzoneletter: finalZoneLetter,

    // Coordenadas geográficas (para mapas Leaflet)
    latitude: latLon?.latitude ?? null,
    longitude: latLon?.longitude ?? null,
  };

  Logger.info("✓ Preparado da banco", {
    coordX: result.coordX,
    coordY: result.coordY,
    geoLatitude: result.latitude,
    geoLongitude: result.longitude,
  });

  return result;
}

// =====================================================
// FORMATAÇÃO PARA EXIBIÇÃO
// =====================================================

/**
 * Formata coordenadas UTM para exibição
 */
function formatUTM(coords) {
  if (!coords || !coords.easting || !coords.northing) {
    return "N/A";
  }

  const zone = coords.utmZoneNum || coords.utmzonenum || "?";
  const letter = coords.utmZoneLetter || coords.utmzoneletter || "?";
  const east = Math.round(coords.easting);
  const north = Math.round(coords.northing);

  return `${zone}${letter} ${east.toLocaleString()} E, ${north.toLocaleString()} N`;
}

/**
 * Formata coordenadas para exibição compacta (tabelas)
 */
function formatCompact(coords) {
  if (!coords || !coords.easting || !coords.northing) {
    return { east: "N/A", north: "N/A" };
  }

  return {
    east: Math.round(coords.easting).toString(),
    north: Math.round(coords.northing).toString(),
  };
}

// =====================================================
// UTILITÁRIOS
// =====================================================

/**
 * Verifica se tem coordenadas válidas
 */
function hasValidCoordinates(coords) {
  if (!coords) return false;

  // Verificar UTM
  if (coords.easting || coords.coordX) {
    const e = parseFloat(coords.easting || coords.coordX);
    const n = parseFloat(coords.northing || coords.coordY);
    return !isNaN(e) && !isNaN(n) && e !== 0 && n !== 0;
  }

  // Verificar Lat/Lon
  if (coords.latitude && coords.longitude) {
    const lat = parseFloat(coords.latitude);
    const lon = parseFloat(coords.longitude);
    return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
  }

  return false;
}

/**
 * Calcula distância entre dois pontos em UTM (metros)
 */
function calculateDistance(coord1, coord2) {
  try {
    const e1 = parseFloat(coord1.easting || coord1.coordX);
    const n1 = parseFloat(coord1.northing || coord1.coordY);
    const e2 = parseFloat(coord2.easting || coord2.coordX);
    const n2 = parseFloat(coord2.northing || coord2.coordY);

    if (isNaN(e1) || isNaN(n1) || isNaN(e2) || isNaN(n2)) {
      return null;
    }

    const deltaE = e2 - e1;
    const deltaN = n2 - n1;

    return Math.sqrt(deltaE * deltaE + deltaN * deltaN);
  } catch (error) {
    Logger.error("Erro ao calcular distância", error);
    return null;
  }
}

/**
 * Obtém informações da zona UTM baseada em Lat/Lon
 */
function getUTMZoneInfo(latitude, longitude) {
  const zoneNum = Math.floor((longitude + 180) / 6) + 1;
  const zoneLetter = latitude >= 0 ? "N" : "K";
  const hemisphere = latitude >= 0 ? "Norte" : "Sul";

  return {
    zoneNum,
    zoneLetter,
    description: `Zona UTM ${zoneNum}${zoneLetter} (Hemisfério ${hemisphere})`,
  };
}

// =====================================================
// EXPORTAÇÃO DO SERVIÇO
// =====================================================

export const CoordinatesService = {
  // Conversões
  latLonToUTM,
  utmToLatLon,

  // Normalização
  normalizeCoordinates,
  prepareForDatabase,
  prepareFromDatabase,

  // Validação
  validateUTM,
  validateLatLon,
  isValidUTMZone,
  isValidUTMZoneLetter,

  // Formatação
  formatUTM,
  formatCompact,

  // Utilitários
  hasValidCoordinates,
  calculateDistance,
  getUTMZoneInfo,
  detectCoordinateFormat,

  // Constantes
  DEFAULT_UTM_ZONE: CONFIG.DEFAULT_UTM_ZONE,
  DEFAULT_UTM_LETTER: CONFIG.DEFAULT_UTM_LETTER,

  // Configuração
  setDebug: (enabled) => {
    CONFIG.DEBUG = enabled;
  },
};

// Exportação global para compatibilidade
window.CoordinatesService = CoordinatesService;

Logger.info("✓ Módulo de coordenadas V3 carregado");
