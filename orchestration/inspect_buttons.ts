import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";

async function main() {
  const sh = new Stagehand({ env: "BROWSERBASE", apiKey: process.env.BROWSERBASE_API_KEY, model: "gpt-4o-mini", verbose: 0 });
  await sh.init();
  const page = sh.context.pages()[0];
  await page.goto("https://jobs.lever.co/techquarter/86f0559c-1ec1-4a2e-ada0-6b6c77ad637a/apply", { timeout: 30000 });
  await page.waitForLoadState("domcontentloaded");
  await new Promise((r) => setTimeout(r, 5000));
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).map((b) => ({
      text: b.textContent?.trim(),
      type: b.type,
      html: b.outerHTML?.substring(0, 300),
    }));
  });
  console.log(JSON.stringify(buttons, null, 2));
  const hasForm = await page.evaluate(() => !!document.querySelector("form"));
  console.log("\nhasForm:", hasForm);
  await sh.close();
}
main().catch(console.error);
