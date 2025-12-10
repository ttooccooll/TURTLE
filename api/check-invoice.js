import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing invoice id' });

    try {
        const resp = await fetch(`${process.env.BLINK_SERVER}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.BLINK_API_KEY
            },
            body: JSON.stringify({
                query: `
                    query LnInvoice($id: ID!) {
                        lnInvoice(id: $id) { status }
                    }
                `,
                variables: { id }
            })
        });
        const data = await resp.json();
        const paid = data.data.lnInvoice.status === 'SETTLED';
        res.status(200).json({ paid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}