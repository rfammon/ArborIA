// js/data-content.js (v19.4)
// Contém os objetos de dados (glossário, equipamentos) e o conteúdo HTML do manual.

// Helper para gerar tags de imagem padronizadas
const imgTag = (src, alt) => `<img src="img/${src}" alt="${alt}" class="manual-img">`;

// 1. Termos do Glossário (Definições Simples)
export const glossaryTerms = {
    'colar do galho': 'Zona especializada na base do galho, responsável pela compartimentalização de ferimentos.',
    'crista da casca': 'Elevação cortical paralela ao ângulo de inserção do galho, indicadora da zona de união.',
    'lenho de cicatrização': 'Tecido formado para selar ferimentos, também conhecido como callus.',
    'casca inclusa': 'Tecido cortical aprisionado em uniões de ângulo agudo.',
    'lenho de reação': 'Madeira com propriedades alteradas por resposta a tensões.',
    'gemas epicórmicas': 'Brotos dormentes no tronco ou galhos principais.',
    'entreno': 'Espaço entre dois nós consecutivos no ramo.',
    'no': 'Ponto de inserção de folhas, gemas ou ramos.',
    'lenho': 'Tecido vegetal com função de sustentação e condução de seiva.',
    'podao': 'Tesoura de poda de haste longa para alcance elevado.',
    'tesourao-poda': 'Ferramenta para galhos de até 7 cm de diâmetro.',
    'serra-poda': 'Serra com dentes especiais para madeira verde.',
    'motosserra-glossario': 'Equipamento motorizado para corte de galhos e troncos.',
    'motopoda-glossario': 'Ferramenta motorizada com haste para galhos altos.',
    'podador-bypass-glossario': 'Lâmina deslizante que realiza cortes limpos.',
    'podador-bigorna': 'Lâmina que pressiona o galho contra superfície plana.',
    'hipsometro': 'Instrumento para medir altura de árvores.',
    'poda-conducao': 'Direciona crescimento da árvore.',
    'poda-formacao': 'Define estrutura arquitetônica futura.',
    'poda-limpeza': 'Remove galhos mortos, doentes ou mal orientados.',
    'poda-adequacao': 'Adapta a árvore ao espaço urbano ou industrial.',
    'poda-reducao': 'Diminui volume da copa.',
    'poda-emergencia': 'Elimina riscos iminentes.',
    'poda-raizes': 'Deve ser evitada; requer profissional habilitado.',
    'poda-cabecote': 'Poda severa para estimular brotação.',
    'poda drástica': 'Corte indiscriminado com remoção total ou parcial da copa (não recomendada).',
    'poda-reducao-garfo': 'Preserva estrutura natural.',
    'corte-rente': 'Remove o colar do galho (inadequado).',
    'corte-toco': 'Retarda cicatrização.',
    'poda-tres-cortes': 'Técnica que preserva tecidos vitais.',
    'desbaste-copa': 'Remoção seletiva para luz e ventilação.',
    'elevacao-copa': 'Remoção de galhos inferiores.',
    'reducao-copa': 'Corte seletivo para adequação ao espaço.',
    'topping': 'Sinônimo de Poda Drástica.',
    'dap': 'Diâmetro à Altura do Peito (DAP): Medida padrão a 1,30 m do solo.',
    'projecao-copa': 'Área de sombreamento da copa.',
    'indice-vitalidade': 'Avaliação do estado fitossanitário.',
    'rcr': 'Raio Crítico Radicular (RCR): Área de influência e sustentação mecânica das raízes.',
    'nivel-1-avaliacao': 'Nível 1: Análise visual.',
    'nivel-2-avaliacao': 'Nível 2: Inspeção 360º.',
    'nivel-3-avaliacao': 'Nível 3: Métodos avançados para avaliar defeitos.',
    'asv': 'Autorização de Supressão de Vegetação (ASV): Documento emitido pelo órgão ambiental competente que autoriza o corte ou supressão de vegetação nativa ou árvores isoladas, mediante justificativa técnica e compensação ambiental.',
    'app': 'Área de Preservação Permanente (APP): Espaço protegido por lei, com função ambiental de preservar recursos hídricos, biodiversidade e estabilidade geológica. Intervenções são permitidas apenas em casos de utilidade pública, interesse social ou baixo impacto ambiental.',
    'ctf': 'Cadastro Técnico Federal (CTF): Registro obrigatório no IBAMA para pessoas físicas ou jurídicas que realizam atividades potencialmente poluidoras ou utilizadoras de recursos naturais.',
    'art': 'Anotação de Responsabilidade Técnica (ART): Documento que formaliza a responsabilidade técnica de um profissional habilitado sobre determinado serviço ou estudo ambiental.',
    'tcra': 'Termo de Compromisso de Recuperação Ambiental (TCRA): Instrumento legal que formaliza a obrigação de compensação ambiental por meio de ações de recuperação ou preservação.',
    'compensacao-ambiental': 'Medida obrigatória para mitigar os impactos causados pela supressão de vegetação, podendo incluir restauração ecológica, preservação de áreas remanescentes ou compensação em propriedades de terceiros.',
    'pnrs': 'Política Nacional de Resíduos Sólidos (PNRS): Lei nº 12.305/2010 que estabelece diretrizes para o manejo adequado dos resíduos sólidos, incluindo os gerados por poda e corte de árvores.',
    'mtr': 'Manifesto de Transporte de Resíduos (MTR): Documento que garante a rastreabilidade dos resíduos desde a origem até a destinação final, exigido em operações de transporte de resíduos sólidos.',
    'spi q': 'Sistema de Proteção Individual contra Quedas.'
};

// 2. Dados de Equipamentos (com imagens)
export const equipmentData = {
    'serrote-manual': {
        desc: 'Utilizado para galhos com diâmetro entre 3 e 12 cm. Permite cortes precisos em locais de difícil acesso.',
        img: 'serrote-manual.jpg'
    },
    'motosserra': {
        desc: 'Recomendada para galhos com diâmetro superior a 12 cm e para supressão de árvores. Exige treinamento e EPIs específicos devido ao alto risco.',
        img: 'motosserra.jpg'
    },
    'motopoda': {
        desc: 'Ferramenta com haste extensível que alcança até 6 metros, ideal para podar galhos altos sem a necessidade de escadas ou plataformas.',
        img: 'motopoda.jpg'
    },
    'podador-haste': {
        desc: 'Semelhante à motopoda em funcionalidade de longo alcance, mas operado manually, oferecendo precisão em galhos finos e médios em altura.',
        img: 'podao.jpg'
    },
    'tesoura-poda': {
        desc: 'Utilizada para galhos com diâmetro de 3 a 7 cm. Ideal para cortes limpos e rápidos em ramos mais finos.',
        img: 'tesourao-poda.jpg'
    },
    'podador-bypass': {
        desc: 'Específico para galhos com até 3 a 7 cm de diâmetro. Seu mecanismo de "tesoura" garante um corte limpo que minimiza danos ao tecido vegetal.',
        img: 'tesoura-by-pass.jpg'
    },
    'podador-comum': {
        desc: 'Para galhos com até 3 a 7 cm de diâmetro. Versátil para a maioria das podas leves e médias.',
        img: 'podador.jpg'
    }
};

// 3. Finalidade da Poda
export const podaPurposeData = {
    'conducao': {
        desc: 'Direcionar eixo de crescimento, remover ramos baixos/indesejáveis.',
        img: 'poda-conducao.jpg'
    },
    'limpeza': {
        desc: 'Remover ramos mortos, secos, doentes, parasitas, tocos - Risco sanitário e queda.',
        img: 'poda-limpeza.jpg'
    },
    'correcao': {
        desc: 'Remover ramos com defeito estrutural (cruzados, codominantes, V) - Com objetivo de aumentar a estabilidade do indivíduo.',
        img: 'poda-correcao.jpg'
    },
    'adequacao': {
        desc: 'Resolver conflitos com estruturas urbanas/edificações. Priorizar realocação de equipamentos quando possível.',
        img: 'poda-adequacao.jpg'
    },
    'levantamento': {
        desc: 'Remover ramos baixos para desobstrução. Podar apenas o mínimo necessário. Diâmetro máximo: 1/3 do ramo origem. Evitar excesso e desbalanceamento da copa.',
        img: 'poda-levantamento.jpg'
    },
    'emergencia': {
        desc: 'Risco iminente (quedas de pós-evento climático). Minimizar danos futuros quando possível.',
        img: 'poda-emergencia.jpg'
    },
    'raizes': {
        desc: 'Este tipo de poda deve ser evitado por causar perda estrutural na árvore e aumentar o risco de queda. Sempre que possível, alternativas devem ser estudadas. Para realizar a poda de raízes sempre consulte um profissional habilitado.',
        img: 'poda-raizes-evitar.jpg'
    }
};

// 4. Conteúdo HTML do Manual (Estrutura Principal)
export const manualContent = {
    'conceitos-basicos': {
        titulo: '💡 Definições, Termos e Técnicas',
        html: `
            <h3>Termos Estruturais e Anatômicos</h3>
            <p>A correta identificação das partes da árvore é vital. Use o <span class="glossary-term" data-term-key="colar do galho">colar do galho</span> e a <span class="glossary-term" data-term-key="crista da casca">crista da casca</span> como guias.</p>
            ${imgTag('anatomia-corte.jpg', 'Anatomia correta do corte de galho')}
            <p>Termos como <span class="glossary-term" data-term-key="lenho de cicatrização">lenho de cicatrização</span>, <span class="glossary-term" data-term-key="casca inclusa">casca inclusa</span> e <span class="glossary-term" data-term-key="lenho de reação">lenho de reação</span> são importantes para a inspeção.</p>
            
            <h3>Compartimentalização de Árvores</h3>
            <p>As árvores possuem defesas naturais que protegem cortes e ferimentos, como os causados pela poda. Na casca, os ferimentos formam uma camada protetora chamada periderme necrofilática, que impede a entrada de microrganismos. Na madeira, ocorre um processo chamado compartimentalização, que isola a área danificada para evitar que o problema se espalhe pelo restante da árvore.</p>
            ${imgTag('compartimentalização.jpg', 'Diagrama do processo de compartimentalização')}
            
            <h3>Instrumentos e Equipamentos</h3>
            <ul class="equipment-list">
                <li><span class="equipment-term" data-term-key="serrote-manual">Serrote Manual</span></li>
                <li><span class="equipment-term" data-term-key="motosserra">Motosserra</span></li>
                <li><span class="equipment-term" data-term-key="motopoda">Motopoda</span></li>
                <li><span class="equipment-term" data-term-key="podador-haste">Podador de Haste Manual (Podão)</span></li>
                <li><span class="equipment-term" data-term-key="tesoura-poda">Tesoura de Poda (Tesourão)</span></li>
                <li><span class="equipment-term" data-term-key="podador-bypass">Podador Manual Bypass</span></li>
                <li><span class="equipment-term" data-term-key="podador-comum">Podador Manual Comum</span></li>
            </ul>

            <h3>Finalidade da Poda</h3>
            <ul class="purpose-list">
                <li><span class="purpose-term" data-term-key="conducao">Condução</span></li>
                <li><span class="purpose-term" data-term-key="limpeza">Limpeza</span></li>
                <li><span class="purpose-term" data-term-key="correcao">Correção</span></li>
                <li><span class="purpose-term" data-term-key="adequacao">Adequação</span></li>
                <li><span class="purpose-term" data-term-key="levantamento">Levantamento</span></li>
                <li><span class="purpose-term" data-term-key="emergencia">Emergência</span></li>
                <li><span class="purpose-term" data-term-key="raizes">⚠️ Poda de Raízes (Evitar)</span></li>
            </ul>
        `
    },
    'planejamento-inspecao': {
        titulo: '📋 Planejamento e Inspeção',
        html: `
            <h3>Planejamento</h3>
            <p>Etapa fundamental para garantir a execução <strong>segura e eficiente</strong>.</p>
            
            <h4>Definição do Local, Escopo e Objetivo da Poda e Corte</h4>
            <ul>
                <li>Identificar o local exato da intervenção, considerando áreas industriais, administrativas ou públicas.</li>
                <li>Definir o escopo da atividade: poda, corte total, levantamento de copa, adequação urbana, entre outros.</li>
                <li>Estabelecer o objetivo técnico da intervenção, como condução, limpeza, correção estrutural, adequação ou emergência.</li>
                <li>Selecionar previamente os galhos e troncos a serem removidos, respeitando critérios técnicos e fitossanitários.</li>
            </ul>
            <h4>Finalidade da Poda</h4>
            <ul><li><strong>Limpeza:</strong> Remover ramos mortos/secos.</li><li><strong>Correção:</strong> Remover ramos com defeito estrutural (ex: <span class="glossary-term" data-term-key="casca inclusa">casca inclusa</span>). ${imgTag('uniao-v-casca-inclusa.jpg', 'União em V com casca inclusa')}</li><li><strong>Adequação:</strong> Resolver conflitos com estruturas.</li><li><strong>⚠️ Poda de Raízes:</strong> Deve ser <strong>evitada</strong>.</li></ul>
            <h4>Inspeção Visual Expedita</h4>
            <p>Foco nos riscos críticos:</p>
            <ul><li>Fendas horizontais.</li><li>Presença de <strong>carpóforos (cogumelos)</strong>. ${imgTag('sinal-podridao.jpg', 'Cogumelos indicando apodrecimento')}</li><li>Galhos mortos > 5 cm.</li><li>Uniões em “V” com <span class="glossary-term" data-term-key="casca inclusa">casca inclusa</span>.</li></ul>
            <h4>Classificação de Risco</h4>
            <ul><li><strong>🔴 ALTO RISCO:</strong> Intervenção em até <strong>48h</strong>.</li><li><strong>🟠 MÉDIO RISCO:</strong> Intervenção em até <strong>15 dias</strong>.</li><li><strong>🟢 BAIXO RISCO:</strong> Monitoramento anual.</li></ul>
            <h4>Raio Crítico Radicular (RCR)</h4>
            <p><strong><span class="glossary-term" data-term-key="rcr">RCR</span> = 1,5 × <span class="glossary-term" data-term-key="dap">DAP</span></strong>.</p>
        `
    },
    'autorizacao-legal': {
        titulo: '📜 Termos Legais e Autorização (ASV)',
        html: `
            <h3>Termos Legais e Normativos</h3>
            <ul>
                <li><strong><span class="glossary-term" data-term-key="asv">ASV</span> (Autorização de Supressão de Vegetação)</strong></li>
                <li><strong><span class="glossary-term" data-term-key="app">APP</span> (Área de Preservação Permanente)</strong></li>
                <li><strong><span class="glossary-term" data-term-key="art">ART</span> (Anotação de Responsabilidade Técnica)</strong></li>
                <li><strong><span class="glossary-term" data-term-key="mtr">MTR</span> (Manifesto de Transporte de Resíduos)</strong> - (Vide <span class="glossary-term" data-term-key="pnrs">PNRS</span>).</li>
            </ul>
            <h3>Licenciamento da Atividade (ASV)</h3>
            <p>Toda intervenção deve ter anuência do setor de meio ambiente.</p>
            <h4>Dispensa de Autorização:</h4>
            <ul><li>Indivíduos com <span class="glossary-term" data-term-key="dap">DAP</span> < 0,05 m <strong>fora</strong> de <span class="glossary-term" data-term-key="app">APP</span>.</li><li>Risco iminente (Defesa Civil) - processo *a posteriori*.</li></ul>
        `
    },
    'preparacao-e-isolamento': {
        titulo: '🚧 Preparação do Local e Isolamento',
        html: `
            <h3>Isolamento e Sinalização</h3>
            <p>O isolamento é <strong>obrigatório</strong>.</p>
            <h4>Delimitação do Perímetro de Exclusão (Raio de Perigo)</h4>
            ${imgTag('isolamento-perimetro.jpg', 'Diagrama de perímetro de segurança')}
            <ul><li><strong>Galhos isolados:</strong> Comprimento do galho <strong>+ 50%</strong>.</li><li><strong>Árvore inteira:</strong> Altura total <strong>+ 50%</strong>.</li></ul>
            <p><strong>⛔ Proibição:</strong> Uso de fita zebrada (salvo emergências).</p>
            <h3>Desligamento de Linhas de Energia</h3>
            <p><strong>É proibido</strong> realizar podas em contato com redes ativas.</p>
            <h3>Liberação de Permissão de Trabalho (PT)</h3>
            <p>A PT é <strong>obrigatória</strong>. Qualquer alteração no escopo exige <strong>revalidação da PT</strong>.</p>
        `
    },
    'operacoes-e-tecnicas': {
        titulo: '✂️ Operações de Poda e Corte',
        html: `
            <h3>Técnicas de Poda</h3>
            <ul><li><strong>Desbaste da copa:</strong> Limite de <strong>até 25% da copa viva</strong> por intervenção.</li><li><strong>Elevação da copa:</strong> Manter pelo menos <strong>2/3 da altura total</strong> com copa viva.</li><li><strong>Redução da copa:</strong> Preservar ramos laterais com diâmetro <strong>≥ 1/3</strong> do ramo removido.</li></ul>
            <h4>Técnica de Corte: Poda em Três Cortes</h4>
            ${imgTag('corte-tres-passos.jpg', 'Sequência dos 3 passos para a poda segura')}
            <p>Aplicar o método para preservar <span class="glossary-term" data-term-key="crista da casca">crista da casca</span> e <span class="glossary-term" data-term-key="colar do galho">colar do galho</span>:</p>
            <ol><li><strong>Corte inferior (alívio):</strong> Fora do colar.</li><li><strong>Corte superior:</strong> Destaca o galho.</li><li><strong>Corte de acabamento:</strong> Rente à crista, preservando o colar.</li></ol>
            <p><strong>⛔ Práticas Proibidas:</strong></p>
            <ul>
                <li><span class="glossary-term" data-term-key="poda drástica">Poda drástica</span> (<span class="glossary-term" data-term-key="topping">topping</span>). ${imgTag('topping-errado.jpg', 'Exemplo de Poda Drástica')}</li>
                <li>Cortes rentes. ${imgTag('corte-rente-lesao.jpg', 'Lesão por corte rente')}</li>
            </ul>
            ${imgTag('poda-drastica-vs-correta.jpg', 'Comparação visual: Poda Drástica vs Correta')}
            <h3>Supressão (Corte de Árvore)</h3>
            <p>Corte direcional deixando a <strong>"dobradiça" de 10%</strong> do diâmetro.</p>
            <h4>Segurança Crítica: Rota de Fuga</h4>
            ${imgTag('rota-fuga-45graus.jpg', 'Diagrama das rotas de fuga')}
            <p>Planejar <strong>duas rotas de fuga</strong> livres (ângulo de <strong>45°</strong>).</p>
            <h4>Atenção a Troncos Tensionados</h4>
            ${imgTag('corte-tronco-tensionado.jpg', 'Técnica de corte em tronco tensionado')}
            <h4>Efeito Rebote (Motosserra)</h4>
            ${imgTag('perigo-rebote.jpg', 'Diagrama do Efeito Rebote')}
            <p>Ocorre ao usar a ponta superior do sabre. <strong>NUNCA use a ponta superior da lâmina para cortar.</strong></p>
        `
    },
    'riscos-e-epis': {
        titulo: '🛡️ Análise de Risco e EPIs',
        html: `
            <h3>Análise de Risco (Perigos Recorrentes)</h3>
            <p>Queda de altura, Queda de ferramentas, Choque elétrico, Corte, Efeito Rebote.</p>
            <h3>Equipamento de Proteção Individual (EPIs)</h3>
            ${imgTag('epis-motosserra.jpg', 'Operador com EPIs completos')}
            <h4>EPIs Anticorte e Impacto</h4>
            <ul><li>Capacete com jugular</li><li>Calça/Blusão/Luva de motosserista</li><li>Viseira/protetor facial</li><li>Perneira</li></ul>
            <h4>EPIs para Trabalho em Altura (SPIQ)</h4>
            <p>Uso de <span class="glossary-term" data-term-key="spi q">SPIQ</span> (Cinto, Talabarte, Trava-queda).</p>
            <p><strong>⚠️ Proibição:</strong> <strong>escalada livre</strong> ou ancoragem nos galhos a serem cortados.</p>
        `
    },
    'gestao-e-desmobilizacao': {
        titulo: '♻️ Gestão de Resíduos e Desmobilização',
        html: `
            <h3>Gestão de Resíduos Arbóreos (PNRS)</h3>
            ${imgTag('segregacao-residuos.jpg', 'Segregação de resíduos')}
            <ul><li><strong>Princípios:</strong> Não geração, redução, reutilização e reciclagem.</li><li><strong>Rastreabilidade:</strong> Emissão de <span class="glossary-term" data-term-key="mtr">Manifesto de Transporte de Resíduos (MTR)</span>.</li></ul>
            <h4>Abastecimento Seguro</h4>
            ${imgTag('abastecimento-seguro.jpg', 'Abastecimento seguro com bacia de contenção')}
            <ul><li>Realizar em área ventilada, com <strong>bacia de contenção</strong> e <strong>Kit de Mitigação Ambiental</strong>.</li></ul>
            <h3>Desmobilização</h3>
            <p>Remover todos os resíduos. Retirar isolamento <strong>somente após liberação formal</strong> do responsável técnico.</p>
        `
    },
    'glossario-geral': {
        titulo: '📘 Glossário Geral de Termos',
        html: `
            <p>Navegue por todos os termos técnicos, legais e de equipamentos usados neste manual, organizados por categoria.</p>
            <table class="glossary-table">
                <thead>
                    <tr>
                        <th>Termo</th>
                        <th>Definição</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="2" class="glossary-category-header">Termos Estruturais e Anatômicos</td></tr>
                    <tr><td>Colar do galho</td><td>Zona especializada na base do galho, responsável pela compartimentalização de ferimentos.</td></tr>
                    <tr><td>Crista da casca</td><td>Elevação cortical paralela ao ângulo de inserção do galho, indicadora da zona de união.</td></tr>
                    <tr><td>Lenho de cicatrização</td><td>Tecido formado para selar ferimentos, também conhecido como callus.</td></tr>
                    <tr><td>Casca inclusa</td><td>Tecido cortical aprisionado em uniões de ângulo agudo.</td></tr>
                    <tr><td>Lenho de reação</td><td>Madeira com propriedades alteradas por resposta a tensões.</td></tr>
                    <tr><td>Gemas epicórmicas</td><td>Brotos dormentes no tronco ou galhos principais.</td></tr>
                    <tr><td>Entrenó</td><td>Espaço entre dois nós consecutivos no ramo.</td></tr>
                    <tr><td>Nó</td><td>Ponto de inserção de folhas, gemas ou ramos.</td></tr>
                    <tr><td>Lenho</td><td>Tecido vegetal com função de sustentação e condução de seiva.</td></tr>
                    
                    <tr><td colspan="2" class="glossary-category-header">Instrumentos e Equipamentos</td></tr>
                    <tr><td>Podão</td><td>Tesoura de poda de haste longa para alcance elevado.</td></tr>
                    <tr><td>Tesourão de poda</td><td>Ferramenta para galhos de até 7 cm de diâmetro.</td></tr>
                    <tr><td>Serra de poda</td><td>Serra com dentes especiais para madeira verde.</td></tr>
                    <tr><td>Motosserra</td><td>Equipamento motorizado para corte de galhos e troncos.</td></tr>
                    <tr><td>Motopoda</td><td>Ferramenta motorizada com haste para galhos altos.</td></tr>
                    <tr><td>Podador manual tipo bypass</td><td>Lâmina deslizante que realiza cortes limpos.</td></tr>
                    <tr><td>Podador tipo bigorna</td><td>Lâmina que pressiona o galho contra superfície plana.</td></tr>
                    <tr><td>Hipsômetro</td><td>Instrumento para medir altura de árvores.</td></tr>
                    
                    <tr><td colspan="2" class="glossary-category-header">Técnicas de Poda</td></tr>
                    <tr><td>Poda de condução</td><td>Direciona crescimento da árvore.</td></tr>
                    <tr><td>Poda de formação</td><td>Define estrutura arquitetônica futura.</td></tr>
                    <tr><td>Poda de limpeza</td><td>Remove galhos mortos, doentes ou mal orientados.</td></tr>
                    <tr><td>Poda de adequação</td><td>Adapta a árvore ao espaço urbano ou industrial.</td></tr>
                    <tr><td>Poda de redução</td><td>Diminui volume da copa.</td></tr>
                    <tr><td>Poda de emergência</td><td>Elimina riscos iminentes.</td></tr>
                    <tr><td>Poda de raízes</td><td>Deve ser evitada; requer profissional habilitado.</td></tr>
                    <tr><td>Poda em cabeçote</td><td>Poda severa para estimular brotação.</td></tr>
                    <tr><td>Poda drástica</td><td>Corte indiscriminado com remoção total ou parcial da copa (não recomendada).</td></tr>
                    <tr><td>Poda de redução por corte no garfo</td><td>Preserva estrutura natural.</td></tr>
                    <tr><td>Corte rente</td><td>Remove o colar do galho (inadequado).</td></tr>
                    <tr><td>Corte com toco</td><td>Retarda cicatrização.</td></tr>
                    <tr><td>Poda em três cortes</td><td>Técnica que preserva tecidos vitais.</td></tr>
                    <tr><td>Desbaste da copa</td><td>Remoção seletiva para luz e ventilação.</td></tr>
                    <tr><td>Elevação da copa</td><td>Remoção de galhos inferiores.</td></tr>
                    <tr><td>Redução da copa</td><td>Corte seletivo para adequação ao espaço.</td></tr>

                    <tr><td colspan="2" class="glossary-category-header">Parâmetros de Avaliação</td></tr>
                    <tr><td>Diâmetro à Altura do Peito (DAP)</td><td>Medida padrão a 1,30 m do solo.</td></tr>
                    <tr><td>Projeção da copa</td><td>Área de sombreamento da copa.</td></tr>
                    <tr><td>Índice de vitalidade</td><td>Avaliação do estado fitossanitário.</td></tr>
                    <tr><td>Raio Crítico Radicular (RCR)</td><td>Área de influência e sustentação mecânica das raízes.</td></tr>
                    <tr><td>Nível 1 (Avaliação de Árvores)</td><td>Análise visual.</td></tr>
                    <tr><td>Nível 2 (Avaliação de Árvores)</td><td>Inspeção 360º.</td></tr>
                    <tr><td>Nível 3 (Avaliação de Árvores)</td><td>Métodos avançados para avaliar defeitos.</td></tr>

                    <tr><td colspan="2" class="glossary-category-header">Termos Legais e Normativos</td></tr>
                    <tr><td>ASV (Autorização de Supressão de Vegetação)</td><td>Documento emitido pelo órgão ambiental competente que autoriza o corte ou supressão de vegetação nativa ou árvores isoladas, mediante justificativa técnica e compensação ambiental.</td></tr>
                    <tr><td>APP (Área de Preservação Permanente)</td><td>Espaço protegido por lei, com função ambiental de preservar recursos hídricos, biodiversidade e estabilidade geológica. Intervenções são permitidas apenas em casos de utilidade pública, interesse social ou baixo impacto ambiental.</td></tr>
                    <tr><td>CTF (Cadastro Técnico Federal)</td><td>Registro obrigatório no IBAMA para pessoas físicas ou jurídicas que realizam atividades potencialmente poluidoras ou utilizadoras de recursos naturais.</td></tr>
                    <tr><td>ART (Anotação de Responsabilidade Técnica)</td><td>Documento que formaliza a responsabilidade técnica de um profissional habilitado sobre determinado serviço ou estudo ambiental.</td></tr>
                    <tr><td>TCRA (Termo de Compromisso de Recuperação Ambiental)</td><td>Instrumento legal que formaliza a obrigação de compensação ambiental por meio de ações de recuperação ou preservação.</td></tr>
                    <tr><td>Compensação Ambiental</td><td>Medida obrigatória para mitigar os impactos causados pela supressão de vegetação, podendo incluir restauração ecológica, preservação de áreas remanescentes ou compensação em propriedades de terceiros.</td></tr>
                    <tr><td>PNRS (Política Nacional de Resíduos Sólidos)</td><td>Lei nº 12.305/2010 que estabelece diretrizes para o manejo adequado dos resíduos sólidos, incluindo os gerados por poda e corte de árvores.</td></tr>
                    <tr><td>MTR (Manifesto de Transporte de Resíduos)</td><td>Documento que garante a rastreabilidade dos resíduos desde a origem até a destinação final, exigido em operações de transporte de resíduos sólidos.</td></tr>
                </tbody>
            </table>
        `
    },
    'sobre-autor': {
        titulo: '👨‍💻 Sobre o Autor',
        html: `
            <div id="sobre-o-autor">    
                <div class="autor-container">
                    <div class="autor-texto">
                        <p>
                            <strong>Rafael de Andrade Ammon</strong> é Engenheiro Florestal (UFRRJ),
                            com MBA em Gestão de Projetos (USP/ESALQ) em curso. A sua carreira
                            foca-se na conservação ambiental, restauração florestal e
                            sustentabilidade corporativa.
                        </p>
                        <p>
                            Atualmente, atua como Fiscal Operacional em áreas verdes industriais
                            na RPBC (pela Vinil Engenharia). Possui experiência em projetos
                            de grande escala, como o Inventário Florestal Nacional (RJ) e a
                            restauração do COMPERJ, tendo trabalhado em empresas como EGIS
                            e CTA Meio Ambiente.
                        </p>
                        <p>
                            É certificado em Google Project Management e pela ABRAPLAN,
                            com competências em Geoprocessamento (QGIS) e Power BI.
                            Fluente em inglês.
                        </p>
                        <p class="autor-links">
                            <a href="mailto:rafael.ammon@gmail.com">rafael.ammon@gmail.com</a> |    
                            <a href="https://www.linkedin.com/in/rafael-andrade-ammon-2527a72a/" target="_blank">LinkedIn</a>
                        </p>
                    </div>
                </div>
            </div>
        `
    },

    // HTML da Calculadora (View completa)
    'calculadora-risco': {
        titulo: '📊 Calculadora de Risco Arbóreo',
        html: `
            <p>Use o mapa para visualização geoespacial do risco, a aba "Registrar" para coleta e "Resumo" para gerenciar os dados.</p>
            
            <nav class="sub-nav">
                <button type="button" class="sub-nav-btn" data-target="tab-content-register">
                    Registrar Árvore
                </button>
                <button type="button" class="sub-nav-btn" data-target="tab-content-summary">
                    Resumo da Vistoria <span id="summary-badge" class="badge"></span>
                </button>
                <button type="button" class="sub-nav-btn" data-target="tab-content-mapa">
                    Mapa GIS 🗺️
                </button>
            </nav>

            <div id="tab-content-register" class="sub-tab-content">
                <form id="risk-calculator-form">
                    <fieldset class="risk-fieldset">
                        <legend>1. Identificação da Árvore</legend>
                        <div class="form-grid">
                            <div>
                                <label for="risk-data">Data da Coleta:</label>
                                <input type="date" id="risk-data" name="risk-data" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div>
                                <label for="risk-especie">Espécie (Nome/Tag):</label>
                                <input type="text" id="risk-especie" name="risk-especie" required>
                            </div>
                            <div>
                                <label for="risk-local">Local (Endereço/Setor):</label>
                                <input type="text" id="risk-local" name="risk-local">
                            </div>
                            <div>
                                <label for="risk-coord-x">Coord. X (UTM ou Lon):</label>
                                <input type="text" id="risk-coord-x" name="risk-coord-x">
                            </div>
                            <div>
                                <label for="risk-coord-y">Coord. Y (UTM ou Lat):</label>
                                <input type="text" id="risk-coord-y" name="risk-coord-y">
                            </div>
                            <div class="gps-button-container">
                                <button type="button" id="get-gps-btn">🛰️ Capturar GPS</button>
                                <span id="gps-status"></span>
                            </div>
                            <div>
                                <label for="risk-dap">DAP (cm):</label>
                                <input type="number" id="risk-dap" name="risk-dap" min="0" step="any">
                            </div>
                            <div>
                                <label for="risk-avaliador">Avaliador:</label>
                                <input type="text" id="risk-avaliador" name="risk-avaliador">
                            </div>
                        </div>
                        <div>
                            <label for="risk-obs">Observações (Opcional):</label>
                            <textarea id="risk-obs" name="risk-obs" rows="3" placeholder="Ex: Cavidade no tronco, presença de pragas, galho sobre telhado..."></textarea>
                        </div>

                        <div class="photo-upload-container">
                            <label for="tree-photo-input" class="photo-btn">📷 Adicionar Foto</label>
                            <input type="file" id="tree-photo-input" accept="image/*" capture="environment" style="display: none;">
                            
                            <div id="photo-preview-container">
                                <button type="button" id="remove-photo-btn" style="display:none;">&times;</button>
                            </div>
                        </div>
                        
                    </fieldset>
                    
                    <fieldset class="risk-fieldset">
                        <legend>2. Lista de Verificação de Risco</legend>
                        <table class="risk-table">
                            <thead>
                                <tr><th>Nº</th><th>Pergunta</th><th>Peso</th><th>Sim</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>1</td><td>Há galhos mortos com diâmetro superior a 5 cm?</td><td>3</td><td><input type="checkbox" class="risk-checkbox" data-weight="3"></td></tr>
                                <tr><td>2</td><td>Existem rachaduras ou fendas no tronco ou galhos principais?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                                <tr><td>3</td><td>Há sinais de apodrecimento (madeira esponjosa, fungos, cavidades)?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                                <tr><td>4</td><td>A árvore possui uniões em “V” com casca inclusa?</td><td>4</td><td><input type="checkbox" class="risk-checkbox" data-weight="4"></td></tr>
                                <tr><td>5</td><td>Há galhos cruzados ou friccionando entre si?</td><td>2</td><td><input type="checkbox" class="risk-checkbox" data-weight="2"></td></tr>
                                <tr><td>6</td><td>A árvore apresenta copa assimétrica (>30% de desequilíbrio)?</td><td>2</td><td><input type="checkbox" class="risk-checkbox" data-weight="2"></td></tr>
                                <tr><td>7</td><td>Há sinais de inclinação anormal ou recente?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                                <tr><td>8</td><td>A árvore está próxima a vias públicas ou áreas de circulação?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                                <tr><td>9</td><td>Há risco de queda sobre edificações, veículos ou pessoas?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                                <tr><td>10</td><td>A árvore interfere em redes elétricas ou estruturas urbanas?</td><td>4</td><td><input type="checkbox" class="risk-checkbox" data-weight="4"></td></tr>
                                <tr><td>11</td><td>A espécie é conhecida por apresentar alta taxa de falhas?</td><td>3</td><td><input type="checkbox" class="risk-checkbox" data-weight="3"></td></tr>
                                <tr><td>12</td><td>A árvore já sofreu podas drásticas ou brotação epicórmica intensa?</td><td>3</td><td><input type="checkbox" class="risk-checkbox" data-weight="3"></td></tr>
                                <tr><td>13</td><td>Há calçadas rachadas ou tubulações expostas próximas à base?</td><td>3</td><td><input type="checkbox" class="risk-checkbox" data-weight="3"></td></tr>
                                <tr><td>14</td><td>Há perda visível de raízes de sustentação (>40%)?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                                <tr><td>15</td><td>Há sinais de compactação ou asfixia radicular?</td><td>3</td><td><input type="checkbox" class="risk-checkbox" data-weight="3"></td></tr>
                                <tr><td>16</td><td>Há apodrecimento em raízes primárias (>3 cm)?</td><td>5</td><td><input type="checkbox" class="risk-checkbox" data-weight="5"></td></tr>
                            </tbody>
                        </table>
                        <div class="mobile-checklist-wrapper">
                            <div class="mobile-checklist-card"></div>
                            <div class="mobile-checklist-nav">
                                <button type="button" id="checklist-prev">❮ Anterior</button>
                                <span class="checklist-counter">1 / 16</span>
                                <button type="button" id="checklist-next">Próxima ❯</button>
                            </div>
                        </div>
                    </fieldset>
                    
                    <div class="risk-buttons-area">
                        <button type="submit" id="add-tree-btn">➕ Adicionar Árvore</button>
                        <button type="button" id="reset-risk-form-btn">Limpar Campos</button>
                    </div>
                </form>
            </div>
            
            <div id="tab-content-summary" class="sub-tab-content">
                <fieldset class="risk-fieldset">
                    <legend>3. Árvores Cadastradas</legend>
                    
                    <div class="table-filter-container">
                        <input type="text" id="table-filter-input" placeholder="🔎 Filtrar por ID, espécie, local, risco...">
                    </div>
                    
                    <div id="summary-table-container">
                        <p id="summary-placeholder">Nenhuma árvore cadastrada ainda.</p>
                    </div>
                    
                    <div id="import-export-controls" class="risk-buttons-area">
                        
                        <input type="file" id="zip-importer" accept=".zip,application/zip,application/x-zip-compressed" style="display: none;">
                        <input type="file" id="csv-importer" accept="text/csv,application/csv,application/vnd.ms-excel,.csv,text/plain" style="display: none;">
                        
                        <button type="button" id="import-data-btn" class="export-btn zip-import-label">📤 Importar Dados</button>
                        <button type="button" id="export-data-btn" class="export-btn">📥 Exportar Dados</button>
                        
                        <button type="button" id="send-email-btn" class="export-btn">📧 Enviar por Email</button>
                        <button type="button" id="clear-all-btn" class="export-btn">🗑️ Limpar Tabela</button>
                    </div>
                    
                    <div id="zip-status" style="display: none;">
                        <span class="spinner" style="display: inline-block;"></span>
                        <span id="zip-status-text" style="margin-left: 10px; font-weight: bold; color: #004d40;">Processando pacote...</span>
                    </div>

                </fieldset>
            </div>
            
            <div id="tab-content-mapa" class="sub-tab-content mapa-tab">
                <fieldset class="risk-fieldset">
                    <legend>Mapa de Localização e Risco</legend>
                    <div id="map-container"></div>
                    
                    <div class="form-grid" style="margin-top: 15px; gap: 10px;">
                        <div>
                            <label for="default-utm-zone">Zona UTM Padrão (Ex: 23K):</label>
                            <input type="text" id="default-utm-zone" placeholder="Ex: 23K" style="height: 38px;">
                            <small style="color: #555; font-size: 0.8em;">(Necessário para dados antigos ou importados)</small>
                        </div>
                        <button type="button" id="zoom-to-extent-btn" class="export-btn">📍 Aproximar dos Pontos</button>
                    </div>

                    <p style="margin-top: 15px; font-size: 0.9em; color: #555;">
                        Simbologia: <span style="color: #C62828; font-weight: bold;">🔴 Alto Risco</span> | 
                        <span style="color: #E65100; font-weight: bold;">🟠 Médio Risco</span> | 
                        <span style="color: #2E7D32; font-weight: bold;">🟢 Baixo Risco</span>
                    </p>
                </fieldset>
            </div>
        `
    }
};

// 5. Adaptador de Compatibilidade para Tooltips (Cria glossaryData dinamicamente)
// Isso permite que tooltip.ui.js continue funcionando esperando objetos {title, description}
export const glossaryData = Object.fromEntries(
    Object.entries(glossaryTerms).map(([key, value]) => [
        key,
        { 
            title: key.charAt(0).toUpperCase() + key.slice(1), // Capitaliza o título
            description: value 
        }
    ])
);
