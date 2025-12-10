import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { id: externalId } = req.query;

    if (!externalId) {
        return res.status(400).json({ error: 'Missing externalId' });
    }

    const BLINK_SERVER = process.env.BLINK_SERVER;
    const BLINK_API_KEY = process.env.BLINK_API_KEY;

    if (!BLINK_SERVER || !BLINK_API_KEY) {
        console.error("BLINK_SERVER or BLINK_API_KEY is missing");
        return res.status(500).json({ error: 'Server configuration error: Blink API not configured' });
    }

    let resp;
    let text;

    // 1️⃣ Network-level fetch
    try {
        resp = await fetch(BLINK_SERVER, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': BLINK_API_KEY
            },
            body: JSON.stringify({
                query: `
                    query LnInvoiceByExternalId($externalId: String!) {
                        lnInvoiceByExternalId(externalId: $externalId) {
                            id
                            paymentRequest
                            status
                        }
                    }
                `,
                variables: { externalId }
            })
        });
    } catch (fetchErr) {
        console.error("Network/fetch error when contacting Blink:", fetchErr);
        return res.status(500).json({ error: "Network error contacting Blink", details: fetchErr.message });
    }

    // 2️⃣ Read raw response text
    try {
        text = await resp.text();
        console.log("Blink raw response:", text);
    } catch (readErr) {
        console.error("Failed to read Blink response text:", readErr);
        return res.status(500).json({ error: "Failed to read Blink response", details: readErr.message });
    }

    // 3️⃣ Parse JSON safely
    let data;
    try {
        data = JSON.parse(text);
    } catch (parseErr) {
        console.error("Failed to parse Blink response as JSON:", parseErr);
        return res.status(500).json({ error: "Invalid JSON from Blink", details: text });
    }

    // 4️⃣ HTTP-level errors
    if (!resp.ok) {
        console.error('Blink returned HTTP error', resp.status, data);
        return res.status(500).json({ error: 'Blink server returned an HTTP error', status: resp.status, details: data });
    }

    // 5️⃣ GraphQL-level errors
    if (data.errors) {
        console.error('Blink GraphQL errors:', data.errors);
        return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
    }

    // 6️⃣ Check if invoice exists
    const invoice = data.data?.lnInvoiceByExternalId;
    if (!invoice) {
        console.error("Invoice not found in Blink response");
        return res.status(404).json({ error: 'Invoice not found' });
    }

    // 7️⃣ Return invoice status
    const paid = invoice.status === 'SETTLED';
    res.status(200).json({ paid, paymentRequest: invoice.paymentRequest });
}
