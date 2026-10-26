import { formatMoney } from "./format";

type InvoiceRow = Record<string, unknown>;
type LineRow = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "");
}

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function money(cents: unknown, currency: string): string {
  return formatMoney(Number(cents ?? 0), currency);
}

function date(value: unknown): string {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function invoicePdf(input: {
  invoice: InvoiceRow;
  lines: LineRow[];
  teamName: string;
}): Uint8Array {
  const invoice = input.invoice;
  const currency = text(invoice.currency || "USD");
  const rows: Array<[string, string]> = [
    ["Get-On", ""],
    [`Invoice ${text(invoice.number)}`, text(invoice.status).toUpperCase()],
    ["", ""],
    ["Billed to", text(invoice.billing_name || input.teamName)],
    ["Billing email", text(invoice.billing_email || "Not set")],
    ["Plan", text(invoice.plan_id || "-")],
    ["Period", invoice.months ? `${text(invoice.months)} months` : "-"],
    ["Created", date(invoice.created_at)],
    ["Due", date(invoice.due_at)],
    ["", ""],
  ];

  for (const line of input.lines) {
    rows.push([
      text(line.description),
      money(line.amount_cents, currency),
    ]);
  }

  rows.push(["", ""]);
  rows.push(["Discount", `-${money(invoice.discount_cents, currency)}`]);
  rows.push(["Tax", money(invoice.tax_cents, currency)]);
  rows.push(["Total", money(invoice.total_cents, currency)]);
  rows.push(["", ""]);
  rows.push(["This is a prepaid invoice. No card is saved.", ""]);
  rows.push(["We never charge you automatically.", ""]);

  const content = rows
    .map(([left, right], index) => {
      const y = 760 - index * 18;
      const leftText = pdfText(left);
      const rightText = pdfText(right);
      const rightX = Math.max(320, 560 - rightText.length * 6);
      const bold = index === 0 || left === "Total";
      const font = bold ? "/F2" : "/F1";
      return `BT ${font} 12 Tf 50 ${y} Td (${leftText}) Tj ET\nBT ${font} 12 Tf ${rightX} ${y} Td (${rightText}) Tj ET`;
    })
    .join("\n");

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
