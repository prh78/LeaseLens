/** RFC-style CSV field quoting for Excel compatibility. */
export function escapeCsvField(value: string): string {
  const needsQuote = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function csvRow(fields: readonly string[]): string {
  return `${fields.map(escapeCsvField).join(",")}\r\n`;
}

export function withUtf8Bom(csv: string): string {
  return `\uFEFF${csv}`;
}
