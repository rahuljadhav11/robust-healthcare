// Maps Meta/WhatsApp Cloud API error codes (surfaced via MSG91's metaErrorCode)
// and our own internal failure strings to plain-language explanations an
// admin can act on, instead of raw JSON or a bare error code.
const META_ERROR_CODES: Record<string, string> = {
  "131053": "The report PDF couldn't be downloaded by WhatsApp. This is usually temporary — try sending again.",
  "131026": "This number can't receive WhatsApp messages — it may not be on WhatsApp, or has blocked business messages.",
  "131047": "Too much time passed since this contact last messaged the business number.",
  "131048": "WhatsApp is rate-limiting this number for spam-like behavior.",
  "131049": "This message was held back by WhatsApp's delivery limits for this account.",
  "132000": "The message template's fields don't match what was sent — the template may have changed.",
  "132001": "The message template isn't approved or doesn't exist anymore.",
  "132005": "The message template's content doesn't match what's approved.",
  "130429": "Too many messages sent too quickly — WhatsApp is rate-limiting this account.",
  "368": "This WhatsApp account was temporarily restricted for a policy violation.",
  "190": "The connection to MSG91 was rejected — the account's API credentials may need attention.",
  "100": "WhatsApp rejected part of this message as invalid.",
};

export function humanizeError(rawError: string | null | undefined): string {
  if (!rawError) return "Delivery failed for an unknown reason.";

  const codeMatch = rawError.match(/"metaErrorCode"\s*:\s*"?(\d+)"?/) ?? rawError.match(/^(\d{3,6}):/);
  if (codeMatch) {
    const known = META_ERROR_CODES[codeMatch[1]];
    if (known) return known;
  }

  if (/unauthorized/i.test(rawError)) {
    return "MSG91 rejected the request — the account's API credentials may need attention.";
  }
  if (/malformed/i.test(rawError) && /phone|number/i.test(rawError)) {
    return "This employee's mobile number looks invalid.";
  }
  if (/employee record missing/i.test(rawError)) {
    return "Internal error — the employee record was missing when sending.";
  }
  if (/missing msg91_auth_key|missing.*env var/i.test(rawError)) {
    return "The system isn't configured to send yet — contact your administrator.";
  }

  // Fall back to a trimmed version of the raw reason rather than a wall of JSON.
  const trimmed = rawError.replace(/^MSG91 rejected send:\s*/i, "").slice(0, 160);
  return trimmed || "Delivery failed for an unknown reason.";
}
