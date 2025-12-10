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

        if (!resp.ok) {
            const text = await resp.text();
            console.error('Blink server error:', text);
            return res.status(500).json({ error: 'Blink server returned an error', details: text });
        }

        const data = await resp.json();

        if (data.errors) {
            console.error('Blink GraphQL errors:', data.errors);
            return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
        }

        const invoice = data.data.lnInvoiceByExternalId;
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
