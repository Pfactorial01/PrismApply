import "dotenv/config";
import puppeteer from "puppeteer-core";
import type { StructuredResume, ResumeTemplateId } from "./types.js";
import { structuredResumeHtml } from "./renderHtml.js";

const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";

export async function renderStructuredResumePdf(
  resume: StructuredResume,
  templateId: ResumeTemplateId = "classic",
): Promise<Buffer> {
  const html = structuredResumeHtml(resume, templateId);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "0.6in", bottom: "0.6in", left: "0.75in", right: "0.75in" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** @deprecated Use renderStructuredResumePdf — kept for legacy plain-text path */
export async function renderResumePdf(resumeText: string): Promise<Buffer> {
  const lines = resumeText.split("\n");
  const resume: StructuredResume = {
    name: lines[0]?.trim() ?? "",
    contact: (lines[1] ?? "").split("|").map((s) => s.trim()).filter(Boolean),
    skills: [],
    experience: [],
  };
  return renderStructuredResumePdf(resume, "classic");
}
