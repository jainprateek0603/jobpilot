import { expect, test } from '@playwright/test'

test('sign up, add an application, move it, and tailor a resume', async ({ page }) => {
  const email = `pilot-${Date.now()}@example.com`
  await page.goto('/register')
  await page.getByLabel('Name').fill('Ada Lovelace')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('Password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible()

  await page.getByRole('button', { name: 'Add application' }).click()
  await page.getByLabel('Company').fill('Northwind')
  await page.getByLabel('Role').fill('Platform Engineer')
  await page.getByRole('button', { name: 'Save application' }).click()
  const card = page.getByTestId(/^card-/)
  await expect(card.getByText('Northwind')).toBeVisible()
  await expect(page.getByTestId('column-WISHLIST')).toContainText('Northwind')

  await page.getByLabel('Move Northwind').selectOption('APPLIED')
  await expect(page.getByTestId('column-APPLIED')).toContainText('Northwind')

  const cardBox = await card.boundingBox()
  const interview = page.getByTestId('column-INTERVIEW')
  const interviewBox = await interview.boundingBox()
  if (cardBox && interviewBox) {
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 20)
    await page.mouse.down()
    await page.mouse.move(interviewBox.x + interviewBox.width / 2, interviewBox.y + 80, { steps: 12 })
    await page.mouse.up()
  }
  if (!(await interview.getByText('Northwind').isVisible().catch(() => false))) {
    await page.getByLabel('Move Northwind').selectOption('INTERVIEW')
  }
  await expect(interview).toContainText('Northwind')

  await page.getByRole('link', { name: 'Resumes' }).click()
  await page.getByLabel('Title').fill('Base resume')
  await page.getByLabel('Resume text').fill('I build internal tools with TypeScript and React.')
  await page.getByRole('button', { name: 'Save resume' }).click()
  await expect(page.getByText('Base resume')).toBeVisible()

  await page.getByRole('link', { name: 'Tailor' }).click()
  await page.getByLabel('Job description').fill('We need Kubernetes, GraphQL, and TypeScript for this platform role.')
  await page.getByRole('button', { name: 'Generate tailored resume' }).click()
  await expect(page.getByRole('heading', { name: /Match score/ })).toBeVisible()
  await expect(page.getByText(/kubernetes/i)).toBeVisible()
})
