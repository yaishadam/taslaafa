/**
 * The message that goes into the Viber or WhatsApp thread the order came in
 * on.
 *
 * It is read on a phone, in a thread, next to a dozen other messages. So:
 * short, the shop's name first so it is obvious who is writing, and the
 * warning about the code before the link rather than after it, because
 * nobody reads past a link.
 *
 * No emoji. This is a receipt, not a greeting.
 */

export function shareMessage({
  shopName,
  orderRef,
  driverName,
  promiseMinutes,
  url,
}: {
  shopName: string;
  orderRef: string | null;
  driverName: string | null;
  promiseMinutes: number;
  url: string;
}): string {
  const order = orderRef ? ` ${orderRef}` : "";
  const who = driverName ? `${driverName} is bringing it` : "It is on the way";

  return [
    `${shopName}: your order${order} has left the shop.`,
    `${who}, about ${promiseMinutes} minutes.`,
    ``,
    `Open this link for your 4-digit delivery code. Only give the code once the order is in your hands — never over the phone.`,
    ``,
    url,
  ].join("\n");
}

export function deliveryUrl(token: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/d/${token}`;
}

/** viber://forward?text=... opens Viber with the message ready to send. */
export function viberLink(message: string): string {
  return `viber://forward?text=${encodeURIComponent(message)}`;
}

/**
 * wa.me with a number goes straight to that chat. Staff typed the number
 * into the form, so use it rather than making them pick from a list.
 */
export function whatsappLink(message: string, e164?: string | null): string {
  const to = e164 ? e164.replace(/^\+/, "") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/**
 * The proof, as a message a shop owner can paste back into the thread where
 * the complaint arrived. Plain text, timestamps first, no argument in it --
 * the timestamps are the argument.
 */
export function proofMessage({
  shopName,
  customerName,
  orderRef,
  lines,
  doorToDoor,
  beatPromise,
  url,
}: {
  shopName: string;
  customerName: string;
  orderRef: string | null;
  lines: { label: string; at: string }[];
  doorToDoor: string | null;
  beatPromise: boolean | null;
  url: string;
}): string {
  const head = orderRef
    ? `${shopName} — order ${orderRef} for ${customerName}`
    : `${shopName} — delivery for ${customerName}`;

  const body = lines.map((l) => `${l.at}  ${l.label}`);

  const footer: string[] = [];
  if (doorToDoor) footer.push(`Door to door: ${doorToDoor}`);
  if (beatPromise !== null) {
    footer.push(beatPromise ? "Inside the promised time." : "Past the promised time.");
  }

  return [head, "", ...body, "", ...footer, "", url]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}
