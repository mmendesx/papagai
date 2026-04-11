import { expect, test, type Page } from '@playwright/test';

async function openTryItPanel(page: Page, endpointTitle: string): Promise<void> {
  const endpointCard = page.locator('article', { hasText: endpointTitle }).first();
  await endpointCard.getByRole('button', { name: new RegExp(endpointTitle, 'i') }).click();
  await endpointCard.getByRole('button', { name: 'Testar' }).click();
}

test.describe('Docs smoke checks for API key parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-user-id',
          name: 'E2E User',
          email: 'e2e@example.com',
        }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('papagai_access_token', 'e2e.token.value');
    });

    await page.goto('/docs');
    await expect(page.getByRole('heading', { name: 'Documentação API' }).first()).toBeVisible();
  });

  test('auth narrative mentions Bearer and X-Api-Key on docs surface', async ({ page }) => {
    await expect(page.getByText(/Authorization:\s*Bearer\s*<accessToken>/i).first()).toBeVisible();
    await expect(page.getByText(/X-Api-Key:\s*<apiKey>/i).first()).toBeVisible();
    await expect(
      page.getByText(/Rotas AnyAuth aceitam Authorization: Bearer <accessToken> ou X-Api-Key\./i).first(),
    ).toBeVisible();
    await expect(page.getByText('Todas as rotas exigem JWT.')).toHaveCount(0);
  });

  test('docs include account and instance API key endpoints', async ({ page }) => {
    const endpointTitles = [
      'Criar API key de conta',
      'Listar API keys de conta',
      'Revogar API key de conta',
      'Criar API key da instância',
      'Listar API keys da instância',
      'Revogar API key da instância',
    ];

    for (const title of endpointTitles) {
      await expect(page.getByText(title).first()).toBeVisible();
    }

    await expect(page.getByText('/api/auth/apikeys/templates').first()).toBeVisible();
  });

  test('template vocabulary appears consistently for permissionsTemplate docs', async ({ page }) => {
    await expect(page.getByText(/permissionsTemplate/i).first()).toBeVisible();
    await expect(
      page.getByText(/permissionsTemplate e permissions são mutuamente exclusivos/i).first(),
    ).toBeVisible();

    const createAccountKeyButton = page
      .locator('article', { hasText: /\/api\/auth\/apikeys\s+Criar API key de conta/i })
      .first()
      .getByRole('button');
    await createAccountKeyButton.click();

    await expect(page.getByText(/read_only, operator, instance_manager ou account_admin/i).first()).toBeVisible();

    for (const templateId of ['read_only', 'operator', 'instance_manager', 'account_admin']) {
      await expect(page.getByText(templateId).first()).toBeVisible();
    }
  });

  test('try it bearer mode sends only Authorization header', async ({ page }) => {
    const bearerToken = 'e2e.bearer.token';
    await openTryItPanel(page, 'Usuário atual');

    const endpointCard = page.locator('article', { hasText: 'Usuário atual' }).first();
    const requestHeadersPromise = new Promise<Record<string, string>>((resolve) => {
      page.route('**/api/auth/me', async (route) => {
        resolve(route.request().headers());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'e2e-user-id', name: 'E2E User', email: 'e2e@example.com' }),
        });
      });
    });

    await endpointCard.locator('select[id^="try-auth-mode-"]').selectOption('bearer');
    await endpointCard.getByLabel('Bearer token').fill(bearerToken);
    await endpointCard.getByRole('button', { name: 'Executar' }).click();

    const headers = await requestHeadersPromise;
    expect(headers.authorization).toBe(`Bearer ${bearerToken}`);
    expect(headers['x-api-key']).toBeUndefined();
  });

  test('try it apiKey mode sends only X-Api-Key header', async ({ page }) => {
    const apiKey = 'ppg_e2e_api_key';
    await openTryItPanel(page, 'Usuário atual');

    const endpointCard = page.locator('article', { hasText: 'Usuário atual' }).first();
    const requestHeadersPromise = new Promise<Record<string, string>>((resolve) => {
      page.route('**/api/auth/me', async (route) => {
        resolve(route.request().headers());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'e2e-user-id', name: 'E2E User', email: 'e2e@example.com' }),
        });
      });
    });

    await endpointCard.locator('select[id^="try-auth-mode-"]').selectOption('apiKey');
    await endpointCard.getByLabel('X-Api-Key').fill(apiKey);
    await endpointCard.getByRole('button', { name: 'Executar' }).click();

    const headers = await requestHeadersPromise;
    expect(headers['x-api-key']).toBe(apiKey);
    expect(headers.authorization).toBeUndefined();
  });

  test('try it none mode on public endpoint sends no auth headers', async ({ page }) => {
    await openTryItPanel(page, 'Login');

    const endpointCard = page.locator('article', { hasText: 'Login' }).first();
    const requestHeadersPromise = new Promise<Record<string, string>>((resolve) => {
      page.route('**/api/auth/login', async (route) => {
        resolve(route.request().headers());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'e2e-user-id', name: 'E2E User', email: 'e2e@example.com' },
            accessToken: 'e2e.login.token',
          }),
        });
      });
    });

    await endpointCard.locator('select[id^="try-auth-mode-"]').selectOption('none');
    await endpointCard.getByRole('button', { name: 'Executar' }).click();

    const headers = await requestHeadersPromise;
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-api-key']).toBeUndefined();
  });
});