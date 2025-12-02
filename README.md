# ArborIA 2.0 - Backend de Imagens

Este documento detalha a arquitetura e a implementação do backend de armazenamento e gerenciamento de fotos para o projeto ArborIA.

## Visão Geral

O sistema de imagens foi projetado para permitir que os usuários façam o upload de fotos associadas a cada árvore registrada. O backend lida com a compressão, armazenamento e gerenciamento de metadados de forma segura e eficiente, utilizando o ecossistema Supabase.

## Fase 1: Análise

A análise do projeto existente revelou uma aplicação web single-page construída com HTML, CSS e JavaScript modular. A aplicação já utilizava o Supabase para autenticação e como banco de dados (PostgreSQL), o que tornou o Supabase a escolha natural para a expansão do backend. A segurança de dados é gerenciada através de RLS (Row Level Security) do PostgreSQL, uma prática que foi mantida e estendida para a nova funcionalidade de imagens.

## Fase 2: Planejamento e Arquitetura

### 1. Método de Compressão

- **Tecnologia Escolhida:** **WebP**
- **Justificativa:** O WebP foi escolhido por oferecer uma excelente relação entre alta qualidade de compressão e redução significativa do tamanho do arquivo. É amplamente suportado pelos navegadores modernos e possui bibliotecas de processamento maduras e eficientes, sendo ideal para otimizar o armazenamento e a velocidade de entrega das imagens.
- **Implementação:** A compressão é realizada no lado do servidor (server-side) para garantir consistência e não sobrecarregar o dispositivo do usuário. Foi utilizada a biblioteca `deno-imagescript` dentro de uma Supabase Edge Function.

### 2. Arquitetura de Armazenamento (Supabase)

- **Banco de Dados:** Uma nova tabela, `arvore_imagens`, foi criada para armazenar os metadados das imagens. Esta tabela tem um relacionamento de um-para-muitos com a tabela `arvores`.
  - **Schema `arvore_imagens`:**
    - `id` (UUID): Chave primária.
    - `arvore_id` (UUID): Chave estrangeira para `arvores.id`.
    - `user_id` (UUID): Chave estrangeira para `auth.users.id`.
    - `storage_path` (TEXT): Caminho para o arquivo no Supabase Storage.
    - `...outros_metadados` (tamanho, tipo MIME, etc.).
  - **Segurança:** Políticas de RLS foram aplicadas para garantir que um usuário só possa acessar os metadados das imagens de suas próprias árvores.

- **Armazenamento de Arquivos (Storage):**
  - **Bucket:** Um bucket público chamado `arvore-imagens` foi criado.
  - **Organização:** Os arquivos são armazenados com um caminho estruturado para evitar conflitos e organizar os dados: `{user_id}/{arvore_id}/{image_uuid}.webp`.
  - **Segurança:** Embora o bucket seja tecnicamente público, o acesso aos arquivos só é possível conhecendo o caminho completo, que inclui UUIDs não sequenciais. A lógica da aplicação depende da consulta à tabela `arvore_imagens` (protegida por RLS) para construir as URLs de acesso, funcionando como um controle de acesso indireto.

### 3. Fluxos de Backend e API

- **Endpoint:** Foi criado um único endpoint de backend através de uma Supabase Edge Function.
  - **Função:** `image-upload`
  - **URL:** `POST /functions/v1/image-upload`
  - **Autorização:** A função exige um token JWT de usuário do Supabase no cabeçalho `Authorization`.

- **Fluxo de Upload:**
  1. O frontend envia a imagem e o `arvore_id` para a Edge Function.
  2. A função valida o token do usuário e verifica se ele é o proprietário da árvore.
  3. A imagem é lida, redimensionada para um máximo de 1200px de largura e comprimida para o formato WebP.
  4. O arquivo WebP resultante é carregado para o bucket `arvore-imagens`.
  5. Um novo registro com os metadados da imagem é inserido na tabela `arvore_imagens`.
  6. A coluna `hasphoto` na tabela `arvores` é marcada como `true`.
  7. A função retorna os metadados da imagem como confirmação.

- **Fluxo de Recuperação:**
  1. O frontend solicita os metadados da imagem da tabela `arvore_imagens`.
  2. O RLS garante que apenas os dados do usuário logado sejam retornados.
  3. O frontend usa o `storage_path` retornado para construir uma URL pública para a imagem.
  4. A URL é usada no atributo `src` de uma tag `<img>` para exibição.

## Fase 3: Execução e Configuração

### 1. Configuração do Banco de Dados
Para criar a tabela `arvore_imagens` e suas políticas de segurança, execute o script SQL contido no arquivo `setup_images_table.sql` no Editor de SQL do seu projeto Supabase.

### 2. Configuração do Backend
O código do backend está localizado em `supabase/functions/image-upload/index.ts`.

**Para implantar:**
1. **Instale a CLI do Supabase:** `npm install -g supabase`
2. **Faça o login:** `supabase login`
3. **Vincule o projeto:** `supabase link --project-ref YOUR-PROJECT-ID`
4. **Defina os segredos (secrets):** No terminal, na raiz do projeto, execute:
   ```bash
   supabase secrets set SUPABASE_URL="URL_DO_SEU_PROJETO_SUPABASE"
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="SUA_CHAVE_SERVICE_ROLE"
   ```
   (Encontre essas chaves em **Configurações do Projeto > API** no seu painel Supabase.)
5. **Implante a função:**
   ```bash
   supabase functions deploy image-upload --no-verify-jwt
   ```

### 3. Modificações no Frontend
- **`js/supabase-client.js`:** Foi adicionada a função `uploadImage` ao `ApiService` para encapsular a chamada à Edge Function.
- **`js/calculator.form.ui.js`:** A lógica de otimização de imagem no lado do cliente foi removida.
- **`js/features_patch.js`:** A lógica de submissão do formulário foi atualizada para chamar `ApiService.uploadImage` após o registro bem-sucedido dos dados da árvore.

## Conclusão

O sistema implementado cumpre os requisitos de upload, compressão e armazenamento de imagens de forma segura e eficiente, integrando-se perfeitamente à infraestrutura Supabase existente do projeto ArborIA.
