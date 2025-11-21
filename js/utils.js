/**
 * ARBORIA 2.0 - UTILS
 * Funções utilitárias globais e Feedback de UI
 */

/**
 * Exibe uma notificação flutuante (Toast) na tela.
 * @param {string} message - O texto a ser exibido.
 * @param {string} type - O tipo de alerta: 'info', 'success', 'error' ou 'warning'.
 */
export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    
    // Segurança: se o elemento não existir no HTML, para aqui.
    if (!toast) {
        console.warn("Elemento #toast-notification não encontrado.");
        return;
    }

    // 1. Limpa classes anteriores para evitar conflito (ex: de erro para sucesso)
    // Mantém apenas a classe base se ela existir no CSS, ou define do zero.
    toast.className = 'toast'; 

    // 2. Força um "Reflow" do navegador. 
    // Truque crucial: isso reinicia a animação CSS se o toast já estiver visível.
    void toast.offsetWidth;

    // 3. Adiciona as classes de estilo e visibilidade
    // As classes .toast-success, .toast-error, etc., estão no 01_components.helpers.css
    toast.classList.add(`toast-${type}`);
    toast.classList.add('show');
    
    // 4. Define o texto
    toast.textContent = message;

    // 5. Timer para esconder automaticamente após 3.5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para o padrão brasileiro (DD/MM/AAAA).
 * Útil para relatórios e visualização.
 */
export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Ajusta timezone se necessário ou usa UTC para evitar problemas de dia anterior
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const offsetDate = new Date(date.getTime() + userTimezoneOffset);
        return offsetDate.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
}

/**
 * Gera um ID único simples (UUID v4 simulado).
 * Útil para criar IDs de árvores se o banco de dados não gerar.
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Cria um atraso (delay) em funções assíncronas.
 * @param {number} ms - Milissegundos
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
