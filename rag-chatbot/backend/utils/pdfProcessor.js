// Step 1 + 2 of ingestion: extract text from a PDF (page by page) and clean it.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Light cleaning so the embeddings are not distorted by layout noise.
export function cleanText(text) {
  return text
    .replace(/-\s*\n\s*/g, "") // join words split by a hyphen at line end
    .replace(/\s*\n\s*/g, " ") // newlines -> spaces
    .replace(/\s{2,}/g, " ") // collapse repeated spaces
    .trim();
}

/**
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<Array<{pageNumber: number, text: string}>>} non-empty pages only
 */
export async function extractPages(buffer) {
  // pdfjs wants a plain Uint8Array (a copy is fine for small files).
  const data = new Uint8Array(buffer);
  const pdf = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;

  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      // Each item is a small piece of text; hasEOL marks line ends.
      const raw = content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("");
      const text = cleanText(raw);
      if (text) pages.push({ pageNumber, text });
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
}
