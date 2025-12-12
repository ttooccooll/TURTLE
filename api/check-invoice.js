import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
  const { id: paymentRequest } = req.query;
  if (!paymentRequest) return res.status(400).json({ error: 'Missing invoice ID' });

  try {
    const query = `
      query PaymentsWithProof($first: Int!) {
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

    const variables = { first: 50 };

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
      return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
    }

    const transactions = data.data.me.defaultAccount.transactions.edges;

    const tx = transactions.find(
      (t) => t.node.initiationVia?.externalId === paymentRequest
    );

    if (!tx) return res.status(404).json({ error: 'Invoice not found in transaction history' });

    const { paymentHash } = tx.node.initiationVia;
    const preImage = tx.node.settlementVia?.preImage;

    if (!preImage) {
      return res.status(200).json({ paid: false, paymentRequest });
    }

    const hash = crypto.createHash('sha256').update(Buffer.from(preImage, 'hex')).digest('hex');
    const paid = hash === paymentHash;

    return res.status(200).json({ paid, paymentRequest });

  } catch (err) {
    console.error('Server exception:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}