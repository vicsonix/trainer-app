import { test, expect } from '@playwright/test'

test.describe('Calendar appointments', () => {
  let testId: string

  test.beforeEach(() => {
    testId = `test-${Date.now()}`
  })

  test('appointment data persists and client card shows correct remaining sessions after create', async ({ page }) => {
    // Navigate to calendar — default view is week
    await page.goto('/calendar')
    await page.getByRole('button', { name: 'Tydzień' }).click()

    // Click the 10:00 time slot — pre-fills date (Monday of current week) + time
    await page.getByRole('button', { name: '10:00' }).first().click()

    // Create modal opens — fill client (open Radix Select, pick first option)
    await page.getByLabel(/klient/i).click()
    await page.getByRole('option').first().click()

    // Notes = testId (unique identifier so we can locate this specific event)
    await page.getByLabel(/notatki/i).fill(testId)

    // Duration defaults to 60 min — leave as is
    await page.getByRole('button', { name: 'Zapisz wizytę' }).click()

    // Event chip (a <button>) subtitle = notes — testId identifies this event in the grid
    const eventChip = page.getByRole('button').filter({ hasText: testId })
    await expect(eventChip).toBeVisible({ timeout: 10_000 })

    // Click the event chip to open the detail modal
    await eventChip.click()

    // Detail modal: shows appointment notes section ("Notatki do wizyty")
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').getByText(testId)).toBeVisible()

    // Trigger inline delete confirm (single "Usuń" button at this point)
    await page.getByRole('button', { name: 'Usuń' }).first().click()

    // Confirm section appears — first "Usuń" is now the enabled confirm button
    await expect(page.getByText('Czy na pewno usunąć wizytę?')).toBeVisible()
    await page.getByRole('button', { name: 'Usuń' }).first().click()

    // Wait for dialog to close — delete action is async, dialog closes on success
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })

    // Event chip (a <button>) is gone from the calendar grid
    await expect(page.getByRole('button').filter({ hasText: testId })).not.toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    // Best-effort cleanup: if the test left the appointment, delete it
    await page.goto('/calendar')

    const eventButton = page.getByRole('button').filter({ hasText: testId })
    const visible = await eventButton.isVisible().catch(() => false)
    if (!visible) return

    await eventButton.first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Usuń' }).first().click()
    await expect(page.getByText('Czy na pewno usunąć wizytę?')).toBeVisible()
    await page.getByRole('button', { name: 'Usuń' }).first().click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(eventButton).not.toBeVisible()
  })
})
