// Importa as ferramentas necessárias (o "kit de campo")
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 1. CONFIGURAÇÃO DA PORTARIA (CORS)
// O '*' permite que tanto o localhost quanto o seu site público "ArborIA 2.0" acessem a função.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 2. RESPOSTA AO RÁDIO DO GUARDA (Preflight / OPTIONS)
  // Quando o navegador pergunta "Posso mandar?", respondemos "Sim" imediatamente.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 3. RECEBIMENTO DA AMOSTRA (Arquivo)
    // Lê o formulário enviado pelo caminhão (Frontend)
    const formData = await req.formData()
    const file = formData.get('file')

    // Se não tiver árvore no caminhão, rejeita a carga.
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Nenhum arquivo enviado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 4. AUTENTICAÇÃO NO SISTEMA (Banco de Dados)
    // Aqui usamos a chave que renomeamos para SERVICE_ROLE_KEY
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '' // <--- Atenção: Usando o nome correto sem prefixo SUPABASE_
    )

    // 5. ARMAZENAMENTO NO GALPÃO (Bucket)
    // Criamos um nome único usando a data/hora para evitar que uma foto sobrescreva outra.
    // Ex: 1735660000_ipe-roxo.jpg
    const fileName = `${Date.now()}_${(file as File).name}`

    // Envia para o bucket 'arvore-imagens'
    const { data, error } = await supabase.storage
      .from('arvore-imagens')
      .upload(fileName, file, {
        contentType: (file as File).type,
        upsert: false // false = não substitui se já existir (segurança)
      })

    // Se o funcionário do galpão relatar erro, avisamos o motorista.
    if (error) throw error

    // 6. RECIBO DE ENTREGA (Sucesso)
    // Retorna os dados da imagem salva e o link público (se necessário futuramente)
    const imageUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/arvore-imagens/${fileName}`

    return new Response(
      JSON.stringify({ 
        message: 'Upload realizado com sucesso - ArborIA 2.0', 
        path: data.path,
        fullUrl: imageUrl
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    // 7. RELATÓRIO DE INCIDENTE (Erro)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})