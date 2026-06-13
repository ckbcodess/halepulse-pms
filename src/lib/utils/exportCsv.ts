/**
 * Shared CSV export helper used across the app (inventory, sales, customers…).
 *
 * - Escapes quotes/commas/newlines correctly per RFC 4180
 * - Prepends a UTF-8 BOM so Excel opens accented characters correctly
 * - Triggers a browser download with a sensible filename
 *
 * Usage:
 *   exportToCsv({
 *     filename: 'inventory',
 *     headers: ['ID', 'Name', 'Price'],
 *     rows: products.map(p => [p.id, p.name, p.price]),
 *   });
 */

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Quote if the value contains a comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const headerLine = headers.map(escapeCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

interface ExportOptions {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
  /** Append a date stamp to the filename (default true). */
  dateStamp?: boolean;
}

export function exportToCsv({ filename, headers, rows, dateStamp = true }: ExportOptions): void {
  const csv = buildCsv(headers, rows);
  // BOM ensures Excel reads UTF-8 correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = dateStamp ? `-${new Date().toISOString().slice(0, 10)}` : '';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
