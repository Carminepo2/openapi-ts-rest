import { expect, test } from "@playwright/test";

test("loads correctly", async ({ page }) => {
  const pageTitle = "OpenAPI to Ts Rest Contract";

  await page.goto("/");
  await expect(page).toHaveTitle(pageTitle);

  const h1Element = page.locator("h1");
  await expect(h1Element).toHaveText(pageTitle);
});
