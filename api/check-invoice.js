import fetch from 'node-fetch';

export default async function handler(req, res) {
  const invoiceId = req.query.id;

  if (!invoiceId) {
    console.warn("Missing invoice ID in query");
    return res.status(400).json({ error: "Missing invoice ID" });
  }

  console.log("Checking invoice ID:", invoiceId);

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
                      externalId
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

    const variables = { first: 1000 }; // get the latest 1000 transactions

    console.log("Sending request to Blink...");
    const resp = await fetch(process.env.BLINK_SERVER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await resp.json();
    console.log("Blink response:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return res.status(500).json({ error: "Blink GraphQL errors", details: data.errors });
    }

    if (!data.data?.me?.defaultAccount?.transactions?.edges) {
      console.error("Unexpected Blink response structure");
      return res.status(500).json({ error: "Invalid Blink response structure", data });
    }

    const transactions = data.data.me.defaultAccount.transactions.edges;

    const tx = transactions.find(
      (t) => t.node.initiationVia?.externalId === invoiceId
    );

    if (!tx) {
      console.warn("Invoice not found in latest transactions");
      return res.status(404).json({ error: "Invoice not found" });
    }

    const { paymentHash } = tx.node.initiationVia;
    const preImage = tx.node.settlementVia?.preImage;

    if (!preImage) {
      console.log("Invoice exists but not yet paid");
      return res.status(200).json({ paid: false, paymentRequest: tx.node.initiationVia.paymentRequest });
    }

    const crypto = await import("crypto"); // dynamic import for Vercel edge compatibility
    const hash = crypto.createHash("sha256").update(Buffer.from(preImage, "hex")).digest("hex");
    const paid = hash === paymentHash;

    console.log("Invoice check result:", paid);

    return res.status(200).json({ paid, paymentRequest: tx.node.initiationVia.paymentRequest });

  } catch (err) {
    console.error("Server exception in check-invoice:", err.stack);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
