import { test, expect } from '@playwright/test'

test('shows typing indicator while AI response streams', async ({ page }) => {
  await page.goto('/assistant')

  // Wait for the page to be ready — input must be visible
  const textarea = page.getByPlaceholder('Wpisz wiadomość…')
  await expect(textarea).toBeVisible()

  // Send a short message
  await textarea.fill('Cześć')
  await textarea.press('Enter')

  // Typing indicator must appear immediately after submitting (before response arrives)
  await expect(page.getByTestId('typing-indicator')).toBeVisible()

  // After the response completes the indicator must disappear
  await expect(page.getByTestId('typing-indicator')).not.toBeVisible({
    timeout: 30_000,
  })
})
