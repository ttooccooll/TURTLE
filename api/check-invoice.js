import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
  const { id: paymentRequest } = req.query;

  if (!paymentRequest) {
    return res.status(400).json({ error: 'Missing paymentRequest ID' });
  }

  try {
    const query = `
      query Payments($first: Int!) {
        me {
          defaultAccount {
            transactions(first: $first) {
              edges {
                node {
                  initiationVia {
                    ... on InitiationViaLn {
                      paymentRequest
                      paymentHash
                    }
                  }
                  settlementVia {
                    ... on SettlementViaLn {
                      preImage
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = { first: 50 }; // adjust if you need more history

    const resp = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await resp.json();

    if (data.errors) {
      console.error('Blink GraphQL errors:', data.errors);
      return res.status(500).json({ error: 'Blink GraphQL error', details: data.errors });
    }

    const transactions = data.data.me.defaultAccount.transactions.edges;

    // Find the transaction that matches our paymentRequest
    const tx = transactions.find(
      t => t.node.initiationVia?.paymentRequest === paymentRequest
    );

    if (!tx) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { paymentHash } = tx.node.initiationVia;
    const preImage = tx.node.settlementVia?.preImage;

    // If preImage exists, the invoice is paid
    if (!preImage) {
      return res.status(200).json({ paid: false, paymentRequest });
    }

    // Verify paymentHash matches the settled preImage
    const hash = crypto.createHash('sha256').update(Buffer.from(preImage, 'hex')).digest('hex');
    const paid = hash === paymentHash;

    return res.status(200).json({ paid, paymentRequest });

  } catch (err) {
    console.error('Server exception:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
