import { test, expect } from '@playwright/test'

test.describe('Analytics page', () => {
  test('loads with heading and subtitle visible', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: 'Analityka' })).toBeVisible()
    await expect(page.getByText('Twoje statystyki treningowe')).toBeVisible()
  })

  test('Analityka nav link navigates to analytics page', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Analityka' }).first().click()
    await expect(page).toHaveURL('/analytics')
    await expect(page.getByRole('heading', { name: 'Analityka' })).toBeVisible()
  })

  test('all three period filter tabs are visible', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('link', { name: 'Ten miesiąc' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ostatnie 3 miesiące' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Wszystko' })).toBeVisible()
  })

  test('period filter updates URL and page stays loaded', async ({ page }) => {
    await page.goto('/analytics')

    await page.getByRole('link', { name: 'Ostatnie 3 miesiące' }).click()
    await expect(page).toHaveURL(/[?&]period=3months/)
    await expect(page.getByRole('heading', { name: 'Analityka' })).toBeVisible()

    await page.getByRole('link', { name: 'Wszystko' }).click()
    await expect(page).toHaveURL(/[?&]period=all/)
    await expect(page.getByRole('heading', { name: 'Analityka' })).toBeVisible()

    await page.getByRole('link', { name: 'Ten miesiąc' }).click()
    await expect(page).toHaveURL(/[?&]period=month/)
    await expect(page.getByRole('heading', { name: 'Analityka' })).toBeVisible()
  })

  test('default period is Ten miesiąc when no query param', async ({ page }) => {
    await page.goto('/analytics')
    // No redirect to a non-month period
    await expect(page).not.toHaveURL(/period=3months/)
    await expect(page).not.toHaveURL(/period=all/)
    await expect(page.getByRole('link', { name: 'Ten miesiąc' })).toBeVisible()
  })

  test('stat section shows cards or empty state for every period', async ({ page }) => {
    for (const period of ['month', '3months', 'all']) {
      await page.goto(`/analytics?period=${period}`)
      const cards = page.getByText('Sesji ukończonych')
      const empty = page.getByText('Brak sesji w tym okresie')
      await expect(cards.or(empty)).toBeVisible()
    }
  })

  test('package popularity section heading is always visible', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: 'Popularność pakietów' })).toBeVisible()
  })

  test('empty state calendar links navigate to /calendar', async ({ page }) => {
    await page.goto('/analytics')
    // Collect all "Przejdź do kalendarza" links — present when a section has no data
    const calendarLinks = page.getByRole('link', { name: 'Przejdź do kalendarza' })
    const count = await calendarLinks.count()
    if (count > 0) {
      await calendarLinks.first().click()
      await expect(page).toHaveURL('/calendar')
    }
  })
})
