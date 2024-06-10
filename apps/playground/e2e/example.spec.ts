import { expect, test } from "@playwright/test";

test("loads correctly", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/OpenAPI to Ts Rest Contract/);
});
