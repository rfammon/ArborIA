const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/features.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetLine = "    altura: document.getElementById('risk-altura').value || '0.0',";
const replacement = "    // [FIX-SUPABASE-ERROR]: A coluna 'altura' não foi encontrada no esquema da tabela 'arvores' no Supabase. Esta linha foi comentada para resolver o erro. Se 'altura' for uma coluna intencional, adicione-a à tabela 'arvores' no Supabase (com o tipo de dado correto, ex: NUMERIC) e então descomente esta linha.\n    // altura: document.getElementById('risk-altura').value || '0.0',";

if (content.includes(targetLine)) {
    content = content.replace(targetLine, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Patch applied successfully.");
} else {
    // Tenta encontrar sem a virgula no final, caso seja o ultimo item (embora nao seja)
    const targetLineNoComma = "    altura: document.getElementById('risk-altura').value || '0.0'";
    if (content.includes(targetLineNoComma)) {
        content = content.replace(targetLineNoComma, replacement.slice(0, -1)); // Remove virgula do replacement se necessario
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Patch applied successfully (variant).");
    } else {
        console.error("Target line not found.");
        process.exit(1);
    }
}
