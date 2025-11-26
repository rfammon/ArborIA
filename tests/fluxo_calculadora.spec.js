import { test, expect } from '@playwright/test';

test.describe('Fluxo da Calculadora de Risco', () => {
  // Navega para a página local antes de cada teste no grupo
  test.beforeEach(async ({ page }) => {
    // A URL deve ser o caminho para o seu arquivo local.
    // O Playwright inicia um servidor web, então o caminho deve ser relativo à raiz do projeto.
    await page.goto('/index.html');
  });

  test('deve abrir a página e verificar o título', async ({ page }) => {
    // Verifica se o título da página contém "ArborIA 2.0"
    await expect(page).toHaveTitle(/ArborIA 2.0/);
  });

  test('deve clicar em "Levantamento de Dados" e exibir o formulário', async ({ page }) => {
    // 1. Encontra e clica no botão "Levantamento de Dados"
    // Usamos o seletor de atributo que é mais específico e estável.
    const levantamentoBtn = page.locator('[data-target="calculadora-view"]');
    await levantamentoBtn.click();

    // 2. Verifica se a seção da calculadora está visível
    // A seção com id="calculadora-view" contém o formulário.
    const formSection = page.locator('#calculadora-view');
    await expect(formSection).toBeVisible();

    // 3. (Opcional) Uma verificação extra para garantir que o formulário em si está presente
    const formElement = formSection.locator('#risk-calculator-form');
    await expect(formElement).toBeVisible();
  });
});
