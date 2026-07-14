import {
  withNwc,
  satsToMsats,
  MIN_SATS,
  MAX_SATS,
  INVOICE_EXPIRY_SECONDS,
} from "./_nwc.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount < MIN_SATS || amount > MAX_SATS) {
    return res.status(400).json({
      error: `Amount must be a whole number of sats between ${MIN_SATS} and ${MAX_SATS}`,
    });
  }

  // NIP-47 caps descriptions at 128 chars, and the memo carries a username.
  const rawMemo = req.body?.memo;
  const memo =
    typeof rawMemo === "string" && rawMemo.trim()
      ? rawMemo.trim().slice(0, 128)
      : "Turtle Game Payment";

  try {
    const invoice = await withNwc((nwc) =>
      nwc.makeInvoice({
        amount: satsToMsats(amount),
        description: memo,
        expiry: INVOICE_EXPIRY_SECONDS,
      }),
    );

    return res.status(200).json({
      paymentHash: invoice.payment_hash,
      paymentRequest: invoice.invoice,
      satoshis: amount,
    });
  } catch (err) {
    console.error("create-invoice failed:", err);
    return res.status(502).json({ error: "Failed to create invoice" });
  }
}
