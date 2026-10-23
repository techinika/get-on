import { describe, expect, it } from "vitest";
import { csvCell, csvDocument, type CsvMessage } from "@/lib/contact/csv";
import { mailtoHref, replyBody, telHref, whatsappHref } from "@/lib/contact/links";

describe("contact links", () => {
  it("builds a tel link from a readable phone number", () => {
    expect(telHref("+447911123456")).toBe("tel:+447911123456");
    expect(telHref("(020) 7946 0018")).toBe("tel:02079460018");
    expect(telHref("")).toBeNull();
  });

  it("encodes the mailto subject and body", () => {
    expect(mailtoHref("a@example.com", "Re: hello", "Hi there")).toBe(
      "mailto:a@example.com?subject=Re%3A+hello&body=Hi+there",
    );
    expect(mailtoHref(null)).toBeNull();
  });

  it("only offers WhatsApp for a valid international number", () => {
    expect(whatsappHref("+447911123456", "Hello there")).toBe(
      "https://wa.me/447911123456?text=Hello%20there",
    );
    expect(whatsappHref("020 7946 0018")).toBeNull();
    expect(whatsappHref("nonsense")).toBeNull();
  });

  it("quotes at most 500 characters in a reply", () => {
    const body = replyBody("x".repeat(600));
    expect(body).toContain("x".repeat(500));
    expect(body).not.toContain("x".repeat(501));
  });
});

describe("contact CSV", () => {
  it("stops visitor text from becoming a spreadsheet formula", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(csvCell("+447911123456")).toBe("'+447911123456");
    expect(csvCell("-hello")).toBe("'-hello");
    expect(csvCell("@name")).toBe("'@name");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Hello, "world"')).toBe('"Hello, ""world"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("writes a document with a BOM and every message", () => {
    const message: CsvMessage = {
      created_at: "2026-10-23T10:00:00.000Z",
      name: "Sam",
      email: "sam@example.com",
      phone: null,
      message: "Can you help?",
      page_path: "/",
      status: "new",
      replied: false,
    };
    const csv = csvDocument([message]);
    expect(csv.startsWith("\uFEFFDate,Name,Email,Phone,Message,Page,Status,Replied\r\n")).toBe(true);
    expect(csv).toContain("2026-10-23T10:00:00.000Z,Sam,sam@example.com,,Can you help?,/,new,No");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
