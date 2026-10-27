import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OPTIONS = {
  width: 1024,
  margin: 4,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000", light: "#ffffff" },
};

export async function qrPng(url: string): Promise<Uint8Array> {
  return new Uint8Array(await QRCode.toBuffer(url, { ...OPTIONS, type: "png" }));
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPTIONS, type: "svg" });
}

function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?").slice(0, 200);
}

export async function qrPdf(options: {
  url: string;
  businessName: string;
  address: string;
}): Promise<Uint8Array> {
  const png = await qrPng(options.url);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const image = await pdf.embedPng(png);
  const size = 420;
  page.drawImage(image, {
    x: (595.28 - size) / 2,
    y: 320,
    width: size,
    height: size,
  });
  page.drawText(pdfText(options.businessName), {
    x: 56,
    y: 770,
    size: 24,
    font: bold,
    color: rgb(0.12, 0.1, 0.09),
  });
  page.drawText(pdfText(options.address), {
    x: 56,
    y: 740,
    size: 13,
    font: regular,
    color: rgb(0.32, 0.29, 0.26),
  });
  page.drawText("Scan to open our website", {
    x: 56,
    y: 280,
    size: 18,
    font: bold,
    color: rgb(0.12, 0.1, 0.09),
  });
  page.drawText("Point your phone camera at the code.", {
    x: 56,
    y: 255,
    size: 12,
    font: regular,
    color: rgb(0.32, 0.29, 0.26),
  });
  page.drawText(pdfText(options.url), {
    x: 56,
    y: 90,
    size: 10,
    font: regular,
    color: rgb(0.32, 0.29, 0.26),
  });
  return new Uint8Array(await pdf.save());
}
