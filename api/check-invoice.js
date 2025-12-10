import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { id: externalId } = req.query;
    if (!externalId) return res.status(400).json({ error: 'Missing externalId' });

    try {
        const BLINK_SERVER = process.env.BLINK_SERVER;
        const BLINK_API_KEY = process.env.BLINK_API_KEY;

        const resp = await fetch(BLINK_SERVER, {
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

        const text = await resp.text(); // log raw response first
        console.log("Blink raw response:", text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            console.error("Failed to parse Blink response as JSON:", err);
            return res.status(500).json({ error: "Invalid JSON from Blink", details: text });
        }

        if (!resp.ok) {
            console.error('Blink server returned HTTP error:', resp.status, data);
            return res.status(500).json({ error: 'Blink server returned an error', details: data });
        }

        if (data.errors) {
            console.error('Blink GraphQL errors:', data.errors);
            return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
        }

        const invoice = data.data?.lnInvoiceByExternalId;
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const paid = invoice.status === 'SETTLED';
        res.status(200).json({ paid, paymentRequest: invoice.paymentRequest });

    } catch (err) {
        console.error('Server exception:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
}
