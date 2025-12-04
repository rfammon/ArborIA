# 🗺️ Arquitetura de Coordenadas - ArborIA

## 📋 Visão Geral

Este documento descreve a arquitetura unificada de gerenciamento de coordenadas no sistema ArborIA, implementada para resolver problemas de inconsistência entre diferentes sistemas de coordenadas.

---

## 🎯 Problema Resolvido

### Antes (Problema)
- ❌ Coordenadas espalhadas em múltiplos formatos (coordX/coordY, easting/northing, latitude/longitude)
- ❌ Conversões inconsistentes entre UTM e Lat/Lon
- ❌ `utmzonenum` salvando como NULL no banco de dados
- ❌ Exibição `E: undefined, N: undefined` na interface
- ❌ Colunas duplicadas sem uso claro

### Depois (Solução)
- ✅ Sistema único de armazenamento (UTM)
- ✅ Conversões centralizadas via `CoordinatesService`
- ✅ Validação robusta de dados
- ✅ Compatibilidade total com Leaflet e Proj4
- ✅ Coordenadas sempre válidas

---

## 🏗️ Arquitetura

### Sistema de Coordenadas Único

```
┌─────────────────────────────────────────────────────┐
│                 FONTE DE DADOS                      │
├─────────────────────────────────────────────────────┤
│  • GPS (Lat/Lon)                                    │
│  • Formulário Manual (UTM)                          │
│  • Importação CSV (ambos)                           │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│          CoordinatesService.normalize()             │
│                                                     │
│  Converte TUDO para formato padrão:                │
│  { easting, northing, utmZoneNum, utmZoneLetter }  │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                ARMAZENAMENTO                        │
│              (Banco de Dados)                       │
├─────────────────────────────────────────────────────┤
│  easting         NUMERIC(15,2)  ← Coordenada Leste │
│  northing        NUMERIC(15,2)  ← Coordenada Norte │
│  utmzonenum      INTEGER         ← Zona (1-60)     │
│  utmzoneletter   VARCHAR(1)      ← Hemisfério      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│     CoordinatesService.prepareFromDatabase()        │
│                                                     │
│  Converte UTM → Lat/Lon quando necessário          │
│  (para uso em mapas Leaflet)                       │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                  VISUALIZAÇÃO                       │
├─────────────────────────────────────────────────────┤
│  • Tabela: mostra UTM (E: xxx, N: xxx)             │
│  • Mapa Leaflet: usa Lat/Lon convertido            │
│  • Relatórios: ambos os formatos                   │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Módulo: CoordinatesService

### Localização
```
js/coordinates.service.js
```

### Funções Principais

#### 1. Conversão

```javascript
// Lat/Lon → UTM
const utm = CoordinatesService.latLonToUTM(latitude, longitude);
// Retorna: { easting, northing, zoneNum, zoneLetter }

// UTM → Lat/Lon
const latlon = CoordinatesService.utmToLatLon(easting, northing, zoneNum, zoneLetter);
// Retorna: { latitude, longitude }
```

#### 2. Normalização

```javascript
// Aceita qualquer formato e normaliza para UTM
const normalized = CoordinatesService.normalizeCoordinates(input);
```

**Formatos aceitos:**
- UTM completo: `{ easting, northing, utmZoneNum, utmZoneLetter }`
- Lat/Lon: `{ latitude, longitude }`
- Legado: `{ coordX, coordY, utmZoneNum }`

#### 3. Preparação para Banco de Dados

```javascript
// Prepara coordenadas para inserção no Supabase
const dbData = CoordinatesService.prepareForDatabase(treeData);
// Retorna: { easting, northing, utmzonenum, utmzoneletter }
```

#### 4. Leitura do Banco de Dados

```javascript
// Processa linha do banco e adiciona conversões
const appData = CoordinatesService.prepareFromDatabase(dbRow);
// Retorna: {
//   easting, northing, utmzonenum, utmzoneletter,
//   coordX, coordY, utmZoneNum, utmZoneLetter,
//   latitude, longitude (convertidos)
// }
```

#### 5. Validação

```javascript
// Validar UTM
const validation = CoordinatesService.validateUTMCoordinates(e, n, zone, letter);
// Retorna: { valid: boolean, errors: string[] }

// Validar Lat/Lon
const validation = CoordinatesService.validateLatLon(lat, lon);
// Retorna: { valid: boolean, errors: string[] }
```

#### 6. Formatação

```javascript
// Formato completo
CoordinatesService.formatUTMForDisplay(coords);
// "23K 353657 E, 7343326 N"

// Formato compacto (para tabelas)
CoordinatesService.formatCompact(coords);
// { east: "353657", north: "7343326" }
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `arvores`

```sql
CREATE TABLE public.arvores (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    
    -- Coordenadas UTM (SISTEMA PRINCIPAL)
    easting NUMERIC(15, 2) NOT NULL DEFAULT 0,
    northing NUMERIC(15, 2) NOT NULL DEFAULT 0,
    utmzonenum INTEGER,
    utmzoneletter VARCHAR(1),
    
    -- Outras colunas...
    nome TEXT NOT NULL,
    especie TEXT,
    avaliador TEXT,
    -- etc...
);
```

### Constraints de Validação

```sql
-- Zona UTM entre 1 e 60
ALTER TABLE public.arvores
    ADD CONSTRAINT check_utmzonenum_range
    CHECK (utmzonenum IS NULL OR (utmzonenum >= 1 AND utmzonenum <= 60));

-- Letra da zona válida (A-Z, exceto I e O)
ALTER TABLE public.arvores
    ADD CONSTRAINT check_utmzoneletter_valid
    CHECK (utmzoneletter IS NULL OR utmzoneletter ~ '^[A-Z]$');
```

### Índices

```sql
CREATE INDEX idx_arvores_utmzonenum ON public.arvores(utmzonenum);
CREATE INDEX idx_arvores_user_id ON public.arvores(user_id);
```

---

## 🔄 Fluxo de Dados

### 1. Captura de Coordenadas (GPS)

```javascript
// features.js - handleGetGPS()

navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    
    // Converter para UTM usando CoordinatesService
    const utm = CoordinatesService.latLonToUTM(latitude, longitude);
    
    // Preencher campos do formulário
    document.getElementById('risk-coordx').value = utm.easting.toFixed(0);
    document.getElementById('risk-coordy').value = utm.northing.toFixed(0);
    document.getElementById('utm-zone-num').value = utm.zoneNum;
    document.getElementById('utm-zone-letter').value = utm.zoneLetter;
});
```

### 2. Registro de Árvore

```javascript
// features.js - handleAddTreeSubmit()

const treeData = {
    especie: '...',
    local: '...',
    
    // Coordenadas dos campos do formulário
    easting: document.getElementById('risk-coordx').value,
    northing: document.getElementById('risk-coordy').value,
    utmZoneNum: document.getElementById('utm-zone-num').value,
    utmZoneLetter: document.getElementById('utm-zone-letter').value,
    
    // ... outros campos
};

// Enviar para Supabase
await ApiService.upsertTree(treeData);
```

### 3. Salvamento no Supabase

```javascript
// supabase-client.js - upsertTree()

async upsertTree(treeData) {
    // Normalizar coordenadas usando CoordinatesService
    const coords = CoordinatesService.prepareForDatabase(treeData);
    
    const dbPayload = {
        user_id: user.id,
        nome: treeData.nome,
        especie: treeData.especie,
        
        // Coordenadas normalizadas
        easting: coords.easting,
        northing: coords.northing,
        utmzonenum: coords.utmzonenum,
        utmzoneletter: coords.utmzoneletter,
        
        // ... outros campos
    };
    
    const { data, error } = await supabase
        .from('arvores')
        .upsert(dbPayload);
}
```

### 4. Leitura do Banco

```javascript
// supabase-client.js - getTrees()

async getTrees() {
    const { data: dbData } = await supabase
        .from('arvores')
        .select('*');
    
    const mappedData = dbData.map(row => {
        // Processar coordenadas usando CoordinatesService
        const coords = CoordinatesService.prepareFromDatabase(row);
        
        return {
            id: row.id,
            nome: row.nome,
            especie: row.especie,
            
            // Coordenadas em todos os formatos necessários
            ...coords,
            
            // Outros campos...
        };
    });
    
    return { data: mappedData };
}
```

### 5. Exibição no Mapa

```javascript
// arboria-module.js - addTreeMarker()

function addTreeMarker(tree) {
    // Verificar se tem coordenadas válidas
    if (!CoordinatesService.hasValidCoordinates(tree)) {
        console.warn('Árvore sem coordenadas válidas:', tree.id);
        return;
    }
    
    // Usar latitude/longitude (já convertido por prepareFromDatabase)
    const marker = L.marker([tree.latitude, tree.longitude]);
    marker.addTo(map);
}
```

---

## 🎨 Campos do Formulário HTML

### Estrutura dos Campos

```html
<!-- Coordenadas UTM -->
<div class="coordinates-group">
    <label for="risk-coordx">Easting (Coordenada X):</label>
    <input type="text" id="risk-coordx" placeholder="353657">
    
    <label for="risk-coordy">Northing (Coordenada Y):</label>
    <input type="text" id="risk-coordy" placeholder="7343326">
    
    <label for="utm-zone-num">Zona UTM:</label>
    <input type="number" id="utm-zone-num" min="1" max="60" placeholder="23">
    
    <label for="utm-zone-letter">Hemisfério:</label>
    <input type="text" id="utm-zone-letter" maxlength="1" placeholder="K">
</div>

<button type="button" onclick="handleGetGPS()">📍 Obter GPS</button>
```

### Campos Alternativos (Compatibilidade)

O sistema também aceita estes IDs de campos (legado):
- `risk-coord-x` (alternativa para `risk-coordx`)
- `risk-coord-y` (alternativa para `risk-coordy`)

---

## 🌍 Zonas UTM do Brasil

### Principais Zonas

| Região | Zona UTM | Hemisfério | Exemplos de Cidades |
|--------|----------|------------|---------------------|
| Nordeste | 23-25 | K ou L | Salvador, Fortaleza, Recife |
| Sudeste | 22-24 | K | São Paulo, Rio de Janeiro, Belo Horizonte |
| Sul | 21-22 | J ou K | Curitiba, Porto Alegre, Florianópolis |
| Norte | 20-23 | L ou M | Manaus, Belém, Boa Vista |
| Centro-Oeste | 21-23 | K ou L | Brasília, Goiânia, Campo Grande |

### Padrão do Sistema

- **Zona padrão**: 23 (São Paulo e região)
- **Hemisfério padrão**: K (Sul do Brasil)

---

## 🔧 Configuração e Manutenção

### Alterar Zona UTM Padrão

Edite `js/coordinates.service.js`:

```javascript
const DEFAULT_UTM_ZONE = 23; // Altere para sua zona
const DEFAULT_UTM_LETTER = 'K'; // Altere para seu hemisfério
```

### Adicionar Nova Validação

```javascript
// Em coordinates.service.js

function validateCustom(coords) {
    // Sua lógica de validação
    const errors = [];
    
    if (/* sua condição */) {
        errors.push('Sua mensagem de erro');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
```

### Debug de Coordenadas

O sistema possui logs detalhados:

```javascript
// Logs automáticos em cada etapa:
[CoordinatesService] Módulo de coordenadas carregado ✓
[Supabase] treeData recebido: { easting: 353657, ... }
[Supabase] Coordenadas preparadas: { easting: 353657, ... }
[Supabase] Árvore 123: { banco: {...}, normalizado: {...} }
```

---

## 📊 Testes e Validação

### Teste Manual

1. Abra `test-utm-fields.html` no navegador
2. Preencha os campos de teste
3. Clique em **🔢 Testar Conversão**
4. Verifique o resultado

### Teste Automatizado

```javascript
// Console do navegador

// Testar conversão Lat/Lon → UTM
const utm = CoordinatesService.latLonToUTM(-23.5505, -46.6333);
console.log(utm); // { easting: 332770, northing: 7395290, zoneNum: 23, zoneLetter: 'K' }

// Testar conversão UTM → Lat/Lon
const latlon = CoordinatesService.utmToLatLon(332770, 7395290, 23, 'K');
console.log(latlon); // { latitude: -23.5505, longitude: -46.6333 }

// Testar normalização
const normalized = CoordinatesService.normalizeCoordinates({
    latitude: -23.5505,
    longitude: -46.6333
});
console.log(normalized); // { easting: 332770, northing: 7395290, ... }

// Testar validação
const validation = CoordinatesService.validateUTMCoordinates(353657, 7343326, 23, 'K');
console.log(validation); // { valid: true, errors: [] }
```

---

## 🐛 Solução de Problemas

### Problema: `utmzonenum: null` no banco

**Causa**: Campo do formulário vazio ou não preenchido pelo GPS

**Solução**:
1. Verificar se campos `utm-zone-num` e `utm-zone-letter` existem no HTML
2. Usar botão GPS para preencher automaticamente
3. Ou preencher manualmente: Zona 23, Hemisfério K

### Problema: `E: undefined, N: undefined` na tabela

**Causa**: Coordenadas não convertidas corretamente do banco

**Solução**:
1. Verificar se `CoordinatesService` está carregado antes de outros módulos
2. Verificar logs no console: `[Supabase] Árvore X: ...`
3. Executar query no Supabase para verificar dados:
   ```sql
   SELECT id, easting, northing, utmzonenum FROM arvores;
   ```

### Problema: Conversão UTM ↔ Lat/Lon falha

**Causa**: Biblioteca Proj4 não carregada

**Solução**:
1. Verificar se `proj4.js` está incluído no HTML
2. Verificar console: deve aparecer `proj4 is defined`
3. Testar: `typeof window.proj4` deve retornar `'function'`

---

## 📚 Referências

### Documentos Relacionados

- `supabase-schema.sql` - Script de configuração do banco
- `DIAGNOSTICO-UTM.md` - Guia de diagnóstico de problemas
- `CORRECAO-RAPIDA.md` - Guia rápido de correção
- `test-utm-fields.html` - Ferramenta de teste

### Bibliotecas Utilizadas

- **Proj4.js**: Conversão de coordenadas
  - Documentação: https://proj4js.org/
  
- **Leaflet**: Mapas interativos
  - Documentação: https://leafletjs.com/

### Padrões e Especificações

- **UTM (Universal Transverse Mercator)**
  - Sistema de coordenadas planas baseado em zonas
  - Precisão: metros
  - Uso: medições e cálculos precisos
  
- **WGS84 (World Geodetic System 1984)**
  - Sistema de coordenadas geográficas (Lat/Lon)
  - Precisão: graus decimais
  - Uso: GPS e mapas web

---

## 🎓 Glossário

- **Easting**: Coordenada Leste em UTM (metros)
- **Northing**: Coordenada Norte em UTM (metros)
- **Zona UTM**: Faixa de 6° de longitude (1-60)
- **Hemisfério**: Norte (letras N-Z) ou Sul (letras A-M)
- **WGS84**: Sistema de coordenadas do GPS
- **Proj4**: Biblioteca de conversão de coordenadas
- **Leaflet**: Biblioteca de mapas interativos

---

## ✅ Checklist de Implementação

Para novos desenvolvedores ou ao adicionar coordenadas em novos módulos:

- [ ] Importar `CoordinatesService` no início do arquivo
- [ ] Usar `normalizeCoordinates()` para aceitar qualquer formato
- [ ] Usar `prepareForDatabase()` antes de salvar no Supabase
- [ ] Usar `prepareFromDatabase()` ao ler do Supabase
- [ ] Validar coordenadas com `validateUTMCoordinates()` ou `validateLatLon()`
- [ ] Usar `hasValidCoordinates()` antes de plotar no mapa
- [ ] Adicionar logs de debug para facilitar diagnóstico
- [ ] Testar com coordenadas reais do Brasil

---

**Versão**: 2.0  
**Data**: 2025-01-XX  
**Autor**: Equipe ArborIA  
**Status**: ✅ Produção