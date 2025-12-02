import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript/mod.ts';

// Definição dos cabeçalhos CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:5500', // Priorizar para desenvolvimento
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400', // Cache de 24 horas para preflight
};

serve(async (req: Request) => {
  // Trata a requisição OPTIONS para o CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // 1. EXTRAÇÃO DE DADOS
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const arvoreId = formData.get('arvore_id') as string;

    if (!imageFile || !arvoreId) {
      return new Response(JSON.stringify({ error: 'Faltando arquivo de imagem ou ID da árvore.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 2. AUTENTICAÇÃO E AUTORIZAÇÃO
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Cabeçalho de autorização ausente.');
    }
    
    const { data: { user } } = await supabaseAdminClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Token de usuário inválido.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 3. VALIDAÇÃO DE PROPRIEDADE
    const { data: arvoreData, error: arvoreError } = await supabaseAdminClient
      .from('arvores')
      .select('id')
      .eq('id', arvoreId)
      .eq('user_id', user.id)
      .single();

    if (arvoreError || !arvoreData) {
      return new Response(JSON.stringify({ error: 'Acesso negado ou árvore não encontrada.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    
    // 4. PROCESSAMENTO DA IMAGEM
    const originalBuffer = await imageFile.arrayBuffer();
    const originalImage = await Image.decode(originalBuffer);
    
    originalImage.resize(1200, Image.RESIZE_AUTO);

    const compressedImage = await originalImage.encode(0.8); // Codifica para WebP com 80% de qualidade

    // 5. UPLOAD PARA O STORAGE
    const imageId = crypto.randomUUID();
    const storagePath = `${user.id}/${arvoreId}/${imageId}.webp`;

    const { error: uploadError } = await supabaseAdminClient.storage
      .from('arvore-imagens')
      .upload(storagePath, compressedImage, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 6. INSERÇÃO DE METADADOS
    const originalSizeKb = Math.round(originalBuffer.byteLength / 1024);
    const compressedSizeKb = Math.round(compressedImage.byteLength / 1024);

    const metadata = {
      id: imageId,
      arvore_id: arvoreId,
      user_id: user.id,
      storage_path: storagePath,
      original_filename: imageFile.name,
      mime_type: 'image/webp',
      original_size_kb: originalSizeKb,
      compressed_size_kb: compressedSizeKb,
    };

    const { error: insertError } = await supabaseAdminClient
      .from('arvore_imagens')
      .insert(metadata);

    if (insertError) throw insertError;

    // 7. ATUALIZAÇÃO DA ÁRVORE PRINCIPAL
    await supabaseAdminClient
      .from('arvores')
      .update({ hasphoto: true })
      .eq('id', arvoreId);

    // 8. RETORNO DE SUCESSO
    return new Response(JSON.stringify({ success: true, metadata }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
