export type CsvMessage = {
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  page_path: string | null;
  status: string;
  replied: boolean;
};

const COLUMNS = ["Date", "Name", "Email", "Phone", "Message", "Page", "Status", "Replied"];

/** Stops a spreadsheet from treating visitor text as a formula. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function messageToRow(message: CsvMessage): string {
  return [
    message.created_at,
    message.name,
    message.email,
    message.phone ?? "",
    message.message,
    message.page_path ?? "",
    message.status,
    message.replied ? "Yes" : "No",
  ]
    .map(csvCell)
    .join(",");
}

export function csvHeader(): string {
  return COLUMNS.map(csvCell).join(",");
}

export function csvFileName(subdomain: string, date: Date = new Date()): string {
  return `${subdomain}-messages-${date.toISOString().slice(0, 10)}.csv`;
}

export function csvDocument(messages: CsvMessage[]): string {
  return `\uFEFF${[csvHeader(), ...messages.map(messageToRow)].join("\r\n")}\r\n`;
}
