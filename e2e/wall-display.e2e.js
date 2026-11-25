import { test, expect } from './fixtures';

// iPad A16 (2025) in landscape, as a Home Screen app.
const IPAD_LANDSCAPE = { width: 1180, height: 820 };

test.describe('Wall display', () => {
  test.use({ viewport: IPAD_LANDSCAPE });

  test.beforeEach(async ({ page, mockHAConnection }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ha_url', 'http://localhost:8123');
      localStorage.setItem('ha_auth_method', 'token');
      localStorage.setItem('ha_token', 'test_token');
      localStorage.setItem(
        'tunet_pages_config',
        JSON.stringify({
          header: [],
          pages: ['home'],
          home: ['light.bedroom', 'light.kitchen', 'climate.living_room'],
        })
      );
      localStorage.setItem('tunet_card_settings', JSON.stringify({}));
      localStorage.setItem('tunet_wall_mode', '1');
      localStorage.setItem('tunet_fit_to_screen', '1');
      localStorage.setItem(
        'tunet_auth_cache_v1',
        JSON.stringify({
          access_token: 'test_token',
          refresh_token: 'test_refresh_token',
          expires_in: 1800,
          token_type: 'Bearer',
        })
      );
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-dashboard-card="light.bedroom"]')).toBeVisible();
  });

  test('fills the screen without scrolling', async ({ page }) => {
    await expect(page.locator('[data-fit-to-screen]')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({ path: 'test-results/wall-display-ipad-landscape.png' });
  });

  test('hides the edit button until a long press on an empty area', async ({ page }) => {
    const editButton = page.getByRole('button', { name: 'Edit' });
    await expect(page.locator('html')).toHaveAttribute('data-wall-mode', '');
    await expect(editButton).toHaveCount(0);

    // The left margin of the dashboard holds no card or button.
    await page.mouse.move(12, IPAD_LANDSCAPE.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();

    await expect(editButton).toBeVisible();
  });
});
