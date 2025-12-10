import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { id: externalId } = req.query;
    if (!externalId) {
        return res.status(400).json({ error: 'Missing externalId' });
    }

    try {
        const BLINK_SERVER = process.env.BLINK_SERVER;
        const BLINK_API_KEY = process.env.BLINK_API_KEY;

        const query = `
            query LnInvoicePaymentStatus($input: LnInvoicePaymentStatusInput!) {
                lnInvoicePaymentStatus(input: $input) {
                    status
                    id
                    paymentRequest
                }
            }
        `;

        const variables = {
            input: { externalId }
        };

        console.log("Sending request to Blink:", { query, variables });

        const resp = await fetch(BLINK_SERVER, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': BLINK_API_KEY
            },
            body: JSON.stringify({ query, variables })
        });

        const text = await resp.text();
        console.log("Raw response from Blink:", text);

        if (!resp.ok) {
            console.error('Blink server returned error:', text);
            return res.status(500).json({ error: 'Blink server returned an error', details: text });
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseErr) {
            console.error('Failed to parse JSON from Blink:', parseErr);
            return res.status(500).json({ error: 'Invalid JSON from Blink', details: text });
        }

        if (data.errors) {
            console.error('Blink GraphQL errors:', data.errors);
            return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
        }

        const invoice = data.data.lnInvoicePaymentStatus;

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
