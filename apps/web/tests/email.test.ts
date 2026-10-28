import { describe, expect, it } from "vitest";
import {
  EMAIL_CATALOGUE,
  button,
  EMAIL_STREAMS,
  describeEmailKind,
  emailLayout,
  findBannedWords,
  gradeLevel,
  lintEmailCopy,
  marketingCampaignEmail,
  streamForKind,
} from "@get-on/email";

describe("email catalogue", () => {
  it("sends billing mail from the billing identity", () => {
    expect(describeEmailKind("billing_receipt").stream).toBe("billing");
    expect(EMAIL_STREAMS.billing.from).toBe("billing@contact.get-on.tech");
    expect(EMAIL_STREAMS.billing.configurationSet).toBe("gs-billing");
  });

  it("sends marketing mail only through the marketing stream and consent", () => {
    expect(describeEmailKind("marketing_campaign")).toMatchObject({
      stream: "marketing",
      requiresMarketingConsent: true,
    });
    expect(EMAIL_STREAMS.marketing.from).toBe("no-reply@contact.get-on.tech");
    expect(EMAIL_STREAMS.marketing.replyTo).toBe("team@get-on.tech");
    expect(EMAIL_STREAMS.marketing.configurationSet).toBe("gs-marketing");
  });

  it("uses the transactional identity for product mail", () => {
    for (const kind of [
      "contact_notification",
      "team_invite",
      "website_suspended",
      "account_welcome",
      "approval_requested",
    ]) {
      expect(describeEmailKind(kind).stream, kind).toBe("transactional");
      expect(EMAIL_STREAMS[describeEmailKind(kind).stream].from).toBe(
        "no-reply@contact.get-on.tech",
      );
    }
  });

  it("falls back to the kind prefix for unknown kinds", () => {
    expect(streamForKind("billing_something_new")).toBe("billing");
    expect(streamForKind("campaign_something_new")).toBe("marketing");
    expect(streamForKind("something_new")).toBe("transactional");
  });

  it("gives every catalogue entry a matching kind and stream", () => {
    for (const [key, value] of Object.entries(EMAIL_CATALOGUE)) {
      expect(value.kind, key).toBe(key);
      expect(["transactional", "billing", "marketing"]).toContain(value.stream);
    }
  });
});

describe("email copy rules", () => {
  it("finds banned hype words", () => {
    expect(findBannedWords("Leverage our seamless platform")).toEqual([
      "leverage",
      "seamless",
    ]);
  });

  it("flags a long subject, a long sentence and a placeholder", () => {
    const issues = lintEmailCopy({
      subject: "A".repeat(61),
      preheader: "Hi {{first_name}}, here is a short summary of what changed.",
      body: `Hi {{first_name}}, ${"word ".repeat(25)}.`,
    });
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain("SUBJECT_TOO_LONG");
    expect(codes).toContain("SENTENCE_TOO_LONG");
    expect(codes).toContain("PLACEHOLDER");
  });

  it("keeps simple copy at a low grade", () => {
    expect(gradeLevel("We saved your changes. You can publish now.")).toBeLessThanOrEqual(8);
  });
});

describe("email layout", () => {
  const html = emailLayout({
    title: "Your receipt",
    preheader: "Here is what you paid and what happens next.",
    body: `<p>Hello.</p>${button("https://get-on.tech", "Open Get-On")}`,
  });

  it("uses the approved colours and a 600px card", () => {
    expect(html).toContain("#F4F1EA");
    expect(html).toContain("#FFFFFF");
    expect(html).toContain("#E8DFD0");
    expect(html).toContain("#0B6B4F");
    expect(html).toContain("max-width:600px");
  });

  it("uses a hosted PNG logo, never inline SVG", () => {
    expect(html).toContain("<img");
    expect(html).toContain("/brand/logo.png");
    expect(html).not.toContain("<svg");
  });
});

describe("marketing campaign email", () => {
  const rendered = marketingCampaignEmail({
    subject: "What is new at Get-On",
    preheader: "A short summary of the changes we made this month.",
    content: {
      heading: "A calmer website",
      intro: "We made a few small changes.",
      blocks: [
        { type: "paragraph", text: "Your pages load faster." },
        { type: "button", label: "Open Get-On", url: "https://get-on.tech" },
        { type: "paragraph", text: "<script>alert(1)</script>" },
        { type: "button", label: "Bad link", url: "javascript:alert(1)" },
      ],
    },
    unsubscribeUrl: "https://get-on.tech/email/unsubscribe?token=abc",
    physicalAddress: "Get-On, Nairobi",
  });

  it("escapes plain content and drops unsafe links", () => {
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).not.toContain("javascript:");
    expect(rendered.text).toContain("Your pages load faster.");
  });

  it("always includes the unsubscribe link and address", () => {
    expect(rendered.html).toContain("/email/unsubscribe?token=abc");
    expect(rendered.html).toContain("Nairobi");
    expect(rendered.text).toContain("Turn off marketing email");
  });
});
