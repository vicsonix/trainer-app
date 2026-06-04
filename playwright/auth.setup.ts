import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const authDir  = path.join(__dirname, '.auth')
const authFile = path.join(authDir, 'user.json')

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true })

  await page.goto('/login')

  // Use getByRole('textbox') to avoid strict-mode collision with the show/hide
  // password button whose aria-label "Pokaż hasło" also contains "hasło".
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_TEST_EMAIL ?? '')
  await page.getByRole('textbox', { name: 'Hasło' }).fill(process.env.PLAYWRIGHT_TEST_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Zaloguj się' }).click()

  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  expect(page.url()).toContain('/dashboard')

  await page.context().storageState({ path: authFile })
})
