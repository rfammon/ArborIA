/**
 * loader.js
 * 
 * Este script garante que o DOM esteja completamente carregado antes de importar
 * e executar o módulo principal da aplicação (main.js).
 * Isso ajuda a prevenir erros de "race condition" onde o JS tenta manipular
 * elementos HTML que ainda não existem.
 */
document.addEventListener('DOMContentLoaded', () => {
    import('./main.js?v=2.0').catch(err => {});
});