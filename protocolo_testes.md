# 🌲 Protocolo de Vistoria e Testes - ArborIA 2.0
Este documento define o algoritmo de verificação que deve ser executado pelo Agente após QUALQUER implementação de feature ou correção de bug.

## 1. Princípios de Execução
- **Non-Breaking Change:** A nova implementação não pode quebrar funcionalidades antigas (Regressão).
- **Simulação Lógica:** Como não há ambiente de E2E configurado, você deve simular o fluxo de dados e a lógica de estado passo-a-passo.
- **Segurança:** Nunca exponha dados sensíveis ou crie loops infinitos.

## 2. O Algoritmo de Teste (Checklist)

### Fase A: Integridade Estrutural (Raízes)
1. [ ] **Linting:** Verifique se há erros de sintaxe JS ou tags HTML não fechadas.
2. [ ] **Referências:** Confirme se todos os IDs chamados no JS (ex: `document.getElementById`) existem no `index.html` atual.
3. [ ] **Console:** Garanta que não há `console.log` de debug esquecidos ou erros vermelhos previstos na inicialização.

### Fase B: Teste de Funcionalidades Críticas (O Tronco)

#### 📐 Feature: Clinômetro (`#clinometer-view`)
- **Cenário:** Usuário abre o clinômetro, aponta para base e topo.
- **Verificação Lógica:**
  - A função de cálculo trigonométrico está recebendo a distância correta?
  - O acesso à câmera (`navigator.mediaDevices.getUserMedia`) está sendo solicitado corretamente?
  - O botão "Salvar Altura" preenche o input `#risk-altura` no formulário principal?

#### 📏 Feature: Estimador de DAP (`#dap-estimator-view`)
- **Cenário:** Usuário define a distância e marca as bordas da árvore.
- **Verificação Lógica:**
  - A lógica de conversão pixel-para-cm considera a distância informada?
  - O resultado sobrescreve o input `#risk-dap` corretamente?

#### 📊 Feature: Calculadora de Risco (`#risk-calculator-form`)
- **Cenário:** Usuário preenche o formulário manual.
- **Verificação Lógica:**
  - O botão "Registrar Árvore" valida os campos obrigatórios (Espécie, Altura)?
  - Os dados são salvos corretamente no `localStorage` ou banco simulado?
  - A tabela de resumo (`#summary-table-container`) atualiza após o registro?

#### 🗺️ Feature: Mapa (`#map-container`)
- **Cenário:** Usuário visualiza as árvores cadastradas.
- **Verificação Lógica:**
  - O container do mapa tem altura definida no CSS (sem isso o Leaflet quebra)?
  - Os marcadores estão sendo plotados com as coordenadas Lat/Long corretas?

### Fase C: Testes de "Clima Extremo" (Edge Cases)
1. [ ] **Input Zero/Negativo:** O que acontece se a distância no clinômetro for 0 ou negativa? (Deve bloquear ou alertar).
2. [ ] **Texto em Campo Numérico:** O sistema trata se o usuário digitar "dez" em vez de "10"?
3. [ ] **Sem Permissão de Câmera:** O app exibe um alerta amigável se o vídeo falhar?

## 3. Relatório de Saída
Após a análise, o Agente deve fornecer:
1. **Status:** [APROVADO / REPROVADO / APROVADO COM RESSALVAS]
2. **Logs de Simulação:** Breve descrição do teste mental realizado.
3. **Correções Aplicadas:** Lista do que foi ajustado automaticamente.