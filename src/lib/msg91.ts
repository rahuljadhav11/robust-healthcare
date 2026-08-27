const MSG91_ENDPOINT =
  "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export class Msg91Error extends Error {
  constructor(message: string, public raw: unknown) {
    super(message);
  }
}

/**
 * Normalizes a raw mobile number to the digits-only, country-code-prefixed
 * form MSG91 requires — e.g. "919876543210", never "+919876543210". Assumes
 * India (91) when a bare 10-digit number is given — override via
 * DEFAULT_COUNTRY_CODE if a client base is international.
 */
export function normalizeMobile(raw: string): string {
  // Strips everything but digits, so a leading '+' (or spaces/dashes) never
  // reaches MSG91 — their API expects a bare country-code-prefixed number.
  const digits = raw.replace(/[^0-9]/g, "");
  const countryCode = process.env.DEFAULT_COUNTRY_CODE ?? "91";

  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `${countryCode}${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith(countryCode)) return digits;
  return digits;
}

interface SendDocumentTemplateArgs {
  to: string;
  employeeName: string;
  documentUrl: string;
  filename: string;
}

interface Msg91SendResult {
  ok: boolean;
  msg91MessageId: string | null;
  raw: unknown;
}

export async function sendDocumentTemplate({
  to,
  employeeName,
  documentUrl,
  filename,
}: SendDocumentTemplateArgs): Promise<Msg91SendResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER;
  const templateName = process.env.MSG91_WHATSAPP_TEMPLATE_NAME;
  const languageCode = process.env.MSG91_TEMPLATE_LANGUAGE_CODE ?? "en";

  if (!authKey || !integratedNumber || !templateName) {
    throw new Msg91Error(
      "Missing MSG91_AUTH_KEY, MSG91_INTEGRATED_NUMBER, or MSG91_WHATSAPP_TEMPLATE_NAME env vars",
      null,
    );
  }

  const body = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode, policy: "deterministic" },
        namespace: null,
        to_and_components: [
          {
            to: [to],
            components: {
              header_1: {
                filename,
                type: "document",
                value: documentUrl,
              },
              body_1: { type: "text", value: employeeName },
            },
          },
        ],
      },
    },
  };

  const res = await fetch(MSG91_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: authKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, msg91MessageId: null, raw };
  }

  // MSG91's exact success-response shape for this endpoint hasn't been
  // pinned down against a live call yet — try the field names their other
  // v5 endpoints use, and fall back to storing the raw payload either way
  // so nothing is lost if the shape differs once we test against the real API.
  const data = (raw as { data?: unknown; message_id?: string })?.data;
  const dataObj = (Array.isArray(data) ? data[0] : data) as { messageId?: string } | undefined;
  const messageId =
    dataObj?.messageId ?? (raw as { message_id?: string })?.message_id ?? null;

  if (!messageId) {
    // Temporary: logs the full success payload so the field name can be
    // corrected from a real response instead of guessed. Remove once fixed.
    console.log("[msg91] success response missing a recognized message id:", JSON.stringify(raw));
  }

  return { ok: true, msg91MessageId: messageId, raw };
}

const LOGS_ENDPOINT = "https://control.msg91.com/api/v5/report/logs/wa";

export interface WhatsappLogEntry {
  requestedAt: string;
  status: string;
  failureReason: string | null;
  customerNumber: string;
  uuid: string;
}

/** startDate/endDate as YYYY-MM-DD. MSG91 only allows a 3-day lookback window. */
export async function fetchWhatsappLogs(startDate: string, endDate: string): Promise<WhatsappLogEntry[]> {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) throw new Msg91Error("Missing MSG91_AUTH_KEY env var", null);

  const res = await fetch(`${LOGS_ENDPOINT}?startDate=${startDate}&endDate=${endDate}`, {
    headers: { accept: "application/json", authkey: authKey },
  });
  if (!res.ok) return [];

  const json = await res.json().catch(() => null);
  return Array.isArray(json?.data) ? json.data : [];
}
