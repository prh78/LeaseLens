export type RenderedPdfPageImage = Readonly<{
  pageNumber: number;
  dataUrl: string;
}>;

const DEFAULT_SCALE = 1.35;

type CanvasModule = typeof import("@napi-rs/canvas");

async function loadCanvasModule(): Promise<CanvasModule> {
  // Hide the native dependency from the route bundler; Next loads it as a server external.
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<CanvasModule>;
  return dynamicImport("@napi-rs/canvas");
}

/**
 * Renders the first N PDF pages to PNG data URLs for vision/OCR fallback.
 * Keep this server-only: it uses native canvas bindings.
 */
export async function renderPdfPagesToPngDataUrls(
  data: Buffer,
  options?: Readonly<{ maxPages?: number; scale?: number }>,
): Promise<RenderedPdfPageImage[]> {
  const maxPages = Math.min(Math.max(options?.maxPages ?? 4, 1), 8);
  const scale = Math.min(Math.max(options?.scale ?? DEFAULT_SCALE, 0.8), 2.25);

  const [{ createCanvas }, pdfjs] = await Promise.all([
    loadCanvasModule(),
    import("pdfjs-dist/legacy/build/pdf.mjs"),
  ]);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableWorker: true,
    useSystemFonts: true,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
  const doc = await loadingTask.promise;
  const out: RenderedPdfPageImage[] = [];

  try {
    const pageCount = Math.min(doc.numPages, maxPages);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = canvas.getContext("2d");

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        viewport,
      } as unknown as Parameters<typeof page.render>[0]).promise;

      out.push({
        pageNumber,
        dataUrl: canvas.toDataURL("image/png"),
      });
    }
  } finally {
    await doc.destroy();
  }

  return out;
}
