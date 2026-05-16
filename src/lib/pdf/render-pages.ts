import { join, sep } from "node:path";

export type RenderedPdfPageImage = Readonly<{
  pageNumber: number;
  dataUrl: string;
}>;

const DEFAULT_SCALE = 2;

function pdfJsWasmUrl(): string {
  // NodeBinaryDataFactory concatenates `wasmUrl + filename` and reads it with fs.readFile.
  return `${join(process.cwd(), "node_modules", "pdfjs-dist", "wasm")}${sep}`;
}

type CanvasModule = typeof import("@napi-rs/canvas");

async function loadCanvasModule(): Promise<CanvasModule> {
  // Hide the native dependency from the route bundler; Next loads it as a server external.
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<CanvasModule>;
  return dynamicImport("@napi-rs/canvas");
}

function installPdfJsCanvasGlobals(canvasModule: CanvasModule): void {
  const g = globalThis as Record<string, unknown>;
  g.DOMMatrix ??= canvasModule.DOMMatrix;
  g.DOMPoint ??= canvasModule.DOMPoint;
  g.DOMRect ??= canvasModule.DOMRect;
  g.ImageData ??= canvasModule.ImageData;
  g.Path2D ??= canvasModule.Path2D;
}

/**
 * Renders the first N PDF pages to PNG data URLs for vision/OCR fallback.
 * Keep this server-only: it uses native canvas bindings.
 */
export async function renderPdfPagesToPngDataUrls(
  data: Buffer,
  options?: Readonly<{ maxPages?: number; scale?: number; pageNumbers?: readonly number[] }>,
): Promise<RenderedPdfPageImage[]> {
  const maxPages = Math.min(Math.max(options?.maxPages ?? 4, 1), 8);
  const scale = Math.min(Math.max(options?.scale ?? DEFAULT_SCALE, 0.8), 3);

  const [canvasModule, pdfjs] = await Promise.all([
    loadCanvasModule(),
    import("pdfjs-dist/legacy/build/pdf.mjs"),
  ]);
  installPdfJsCanvasGlobals(canvasModule);
  const { createCanvas } = canvasModule;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableWorker: true,
    useSystemFonts: true,
    wasmUrl: pdfJsWasmUrl(),
  } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
  const doc = await loadingTask.promise;
  const out: RenderedPdfPageImage[] = [];

  try {
    const requestedPages = options?.pageNumbers?.length
      ? [...new Set(options.pageNumbers)]
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= doc.numPages)
          .sort((a, b) => a - b)
      : Array.from({ length: Math.min(doc.numPages, maxPages) }, (_, i) => i + 1);
    for (const pageNumber of requestedPages) {
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
