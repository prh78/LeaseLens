const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

export type PdfValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function readFileSlice(file: File, start: number, end: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsArrayBuffer(file.slice(start, end));
  });
}

/**
 * Validates extension, declared MIME type, and %PDF magic at the start of the file.
 */
export async function validatePdfFile(file: File): Promise<PdfValidationResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) {
    return { ok: false, message: "File must use a .pdf extension." };
  }

  if (file.type && file.type !== "application/pdf") {
    return { ok: false, message: "Only PDF files are accepted (wrong content type)." };
  }

  const head = new Uint8Array(await readFileSlice(file, 0, Math.min(file.size, 5)));
  if (head.length < 4) {
    return { ok: false, message: "File is too small to be a valid PDF." };
  }

  for (let i = 0; i < PDF_MAGIC.length; i += 1) {
    if (head[i] !== PDF_MAGIC[i]) {
      return { ok: false, message: "File does not look like a PDF (missing %PDF header)." };
    }
  }

  return { ok: true };
}
