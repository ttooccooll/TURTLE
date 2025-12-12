import fetch from 'node-fetch';

export default async function handler(req, res) {
  const invoiceId = req.query.id;

  if (!invoiceId) {
    console.warn("Missing invoice ID in request");
    return res.status(400).json({ error: 'Missing invoice ID' });
  }

  // Log env vars
  console.log("BLINK_SERVER:", process.env.BLINK_SERVER);
  console.log("BLINK_API_KEY:", process.env.BLINK_API_KEY ? "present" : "missing");

  const query = `
    query CheckInvoice($id: ID!) {
      lightningInvoice(id: $id) {
        id
        memo
        satoshi
        settled
      }
    }
  `;

  const variables = { id: invoiceId };

  let response;
  try {
    response = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.BLINK_API_KEY || ""
      },
      body: JSON.stringify({ query, variables }),
      timeout: 10000 // 10s timeout for safety
    });
  } catch (fetchErr) {
    console.error("Fetch to Blink failed:", fetchErr);
    return res.status(500).json({ error: "Fetch to Blink failed", details: fetchErr.message });
  }

  let json;
  try {
    json = await response.json();
  } catch (parseErr) {
    console.error("Failed to parse Blink response as JSON:", parseErr);
    return res.status(500).json({ error: "Failed to parse Blink response", details: parseErr.message });
  }

  if (!json) {
    console.error("Blink returned empty response");
    return res.status(500).json({ error: "Blink returned empty response" });
  }

  if (json.errors) {
    console.error("Blink GraphQL returned errors:", json.errors);
    return res.status(500).json({ error: "Blink GraphQL errors", details: json.errors });
  }

  const invoice = json.data?.lightningInvoice;

  if (!invoice) {
    console.warn("Invoice not found for ID:", invoiceId);
    return res.status(404).json({ error: "Invoice not found" });
  }

  console.log(`Invoice ${invoiceId} found. Settled:`, invoice.settled);

  return res.status(200).json({
    paid: invoice.settled === true,
    invoice
  });
}
