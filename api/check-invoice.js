import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
  const invoiceId = req.query.id;
  if (!invoiceId) {
    return res.status(400).json({ error: 'Missing invoice ID' });
  }

  try {
    // GraphQL query: fetch recent transactions and find the invoice by externalId
    const query = `
      query PaymentsWithProof($first: Int!) {
        me {
          defaultAccount {
            transactions(first: $first) {
              edges {
                node {
                  initiationVia {
                    ... on InitiationViaLn {
                      externalId
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

    const variables = { first: 50 }; // fetch last 50 transactions

    const response = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_READ_API_KEY // new read API key
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('Blink GraphQL errors:', data.errors);
      return res.status(500).json({ error: 'Blink GraphQL error', details: data.errors });
    }

    const transactions = data.data.me.defaultAccount.transactions.edges;

    // Find the transaction that matches the externalId
    const tx = transactions.find(
      t => t.node.initiationVia?.externalId === invoiceId
    );

    if (!tx) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { paymentHash } = tx.node.initiationVia;
    const preImage = tx.node.settlementVia?.preImage;

    // If preImage exists, payment is settled
    if (!preImage) {
      return res.status(200).json({ paid: false, paymentRequest: invoiceId });
    }

    // Verify payment hash
    const hash = crypto.createHash('sha256').update(Buffer.from(preImage, 'hex')).digest('hex');
    const paid = hash === paymentHash;

    return res.status(200).json({ paid, paymentRequest: invoiceId });

  } catch (err) {
    console.error('Server exception:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
