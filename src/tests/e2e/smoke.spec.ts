import { test, expect } from "@playwright/test";

/**
 * Smoke-level coverage only — confirms the app boots and core routes
 * render without crashing. NOT a substitute for real checkout/payment
 * flow e2e tests, which need a seeded test database with real
 * products/inventory and a card-payment sandbox — neither exists yet
 * (see AI_CONTEXT.md open decisions on the payment gateway). Extend
 * this file once that test fixture exists rather than writing deeper
 * e2e coverage against production data by accident.
 */

test("search page renders and handles a query", async ({ page }) => {
  await page.goto("/search?q=watch");
  await expect(page.locator("h1")).toContainText("watch");
});

test("search page shows a hint for short queries", async ({ page }) => {
  await page.goto("/search?q=a");
  await expect(page.getByText(/at least 2 characters/i)).toBeVisible();
});

test("category page 404s cleanly for an unknown slug", async ({ page }) => {
  const response = await page.goto("/category/this-category-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("product page 404s cleanly for an unknown slug", async ({ page }) => {
  const response = await page.goto("/products/this-product-does-not-exist");
  expect(response?.status()).toBe(404);
});
