/**
 * ARBORIA 2.0 - CALCULATOR & SUMMARY TABLE
 * Layout: Abas de Navegação, Formulários e Tabelas de Dados
 */

/* --- HEADER DA CALCULADORA --- */
#calculadora-view h3 {
  color: var(--color-forest);
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

#calculadora-view > p {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

/* --- SUB-NAVEGAÇÃO (Abas) --- */
/* Mantido original */
.sub-nav {
  display: flex;
  background-color: #e2e8f0;
  border-radius: var(--radius-pill);
  padding: 4px;
  margin-bottom: 1.5rem;
  gap: 4px;
  overflow-x: auto; 
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sub-nav::-webkit-scrollbar { display: none; }

.sub-nav-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px 12px;
  border-radius: var(--radius-pill);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  transition: all var(--transition-fast);
  position: relative;
}

.sub-nav-btn.active {
  background-color: #ffffff;
  color: var(--color-forest);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  font-weight: 700;
}

.sub-nav-btn .badge {
  font-size: 0.7em;
  padding: 2px 6px;
  margin-left: 4px;
  vertical-align: top;
}

/* --- CONTEÚDO DAS ABAS --- */
.sub-tab-content {
  animation: fadeInTab 0.3s ease-out;
}

@keyframes fadeInTab {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- CONTROLES DA TABELA (Novo Layout Flex) --- */
/* Permite que o botão de colunas fique ao lado da busca */
.table-controls-wrapper {
  display: flex;
  gap: 10px;
  margin-bottom: 1rem;
  align-items: center;
}

.table-filter-container {
  flex-grow: 1; /* Ocupa o espaço restante */
  margin-bottom: 0; /* Remove margem antiga */
}

.table-filter-container input {
  width: 100%;
  padding: 10px 12px 10px 35px; /* Espaço para lupa */
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: #fafafa;
  /* Ícone de lupa SVG inline mantido */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23718096' viewBox='0 0 24 24'%3E%3Cpath d='M21.71 20.29l-5.01-5.01C17.54 13.68 18 11.91 18 10c0-4.41-3.59-8-8-8S2 5.59 2 10s3.59 8 8 8c1.91 0 3.68-.46 5.28-1.29l5.01 5.01c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41zM10 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 20px;
}

/* Estilo do Botão Toggle Colunas */
#toggle-cols-btn {
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-tech);
  border-radius: 12px;
  padding: 10px 15px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s;
}
#toggle-cols-btn:hover { background: #f0f9ff; }

/* --- TABELA DE RESUMO (.summary-table) --- */
/* Separamos da .risk-table para garantir que apareça no mobile */
#summary-table-container {
  width: 100%;
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  margin-bottom: 1rem;
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.summary-table {
  width: 100%;
  border-collapse: collapse; /* Essencial para gradiente contínuo */
  min-width: 100%;
  font-size: 0.9rem;
}

/* CORREÇÃO DO GRADIENTE: Aplicado no THEAD */
.summary-table thead {
  background: var(--gradient-main); /* Gradiente contínuo na barra */
}

.summary-table th {
  color: white;
  padding: 12px 10px;
  text-align: left;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  background: transparent; /* Transparente para ver o gradiente do thead */
  white-space: nowrap;
}

.summary-table td {
  padding: 12px 10px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-main);
  vertical-align: middle;
}

/* Zebrado */
.summary-table tbody tr:nth-child(even) { background-color: #f8fafc; }
.summary-table tbody tr:hover { background-color: #f1f5f9; }

/* --- LÓGICA DE COLUNAS RESPONSIVAS --- */
/* Por padrão no mobile, esconde colunas secundárias */
@media (max-width: 768px) {
  .col-hide-mobile {
    display: none;
  }
  
  /* Quando a classe .compact-view é REMOVIDA (ou toggle ativado), mostra tudo */
  /* Mas como definimos no JS: se compact-view ESTÁ lá, esconde. Se não, mostra. */
  /* Vamos alinhar com o JS: .summary-table.compact-view ESCONDE coisas */
  
  .summary-table.compact-view .col-hide-mobile {
    display: none;
  }
  
  /* Se a tabela NÃO tiver a classe compact-view, as colunas aparecem (display: table-cell padrão) */
  .summary-table:not(.compact-view) .col-hide-mobile {
    display: table-cell;
  }
}

/* --- TABELA DE CHECKLIST (.risk-table) --- */
/* Mantida apenas para o Desktop na aba Registrar */
.risk-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.risk-table th {
  background: var(--gradient-main); /* Gradiente aqui também */
  color: white;
  padding: 12px;
  text-align: left;
}

.risk-table td {
  padding: 10px;
  border-bottom: 1px solid var(--color-border);
}

/* Checkbox centralizado */
.risk-table input[type="checkbox"] {
  margin: 0 auto;
  display: block;
}

/* --- BOTÕES DE AÇÃO EM GRUPO --- */
#import-export-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

#import-export-controls button {
  flex: 1 1 auto;
}
