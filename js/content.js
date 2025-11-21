/**
 * ARBORIA 2.0 - MANUAL CONTENT
 * Versão: v39.0 (Conteúdo Restaurado + Checklist Visual)
 * Adaptado para compatibilidade com a Engine 2.0
 */

// Helper local para imagens dentro do texto
const imgTag = (src, alt) => `<img src="img/${src}" alt="${alt}" class="manual-img" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 20px auto; display: block; max-width: 100%;">`;

// === 1. DADOS DO GLOSSÁRIO (Exportados para uso futuro no TooltipUI) ===
export const glossaryTerms = {
    'colar do galho': 'Zona especializada na base do galho, responsável pela compartimentalização de ferimentos.',
    'crista da casca': 'Elevação cortical paralela ao ângulo de inserção do galho, indicadora da zona de união.',
    'lenho de cicatrização': 'Tecido formado para selar ferimentos, também conhecido como callus.',
    'casca inclusa': 'Tecido cortical aprisionado em uniões de ângulo agudo (ponto fraco).',
    'lenho de reação': 'Madeira com propriedades alteradas por resposta a tensões (compressão ou tração).',
    'gemas epicórmicas': 'Brotos dormentes no tronco ou galhos principais que reagem a estresse ou luz.',
    'entreno': 'Espaço entre dois nós consecutivos no ramo.',
    'no': 'Ponto de inserção de folhas, gemas ou ramos.',
    'lenho': 'Tecido vegetal com função de sustentação e condução de seiva (Xilema).',
    'podao': 'Tesoura de poda de haste longa para alcance elevado.',
    'tesourao-poda': 'Ferramenta para galhos de até 7 cm de diâmetro.',
    'serra-poda': 'Serra com dentes especiais para madeira verde (corte puxando).',
    'motosserra-glossario': 'Equipamento motorizado para corte de galhos grossos e troncos.',
    'motopoda-glossario': 'Ferramenta motorizada com haste telescópica para galhos altos.',
    'podador-bypass-glossario': 'Lâmina deslizante (tipo tesoura) que realiza cortes limpos e precisos.',
    'podador-bigorna': 'Lâmina que pressiona o galho contra superfície plana (esmaga, usar apenas em madeira morta).',
    'hipsometro': 'Instrumento para medir altura de árvores.',
    'poda-conducao': 'Direciona o crescimento da árvore jovem.',
    'poda-formacao': 'Define a estrutura arquitetônica futura da árvore.',
    'poda-limpeza': 'Remove galhos mortos, doentes, quebrados ou mal orientados.',
    'poda-adequacao': 'Adapta a árvore ao espaço urbano, rede elétrica ou edificações.',
    'poda-reducao': 'Diminui o volume da copa para reduzir peso ou arrasto do vento.',
    'poda-emergencia': 'Elimina riscos iminentes (pós-tempestade).',
    'poda-raizes': 'Corte de raízes (deve ser evitada ao máximo; requer laudo técnico).',
    'poda-cabecote': 'Poda severa para estimular brotação (Pollarding) - Técnica específica, não confundir com poda drástica.',
    'poda drástica': 'Corte indiscriminado com remoção total ou parcial da copa (Mutilação/Topping). Crime ambiental em muitos locais.',
    'poda-reducao-garfo': 'Técnica de redução cortando até um ramo lateral (tira-seiva).',
    'corte-rente': 'Corte que remove o colar do galho, causando ferida grande que não cicatriza (Inadequado).',
    'corte-toco': 'Corte que deixa um pedaço de galho sem fluxo de seiva, gerando podridão (Inadequado).',
    'poda-tres-cortes': 'Técnica obrigatória para galhos pesados para evitar o "lascamento" da casca.',
    'desbaste-copa': 'Remoção seletiva de ramos internos para entrada de luz e ar (reduz efeito vela).',
    'elevacao-copa': 'Remoção de galhos inferiores para passagem de pedestres/veículos.',
    'reducao-copa': 'Corte seletivo nas pontas para adequação ao espaço, mantendo a forma natural.',
    'topping': 'Termo em inglês para Poda Drástica (decapeamento).',
    'dap': 'Diâmetro à Altura do Peito (DAP): Medida padrão a 1,30 m do solo.',
    'projecao-copa': 'Área de solo coberta pelo sombreamento da copa (gotejamento).',
    'indice-vitalidade': 'Avaliação do vigor da árvore (folhagem, brotos, cor).',
    'rcr': 'Raio Crítico Radicular (RCR): Área de proteção mínima das raízes para estabilidade.',
    'nivel-1-avaliacao': 'Nível 1: Análise visual rápida (chão ou veículo).',
    'nivel-2-avaliacao': 'Nível 2: Inspeção 360º detalhada com ferramentas simples (martelo, binóculo).',
    'nivel-3-avaliacao': 'Nível 3: Métodos avançados (tomografia, resistografia).',
    'asv': 'Autorização de Supressão de Vegetação: Documento oficial do órgão ambiental.',
    'app': 'Área de Preservação Permanente: Margens de rios, topos de morro, nascentes.',
    'ctf': 'Cadastro Técnico Federal (IBAMA).',
    'art': 'Anotação de Responsabilidade Técnica (CREA/Conselho).',
    'tcra': 'Termo de Compromisso de Recuperação Ambiental.',
    'compensacao-ambiental': 'Plantio ou doação de mudas para repor a supressão.',
    'pnrs': 'Política Nacional de Resíduos Sólidos.',
    'mtr': 'Manifesto de Transporte de Resíduos.',
    'spi q': 'Sistema de Proteção Individual contra Quedas (Linha de vida, cinto, talabarte).'
};

// === 2. DADOS DE EQUIPAMENTOS ===
export const equipmentData = {
    'serrote-manual': { desc: 'Para galhos de 3 a 12 cm. Cortes de precisão e acabamento.', img: 'serrote-manual.jpg' },
    'motosserra': { desc: 'Para galhos > 12 cm e troncos. Uso obrigatório de calça anticorte.', img: 'motosserra.jpg' },
    'motopoda': { desc: 'Haste extensível para podas em altura sem escada (até 4-6m).', img: 'motopoda.jpg' },
    'podador-haste': { desc: 'Tesoura de longo alcance acionada por corda (Podão).', img: 'podao.jpg' },
    'tesoura-poda': { desc: 'Tesourão de duas mãos para galhos até 3-4 cm.', img: 'tesourao-poda.jpg' },
    'podador-bypass': { desc: 'Tesoura de mão (tipo alicate) para ramos finos e verdes.', img: 'tesoura-by-pass.jpg' },
    'podador-comum': { desc: 'Tesoura simples, menos precisa que a bypass.', img: 'podador.jpg' }
};

// === 3. DADOS DE PROPÓSITO ===
export const podaPurposeData = {
    'conducao': { desc: 'Formar o fuste e a estrutura em árvores jovens.', img: 'poda-conducao.jpg' },
    'limpeza': { desc: 'Sanidade: remover o que está morto, doente ou quebrado.', img: 'poda-limpeza.jpg' },
    'correcao': { desc: 'Estrutural: remover codominância, casca inclusa, cruzamentos.', img: 'poda-correcao.jpg' },
    'adequacao': { desc: 'Conflitos: liberar fios, telhados, placas e semáforos.', img: 'poda-adequacao.jpg' },
    'levantamento': { desc: 'Desobstrução: liberar calçada (2,5m) e rua (4,5m).', img: 'poda-levantamento.jpg' },
    'emergencia': { desc: 'Risco Iminente: árvore caindo ou galho pendurado.', img: 'poda-emergencia.jpg' },
    'raizes': { desc: 'NÃO RECOMENDADO. Cortar raízes desestabiliza a árvore.', img: 'poda-raizes-evitar.jpg' }
};

// === 4. DADOS DO CHECKLIST DE RISCO ===
export const checklistData = {
    'galhos-mortos': { desc: 'Galhos secos > 5cm são "Widowmakers" (Fazedores de Viúvas). Risco alto.', img: 'check-galho-morto.jpg' },
    'rachaduras': { desc: 'Fendas profundas indicam falha mecânica iminente no tronco.', img: 'check-rachadura.jpg' },
    'apodrecimento': { desc: 'Cogumelos na base ou tronco indicam madeira oca/podre.', img: 'check-apodrecimento.jpg' },
    'casca-inclusa': { desc: 'União em "V" onde a casca entra na junção, impedindo a fusão da madeira.', img: 'check-casca-inclusa.jpg' },
    'galhos-cruzados': { desc: 'Atrito constante causa feridas que não cicatrizam.', img: 'check-galho-cruzado.jpg' },
    'copa-assimetrica': { desc: 'Peso excessivo em um lado cria alavanca para tombamento.', img: 'check-copa-assimetrica.jpg' },
    'inclinacao': { desc: 'Inclinação nova com solo estufado do lado oposto = Queda Iminente.', img: 'check-inclinacao.jpg' },
    'brotacao-intensa': { desc: 'Muitos brotos no tronco (epicórmicos) indicam estresse severo.', img: 'check-brotacao.jpg' },
    'perda-raizes': { desc: 'Raízes de sustentação cortadas em obras comprometem a ancoragem.', img: 'check-raiz-danificada.jpg' },
    'compactacao': { desc: 'Solo duro/asfaltado até o tronco mata as raízes por asfixia.', img: 'check-compactacao.jpg' }
};

// === 5. CONTEÚDO HTML DO MANUAL (Renderização) ===
export const manualContent = {
    'conceitos-basicos': `
            <h3>💡 Definições, Termos e Técnicas</h3>
            
            <h4>Termos Estruturais e Anatômicos</h4>
            <p>A correta identificação das partes da árvore é vital. O corte deve respeitar a anatomia para permitir a cicatrização.</p>
            <p>Use o <span class="checklist-term" data-term-key="colar do galho">colar do galho</span> e a <span class="checklist-term" data-term-key="crista da casca">crista da casca</span> como guias para o corte perfeito.</p>
            ${imgTag('anatomia-corte.jpg', 'Anatomia correta do corte de galho')}
            <p>Conceitos essenciais para o avaliador:</p>
            <ul>
                <li><span class="checklist-term" data-term-key="lenho de cicatrização">Lenho de cicatrização (Callus)</span>: Resposta da árvore fechando a ferida.</li>
                <li><span class="checklist-term" data-term-key="casca inclusa">Casca inclusa</span>: Defeito estrutural grave em uniões.</li>
                <li><span class="checklist-term" data-term-key="lenho de reação">Lenho de reação</span>: Madeira reforçada que a árvore cria para compensar inclinação.</li>
            </ul>
            
            <h4>Compartimentalização (CODIT)</h4>
            <p>Árvores não "curam" tecidos, elas isolam. O processo de Compartimentalização (CODIT) cria barreiras químicas e físicas para impedir o avanço da podridão após um corte.</p>
            ${imgTag('compartimentalização.jpg', 'Diagrama do processo de compartimentalização')}

            <h4>Instrumentos e Equipamentos</h4>
            <p>A escolha da ferramenta correta evita danos desnecessários (rasgos na casca).</p>
            <ul class="equipment-list">
                <li><span class="checklist-term" data-term-key="serrote-manual">Serrote Manual (Corte limpo)</span></li>
                <li><span class="checklist-term" data-term-key="motosserra">Motosserra (Corte pesado)</span></li>
                <li><span class="checklist-term" data-term-key="motopoda">Motopoda (Alcance)</span></li>
                <li><span class="checklist-term" data-term-key="podador-haste">Podão (Precisão em altura)</span></li>
                <li><span class="checklist-term" data-term-key="tesoura-poda">Tesoura de Poda</span></li>
            </ul>

            <h4>Finalidade da Poda</h4>
            <p>Toda intervenção precisa de um objetivo claro.</p>
            <ul class="purpose-list">
                <li><span class="checklist-term" data-term-key="conducao">Condução</span></li>
                <li><span class="checklist-term" data-term-key="limpeza">Limpeza</span></li>
                <li><span class="checklist-term" data-term-key="correcao">Correção</span></li>
                <li><span class="checklist-term" data-term-key="adequacao">Adequação</span></li>
                <li><span class="checklist-term" data-term-key="levantamento">Levantamento</span></li>
                <li><span class="checklist-term" data-term-key="emergencia">Emergência</span></li>
                <li><span class="checklist-term" data-term-key="raizes">⚠️ Poda de Raízes (Evitar)</span></li>
            </ul>
    `,

    'planejamento-inspecao': `
            <h3>📋 Planejamento e Inspeção de Risco</h3>
            
            <h4>Planejamento da Operação</h4>
            <p>Etapa fundamental para garantir a execução <strong>segura e eficiente</strong>. Antes de ligar a motosserra, avalie o cenário.</p>
            
            <h4>1. Definição do Escopo</h4>
            <ul>
                <li><strong>Local exato:</strong> Área pública, privada, industrial? Há interferências?</li>
                <li><strong>Objetivo:</strong> É poda de limpeza? Supressão por risco? Adequação a rede?</li>
                <li><strong>Alvos:</strong> O que pode ser atingido se a árvore (ou galho) cair errada? (Casas, carros, pessoas).</li>
            </ul>

            <h4>2. Inspeção Visual (VTA)</h4>
            <p>Procure pelos "Sinais de Linguagem Corporal" da árvore. Use os termos abaixo para ver exemplos:</p>
            <ul>
                <li><span class="checklist-term" data-term-key="galhos-mortos">Galhos Mortos Suspensos</span></li>
                <li><span class="checklist-term" data-term-key="rachaduras">Rachaduras no Tronco</span></li>
                <li><span class="checklist-term" data-term-key="apodrecimento">Cogumelos (Apodrecimento)</span></li>
                <li><span class="checklist-term" data-term-key="casca-inclusa">Uniões com Casca Inclusa</span></li>
                <li><span class="checklist-term" data-term-key="inclinacao">Inclinação Recente</span></li>
                <li><span class="checklist-term" data-term-key="perda-raizes">Danos nas Raízes</span></li>
            </ul>

            <h4>3. Classificação de Risco (Matriz)</h4>
            <ul>
                <li><strong>🔴 ALTO RISCO:</strong> Falha provável + Alvo constante. Intervenção em até <strong>48h</strong>.</li>
                <li><strong>🟠 MÉDIO RISCO:</strong> Falha possível + Alvo intermitente. Monitorar ou programar (15-30 dias).</li>
                <li><strong>🟢 BAIXO RISCO:</strong> Defeito leve ou sem alvo. Monitoramento anual.</li>
            </ul>

            <h4>4. Raio Crítico Radicular (RCR)</h4>
            <p>A zona de proteção máxima das raízes. Evite máquinas pesadas nesta área.</p>
            <p><strong><span class="checklist-term" data-term-key="rcr">RCR</span> = 1,5 × <span class="checklist-term" data-term-key="dap">DAP</span> (em metros)</strong>.</p>
    `,

    'autorizacao-legal': `
            <h3>📜 Termos Legais e Autorização (ASV)</h3>
            
            <h4>Licenciamento Ambiental</h4>
            <p>Toda intervenção em vegetação (especialmente nativa ou em área pública) requer anuência do órgão ambiental.</p>
            
            <h4>Documentos Principais</h4>
            <ul>
                <li><strong><span class="checklist-term" data-term-key="asv">ASV (Autorização de Supressão)</span></strong>: O "alvará" para cortar.</li>
                <li><strong><span class="checklist-term" data-term-key="app">APP (Área de Preservação)</span></strong>: Margens de rios e topos de morro. Intervenção restrita.</li>
                <li><strong><span class="checklist-term" data-term-key="art">ART (Resp. Técnica)</span></strong>: O engenheiro assume a responsabilidade pelo laudo.</li>
            </ul>

            <h4>Gestão de Resíduos</h4>
            <ul>
                <li><strong><span class="checklist-term" data-term-key="mtr">MTR (Manifesto de Transporte)</span></strong>: Obrigatório para transportar a madeira/galhos em via pública.</li>
                <li>Atendimento à <strong><span class="checklist-term" data-term-key="pnrs">PNRS</span></strong> (Política Nacional de Resíduos).</li>
            </ul>

            <h4>Quando a ASV pode ser dispensada?</h4>
            <p>Geralmente em casos de <strong>Risco Iminente à Vida</strong> (Defesa Civil), onde a atuação é emergencial. O processo burocrático é feito <em>a posteriori</em>.</p>
    `,

    'preparacao-e-isolamento': `
            <h3>🚧 Preparação do Local e Isolamento</h3>
            
            <h4>Isolamento da Área (Sinalização)</h4>
            <p>O isolamento não é opcional. É a principal barreira entre a operação e o público.</p>
            
            <h4>Cálculo do Perímetro de Segurança</h4>
            ${imgTag('isolamento-perimetro.jpg', 'Diagrama de perímetro de segurança')}
            <ul>
                <li><strong>Para Poda:</strong> Projeção da copa + margem de segurança.</li>
                <li><strong>Para Abate (Supressão):</strong> Altura total da árvore <strong>+ 50%</strong> (Zona de Queda).</li>
            </ul>
            <p><strong>⛔ Proibição:</strong> Nunca usar apenas fita zebrada sem vigilante. A fita não para pessoas.</p>

            <h4>Rede Elétrica</h4>
            <p><strong>É proibido</strong> realizar podas se houver galhos tocando na rede de Média/Alta Tensão sem o desligamento prévio pela concessionária. Risco de arco voltaico.</p>

            <h4>Permissão de Trabalho (PT)</h4>
            <p>Em áreas industriais, a PT e a APR (Análise Preliminar de Risco) devem ser validadas antes do início. Mudou o clima? Parou para almoço? Revalide a PT.</p>
    `,

    'operacoes-e-tecnicas': `
            <h3>✂️ Operações de Poda e Corte</h3>
            
            <h4>Técnicas de Poda Correta</h4>
            <p>O objetivo é remover o galho sem ferir o tronco.</p>
            
            <h4>A Regra dos Três Cortes</h4>
            <p>Essencial para evitar que o galho "descasque" o tronco ao cair.</p>
            ${imgTag('corte-tres-passos.jpg', 'Sequência dos 3 passos para a poda segura')}
            <ol>
                <li><strong>Corte de Alívio (Inferior):</strong> 20-30cm do tronco, de baixo para cima, até 1/3 do diâmetro.</li>
                <li><strong>Corte de Queda (Superior):</strong> Um pouco à frente do primeiro corte, de cima para baixo. O galho cai.</li>
                <li><strong>Corte de Acabamento (Final):</strong> Rente à crista da casca/colar, sem deixar toco e sem ferir o tronco.</li>
            </ol>

            <h4>Práticas Proibidas (Mutilação)</h4>
            <ul>
                <li><span class="checklist-term" data-term-key="poda drástica">Poda Drástica (Topping)</span>: Cortar o topo da árvore indiscriminadamente. Cria brotos fracos e apodrecimento.</li>
                <li><span class="checklist-term" data-term-key="corte-rente">Corte Rente (Flush Cut)</span>: Ferir o colar. Impede a cicatrização.</li>
                <li><span class="checklist-term" data-term-key="corte-toco">Deixar Toco (Stub Cut)</span>: O toco apodrece e leva a doença para dentro do tronco.</li>
            </ul>
            ${imgTag('poda-drastica-vs-correta.jpg', 'Comparação visual: Poda Drástica vs Correta')}

            <h4>Supressão (Abate Direcional)</h4>
            <p>Usar a técnica da cunha (boca) e corte de abate com dobradiça.</p>
            <ul>
                <li><strong>Cunha:</strong> Define a direção (abertura de 45º a 70º).</li>
                <li><strong>Dobradiça:</strong> 10% do diâmetro. É o que segura a árvore durante a queda. Não corte a dobradiça!</li>
            </ul>

            <h4>Segurança: Rotas de Fuga</h4>
            ${imgTag('rota-fuga-45graus.jpg', 'Diagrama das rotas de fuga')}
            <p>O operador deve fugir em ângulo de <strong>45°</strong> para trás da direção de queda. Nunca fique atrás do tronco (coice).</p>
    `,

    'riscos-e-epis': `
            <h3>🛡️ Análise de Risco e EPIs</h3>
            
            <h4>Riscos Críticos na Atividade</h4>
            <p>Motosserra e Altura são uma combinação letal se ignorada.</p>
            <ul>
                <li><strong>Efeito Rebote (Kickback):</strong> A ponta da sabre toca algo e a serra "pula" para o rosto do operador. ${imgTag('perigo-rebote.jpg', 'Diagrama do Efeito Rebote')}</li>
                <li><strong>Queda de Galhos:</strong> "Widowmakers" soltos na copa.</li>
                <li><strong>Choque Elétrico:</strong> Madeira verde conduz eletricidade.</li>
            </ul>

            <h4>Equipamentos de Proteção (EPIs)</h4>
            ${imgTag('epis-motosserra.jpg', 'Operador com EPIs completos')}
            <h4>Para Motosserrista (Obrigatório)</h4>
            <ul>
                <li>Capacete com protetor facial (tela) e auricular.</li>
                <li>Calça com proteção anticorte (fibras que travam a corrente).</li>
                <li>Luvas de proteção.</li>
                <li>Botas com biqueira de aço.</li>
            </ul>

            <h4>Para Trabalho em Altura (SPIQ)</h4>
            <p>Uso de <span class="checklist-term" data-term-key="spi q">SPIQ</span> completo:</p>
            <ul>
                <li>Cinto tipo paraquedista.</li>
                <li>Talabarte de posicionamento.</li>
                <li>Trava-quedas em linha de vida independente.</li>
            </ul>
            <p><strong>⚠️ Proibição:</strong> Escalada livre (sem estar preso) é justa causa/risco de morte.</p>
    `,

    'gestao-e-desmobilizacao': `
            <h3>♻️ Gestão de Resíduos e Desmobilização</h3>
            
            <h4>Gestão de Resíduos (PNRS)</h4>
            <p>O material lenhoso gerado deve ter destinação correta.</p>
            ${imgTag('segregacao-residuos.jpg', 'Segregação de resíduos')}
            <ul>
                <li><strong>Trituração:</strong> Transformar galhos em mulch (adubo) no local.</li>
                <li><strong>Destinação:</strong> Aterros sanitários licenciados ou pátios de compostagem.</li>
                <li><strong>Rastreabilidade:</strong> Emissão de <span class="checklist-term" data-term-key="mtr">MTR</span> para o transporte.</li>
            </ul>

            <h4>Abastecimento e Químicos</h4>
            <p>Evite contaminação do solo com óleo de corrente ou gasolina.</p>
            ${imgTag('abastecimento-seguro.jpg', 'Abastecimento seguro com bacia de contenção')}
            <ul><li>Use bacia de contenção (bandeja) ao abastecer a motosserra.</li><li>Tenha Kit de Mitigação (areia/serragem) à mão.</li></ul>

            <h4>Desmobilização</h4>
            <p>A área só é liberada após limpeza total (varrição) e remoção da sinalização. O responsável técnico deve dar o aceite final.</p>
    `,

    'glossario-geral': `
            <h3>📘 Glossário Geral de Termos</h3>
            <p>Navegue por todos os termos técnicos, legais e de equipamentos usados neste manual, organizados por categoria.</p>
            <table class="glossary-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
                <thead>
                    <tr style="background: #f0f2f5;">
                        <th style="text-align: left; padding: 10px; border-bottom: 2px solid #ddd;">Termo</th>
                        <th style="text-align: left; padding: 10px; border-bottom: 2px solid #ddd;">Definição</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="2" class="glossary-category-header" style="background: #e0f7fa; padding: 8px; font-weight: bold; color: #00796b;">Termos Estruturais e Anatômicos</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Colar do galho</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Zona especializada na base do galho.</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Crista da casca</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Elevação cortical indicadora da zona de união.</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Casca inclusa</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Casca presa dentro da união (defeito).</td></tr>
                    
                    <tr><td colspan="2" class="glossary-category-header" style="background: #e0f7fa; padding: 8px; font-weight: bold; color: #00796b;">Equipamentos</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Motosserra</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Equipamento motorizado para corte pesado.</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Motopoda</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Poda em altura com haste telescópica.</td></tr>
                    
                    <tr><td colspan="2" class="glossary-category-header" style="background: #e0f7fa; padding: 8px; font-weight: bold; color: #00796b;">Legislação</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">ASV</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Autorização de Supressão de Vegetação.</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">MTR</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Manifesto de Transporte de Resíduos.</td></tr>
                </tbody>
            </table>
    `,

    'sobre-autor': `
            <h3>👨‍💻 Sobre o Autor</h3>
            <div id="sobre-o-autor" style="text-align: center; padding: 20px;">    
                <img src="img/autor.jpg" alt="Foto de Rafael de Andrade Ammon" class="manual-img" style="width: 150px; height: 150px; border-radius: 50%; margin: 0 auto 1.5rem auto; display: block; object-fit: cover; border: 4px solid #00796b;">
                <div class="autor-container">
                    <div class="autor-texto">
                        <p><strong>Rafael de Andrade Ammon</strong> é Engenheiro Florestal (UFRRJ), com MBA em Gestão de Projetos (USP/ESALQ).</p>
                        <p>Atualmente atua como Fiscal Operacional em áreas verdes industriais na RPBC (Vinil Engenharia). Experiência no Inventário Florestal Nacional (RJ) e restauração do COMPERJ.</p>
                        <p class="autor-links" style="margin-top: 15px;">
                            <a href="mailto:rafael.ammon@gmail.com" style="color: #0277BD; font-weight: bold;">rafael.ammon@gmail.com</a> <br>
                            <a href="https://www.linkedin.com/in/rafael-andrade-ammon-2527a72a/" target="_blank" style="color: #0077b5; font-weight: bold;">LinkedIn Profile</a>
                        </p>
                    </div>
                </div>
            </div>
    `
};
