import { createVerify } from "node:crypto";

export type SnsEnvelope = {
  Type: string;
  MessageId?: string;
  Message: string;
  Timestamp: string;
  TopicArn: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
};

function certificateUrl(value: string | undefined): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!/^sns\.[a-z0-9-]+\.amazonaws\.com$/i.test(url.hostname) && url.hostname !== "sns.amazonaws.com") {
    return null;
  }
  return url;
}

function canonical(envelope: SnsEnvelope): string | null {
  const common: Array<[string, string | undefined]> = [
    ["Message", envelope.Message],
    ["MessageId", envelope.MessageId ?? ""],
  ];
  let fields: Array<[string, string | undefined]>;
  switch (envelope.Type) {
    case "Notification":
      fields = [
        ...common,
        ["Subject", envelope.Subject],
        ["Timestamp", envelope.Timestamp],
        ["TopicArn", envelope.TopicArn],
        ["Type", envelope.Type],
      ];
      break;
    case "SubscriptionConfirmation":
    case "UnsubscribeConfirmation":
      fields = [
        ...common,
        ["SubscribeURL", envelope.SubscribeURL],
        ["Timestamp", envelope.Timestamp],
        ["Token", envelope.Token],
        ["TopicArn", envelope.TopicArn],
        ["Type", envelope.Type],
      ];
      break;
    default:
      return null;
  }

  const lines: string[] = [];
  for (const [key, value] of fields) {
    if (value === undefined) continue;
    lines.push(key, value);
  }
  return `${lines.join("\n")}\n`;
}

/** Verifies the SNS signature with the certificate SNS publishes. */
export async function verifySnsEnvelope(
  envelope: SnsEnvelope,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (envelope.Type === "UnsubscribeConfirmation") return true;
  if (!envelope.Signature || !envelope.SigningCertURL) return false;
  const certUrl = certificateUrl(envelope.SigningCertURL);
  if (!certUrl) return false;
  const body = canonical(envelope);
  if (!body) return false;

  const response = await fetchImpl(certUrl, { cache: "no-store" });
  if (!response.ok) return false;
  const certificate = await response.text();
  if (!certificate.includes("BEGIN CERTIFICATE")) return false;

  const algorithm = envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  const verifier = createVerify(algorithm);
  verifier.update(body, "utf8");
  verifier.end();
  try {
    return verifier.verify(certificate, envelope.Signature, "base64");
  } catch {
    return false;
  }
}

export function topicMatches(envelope: SnsEnvelope): boolean {
  const expected = process.env.SES_SNS_TOPIC_ARN;
  if (!expected) return true;
  return envelope.TopicArn === expected;
}
