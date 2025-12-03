# 🧪 Teste da Nova Arquitetura de Coordenadas

## ⚡ Teste Rápido (5 minutos)

### Passo 1: Executar Script SQL no Supabase ⏱️ 2 min

1. Acesse: https://mbfouxrinygecbxmjckg.supabase.co
2. Vá em **SQL Editor** → **New Query**
3. Abra `setup_database.sql` (versão atualizada)
4. Copie TODO o conteúdo e cole no editor
5. Execute (Run/Ctrl+Enter)

✅ **Confirmação**: Execute esta query para verificar:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'arvores'
  AND column_name IN ('easting', 'northing', 'utmzonenum', 'utmzoneletter', 'avaliador', 'nome')
ORDER BY column_name;
```

Deve retornar 6 linhas com todas as colunas.

---

### Passo 2: Recarregar Aplicação ⏱️ 30 seg

1. Abra o ArborIA no navegador
2. Pressione **Ctrl+Shift+R** (hard reload)
3. Abra o Console (F12)

✅ **Confirmação**: Verifique estas mensagens no console:

```
[CoordinatesService] Módulo de coordenadas carregado ✓
✓ Supabase Client inicializado
```

---

### Passo 3: Testar GPS ⏱️ 1 min

1. No formulário de registro, clique em **📍 Obter GPS**
2. Permita acesso à localização
3. Aguarde até aparecer as coordenadas

✅ **Confirmação**: Verifique no console:

```javascript
[DEBUG GPS] Coordenadas UTM preenchidas:
{
  zoneNum: 23,
  zoneLetter: "K",
  easting: "353657",
  northing: "7343326",
  fieldValues: {
    utmNumField: "23",
    utmLetterField: "K"
  }
}
```

✅ **Confirmação Visual**: Campos preenchidos:
- Easting: 353657 (ou similar)
- Northing: 7343326 (ou similar)
- Zona UTM: 23
- Hemisfério: K

---

### Passo 4: Registrar Árvore ⏱️ 1 min

1. Preencha os campos obrigatórios:
   - Espécie: "Teste Arquitetura"
   - Local: "Teste"
   - Avaliador: "Sistema"
2. Clique em **Adicionar Árvore**

✅ **Confirmação**: Verifique no console:

```javascript
[DEBUG features.js] treeData antes de enviar:
{
  easting: "353657",
  northing: "7343326",
  utmZoneNum: "23",
  utmZoneLetter: "K"
}

[Supabase] treeData recebido: { ... }
[Supabase] Coordenadas preparadas: {
  easting: 353657,
  northing: 7343326,
  utmzonenum: 23,
  utmzoneletter: "K"
}

✓ Árvore salva no Supabase: [id]
```

---

### Passo 5: Verificar Resultado ⏱️ 30 seg

1. Verifique a tabela de árvores
2. A nova árvore deve aparecer com coordenadas válidas

✅ **Confirmação Visual**:
```
Espécie: Teste Arquitetura
Coordenadas: E: 353657
             N: 7343326
```

✅ **Confirmação no Supabase**: Execute no SQL Editor:

```sql
SELECT 
    id,
    nome,
    especie,
    easting,
    northing,
    utmzonenum,
    utmzoneletter,
    avaliador,
    created_at
FROM public.arvores
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado**:
```
easting:       353657 (ou similar, NÃO pode ser 0 ou NULL)
northing:      7343326 (ou similar, NÃO pode ser 0 ou NULL)
utmzonenum:    23 (NÃO pode ser NULL) ← CRÍTICO
utmzoneletter: K (NÃO pode ser NULL) ← CRÍTICO
```

---

## 🎯 Checklist de Validação

Marque cada item conforme completar:

### Banco de Dados
- [ ] Script SQL executado sem erros
- [ ] Coluna `avaliador` existe
- [ ] Coluna `nome` existe  
- [ ] Coluna `easting` existe
- [ ] Coluna `northing` existe
- [ ] Coluna `utmzonenum` existe (tipo INTEGER)
- [ ] Coluna `utmzoneletter` existe (tipo VARCHAR)

### Aplicação Carregada
- [ ] Console mostra: `[CoordinatesService] Módulo de coordenadas carregado ✓`
- [ ] Console mostra: `✓ Supabase Client inicializado`
- [ ] Não há erros em vermelho no console
- [ ] Formulário de registro visível

### GPS Funcionando
- [ ] Botão GPS clicável
- [ ] Navegador pede permissão de localização
- [ ] Campos preenchidos automaticamente
- [ ] Campo Easting tem valor numérico
- [ ] Campo Northing tem valor numérico
- [ ] Campo Zona UTM tem valor (1-60)
- [ ] Campo Hemisfério tem letra (A-Z)

### Registro de Árvore
- [ ] Log mostra `treeData antes de enviar` com valores válidos
- [ ] Log mostra `Coordenadas preparadas` com valores válidos
- [ ] Log mostra `utmzonenum: 23` (não null)
- [ ] Log mostra `utmzoneletter: "K"` (não null)
- [ ] Log mostra `✓ Árvore salva no Supabase`
- [ ] Não há erro `Could not find the 'avaliador' column`
- [ ] Não há erro `Could not find the 'nome' column`

### Visualização
- [ ] Árvore aparece na tabela
- [ ] Coordenadas aparecem como `E: [número], N: [número]`
- [ ] NÃO aparece `E: undefined, N: undefined`
- [ ] NÃO aparece `E: 0, N: 0`

### Banco de Dados Final
- [ ] Query SQL retorna registro
- [ ] `easting` tem valor válido (não 0, não NULL)
- [ ] `northing` tem valor válido (não 0, não NULL)
- [ ] `utmzonenum` tem valor válido (não NULL) ← **CRÍTICO**
- [ ] `utmzoneletter` tem valor válido (não NULL) ← **CRÍTICO**

---

## ✅ Resultado Esperado

Se todos os itens do checklist foram marcados:

**🎉 SUCESSO! A nova arquitetura está funcionando corretamente.**

---

## ❌ Problemas Comuns

### Problema 1: `utmzonenum: null` ainda persiste

**Diagnóstico**: Verifique os logs:

```javascript
[DEBUG features.js] treeData antes de enviar:
{
  utmZoneNum: "",  ← VAZIO!
  utmZoneLetter: ""
}
```

**Causa**: Campos do formulário não foram preenchidos.

**Solução**:
1. Verifique se existe `<input id="utm-zone-num">` no HTML
2. Use o botão GPS
3. Ou preencha manualmente: 23 e K

---

### Problema 2: Erro `CoordinatesService is not defined`

**Diagnóstico**: Console mostra erro vermelho.

**Causa**: Módulo não carregado ou carregado após outros módulos.

**Solução**:
1. Verifique `index.html`:
   ```html
   <script type="module" src="js/coordinates.service.js?v=2.0"></script>
   ```
2. Deve estar ANTES de `supabase-client.js`
3. Force reload: Ctrl+Shift+R

---

### Problema 3: GPS não preenche zona UTM

**Diagnóstico**: Campos Easting/Northing preenchidos, mas zona fica vazia.

**Causa**: Conversão Lat/Lon → UTM falhou.

**Solução**:
1. Verifique se `proj4.js` está carregado
2. Console: `typeof window.proj4` deve retornar `'function'`
3. Se não, adicione no HTML:
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js"></script>
   ```

---

### Problema 4: Erro `Column 'avaliador' not found`

**Diagnóstico**: Erro 400 ao salvar árvore.

**Causa**: Script SQL não executou corretamente.

**Solução**:
1. Execute novamente o script `setup_database.sql`
2. Ou execute manualmente:
   ```sql
   ALTER TABLE public.arvores ADD COLUMN IF NOT EXISTS avaliador TEXT;
   ALTER TABLE public.arvores ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT 'Nome não especificado';
   ```

---

## 🔬 Testes Avançados

### Teste 1: Conversão Manual

No console do navegador:

```javascript
// Testar Lat/Lon → UTM (São Paulo)
const utm = CoordinatesService.latLonToUTM(-23.5505, -46.6333);
console.log(utm);
// Esperado: { easting: ~332770, northing: ~7395290, zoneNum: 23, zoneLetter: "K" }

// Testar UTM → Lat/Lon
const latlon = CoordinatesService.utmToLatLon(332770, 7395290, 23, 'K');
console.log(latlon);
// Esperado: { latitude: ~-23.5505, longitude: ~-46.6333 }
```

### Teste 2: Normalização

```javascript
// Testar normalização com Lat/Lon
const norm1 = CoordinatesService.normalizeCoordinates({
    latitude: -23.5505,
    longitude: -46.6333
});
console.log(norm1);
// Esperado: { easting, northing, zoneNum: 23, zoneLetter: "K" }

// Testar normalização com UTM
const norm2 = CoordinatesService.normalizeCoordinates({
    easting: 353657,
    northing: 7343326,
    utmZoneNum: 23,
    utmZoneLetter: 'K'
});
console.log(norm2);
// Esperado: mesmos valores de entrada
```

### Teste 3: Validação

```javascript
// Validar UTM correto
const v1 = CoordinatesService.validateUTMCoordinates(353657, 7343326, 23, 'K');
console.log(v1);
// Esperado: { valid: true, errors: [] }

// Validar UTM incorreto
const v2 = CoordinatesService.validateUTMCoordinates(0, 0, 99, 'X');
console.log(v2);
// Esperado: { valid: false, errors: [...] }
```

### Teste 4: Importação CSV

1. Crie arquivo `teste.csv`:
```csv
ID;Data;Especie;CoordX;CoordY;ZonaN;ZonaL;DAP;Altura;Local;Avaliador;Pontos;Risco_Inicial;Risco_Residual;Acao_Mitigadora;Obs;Fatores;Foto
1;2025-01-15;Teste CSV;353657;7343326;23;K;50;15;Teste;Sistema;10;Baixo;Baixo;Nenhuma;Teste;1,2,3;Nao
```

2. Use a função de importação
3. Verifique se a zona UTM foi importada corretamente

---

## 📊 Monitoramento Contínuo

### Logs a Observar

**Inicialização**:
```
✓ Supabase Client inicializado
[CoordinatesService] Módulo de coordenadas carregado ✓
```

**Captura GPS**:
```
[DEBUG GPS] Coordenadas UTM preenchidas: { zoneNum: 23, zoneLetter: "K", ... }
```

**Registro**:
```
[Supabase] treeData recebido: { ... }
[Supabase] Coordenadas preparadas: { utmzonenum: 23, ... }
✓ Árvore salva no Supabase: [uuid]
```

**Leitura**:
```
[Supabase] Árvore [id]: { banco: {...}, normalizado: {...} }
✓ [N] árvores carregadas do Supabase
```

### Métricas de Sucesso

Todas as árvores devem ter:
- ✅ `easting` > 0
- ✅ `northing` > 0
- ✅ `utmzonenum` entre 1-60
- ✅ `utmzoneletter` não null

Query de verificação:
```sql
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN utmzonenum IS NULL THEN 1 END) as sem_zona,
    COUNT(CASE WHEN easting = 0 THEN 1 END) as sem_coordenadas
FROM public.arvores;
```

**Resultado esperado**:
- `total`: número de árvores
- `sem_zona`: 0 ← **DEVE SER ZERO**
- `sem_coordenadas`: 0 ← **DEVE SER ZERO**

---

## 📞 Suporte

Se após seguir todos os passos ainda houver problemas:

1. ✅ Copie TODOS os logs do console
2. ✅ Execute e copie resultado:
   ```sql
   SELECT id, easting, northing, utmzonenum, utmzoneletter 
   FROM arvores 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. ✅ Tire screenshot do formulário preenchido
4. ✅ Verifique `DIAGNOSTICO-UTM.md` para mais detalhes

---

**Versão**: 2.0  
**Tempo estimado**: 5 minutos  
**Dificuldade**: ⭐ Fácil  
**Última atualização**: 2025-01-XX