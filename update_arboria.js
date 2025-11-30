const fs = require('fs');
const path = 'js/arboria-module.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Inject Buttons HTML into renderTreeList
const oldRenderStart = `function renderTreeList(trees) {`;
const newRenderStart = `function renderTreeList(trees) {
    // Navigation Buttons (Added via update script)
    const navHeader = \`
        <div style="padding: 1rem 1rem 0 1rem;">
            <div class="risk-buttons-area" style="display: flex; gap: 10px; margin-bottom: 5px;">
                <button id="btn-nav-table" class="btn btn-primary" style="flex: 1; font-size: 0.85rem; padding: 10px;">
                    <span style="margin-right:5px;">📋</span> Tabela (Resumo)
                </button>
                <button id="btn-nav-calc" class="btn btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 10px;">
                    <span style="margin-right:5px;">🔙</span> Voltar ao Cadastro
                </button>
            </div>
        </div>
    \`;
`;

// Replace the function start
content = content.replace(oldRenderStart, newRenderStart);

// Inject navHeader into return statements
// Case 1: Empty list
const oldEmptyReturn = `return \`
        <div style="text-align: center; padding: 2rem;">`;
const newEmptyReturn = `return \`
        \${navHeader}
        <div style="text-align: center; padding: 2rem;">`;

content = content.replace(oldEmptyReturn, newEmptyReturn);

// Case 2: Full list return
const oldFullReturn = `return \`
    <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
        \${cards}
    </div>
\`;`;

const newFullReturn = `return \`
        \${navHeader}
        <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
            \${cards}
        </div>
    \`;`;

content = content.replace(oldFullReturn, newFullReturn);


// 2. Inject Listeners into bindEvents
const oldBindStart = `if (state.view === 'LIST') {`;
const newBindStart = `if (state.view === 'LIST') {
        // --- BUTTONS LISTENERS ---
        const btnTable = $('#btn-nav-table');
        if (btnTable) {
            btnTable.addEventListener('click', () => {
                const navBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
                if (navBtn) navBtn.click();
                setTimeout(() => {
                    const tabBtn = document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]');
                    if (tabBtn) tabBtn.click();
                }, 100);
            });
        }
        const btnCalc = $('#btn-nav-calc');
        if (btnCalc) {
            btnCalc.addEventListener('click', () => {
                 const navBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
                 if (navBtn) navBtn.click();
                 setTimeout(() => {
                    const tabBtn = document.querySelector('.sub-nav-btn[data-target="tab-content-register"]');
                    if (tabBtn) tabBtn.click();
                }, 100);
            });
        }
        // -------------------------
`;

content = content.replace(oldBindStart, newBindStart);

fs.writeFileSync(path, content, 'utf8');
console.log('Update successful');
