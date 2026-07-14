import { withNwc } from "./_nwc.js";

const PAYMENT_HASH = /^[0-9a-f]{64}$/i;

export default async function handler(req, res) {
  const paymentHash = req.query.paymentHash;
  if (!paymentHash || !PAYMENT_HASH.test(paymentHash)) {
    return res.status(400).json({ error: "Missing or malformed paymentHash" });
  }

  try {
    const tx = await withNwc((nwc) =>
      nwc.lookupInvoice({ payment_hash: paymentHash }),
    );

    // NIP-47 marks `state` optional, so settle the question on the two fields
    // a paid invoice always carries.
    const paid = Boolean(tx.settled_at && tx.preimage);

    return res.status(200).json({
      paid,
      status: tx.state ?? (paid ? "settled" : "pending"),
    });
  } catch (err) {
    console.error("check-invoice failed:", err);
    return res.status(502).json({ error: "Failed to check invoice" });
  }
}
