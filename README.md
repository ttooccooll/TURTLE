# Turtle 🐢

A daily word puzzle game built with vanilla JavaScript and Bitcoin Lightning payments for unlimited gameplay.

**Play the live game:** [https://turtlewordgame.xyz](https://turtlewordgame.xyz)

---

## Features

- **Daily Word Puzzle** — Guess the 5-letter word in 6 attempts
- **14 Languages** — Afrikaans, Dutch, English, French, German, Italian, Polish, Portuguese, Spanish, Swahili, Turkish, Vietnamese, Xhosa, Zulu
- **Bitcoin Lightning Payments** — One free game per day, with Lightning Network payments for unlimited play
- **Global Leaderboard** — Compete with players worldwide
- **Nostr Integration** — Share your results on the decentralized social protocol
- **Mobile-First Design** — Fully responsive with touch-optimized keyboard
- **Accessible** — Keyboard navigation, ARIA labels, reduced motion support

---

## How to Play

1. Open [https://turtlewordgame.xyz](https://turtlewordgame.xyz)
2. Select your preferred language from the dropdown
3. Type a 5-letter word using your keyboard or on-screen keys
4. Press Enter to submit your guess
5. Use the color feedback to narrow down the word:
   - **Green** — Letter is correct and in the right spot
   - **Yellow** — Letter is in the word but wrong position
   - **Gray** — Letter is not in the word
6. Solve the puzzle in 6 guesses or fewer!

---

## Running Locally

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Create environment file for Lightning payments
cp .env.example .env
# Add a Nostr Wallet Connect (NIP-47) connection string:
# NWC_URL=nostr+walletconnect://<pubkey>?relay=wss://...&secret=<hex>

# Start the server (Vercel CLI runs the /api functions locally)
npm start
```

The game will be available at `http://localhost:3000`.

### Getting an `NWC_URL`

Any NWC-capable wallet issues one — [Alby Hub](https://albyhub.com), [Coinos](https://coinos.io),
LNbits, Zeus, and others. In Alby Hub it's under **Connections → Add Connection**.

**Scope the connection to `make_invoice` and `lookup_invoice` only.** This secret sits on a web
server, so it must not be able to spend: never grant it `pay_invoice`. Worst case, a leaked key
lets someone generate invoices that pay *you*.

Because the app speaks NIP-47 rather than a vendor API, switching wallets later means changing
`NWC_URL` and nothing else.

For local testing without real sats, `curl -X POST 'https://faucet.nwc.dev?balance=50000'`
returns a working throwaway connection string on a fake-sats network.

---

## Project Structure

```
turtle/
├── index.html          # Main HTML with all modals
├── script.js           # Game logic, API calls, Nostr integration
├── style.css           # Styling with responsive design
├── package.json        # Dependencies and scripts
├── api/
│   ├── _nwc.js            # Shared NWC client + connection lifecycle
│   ├── create-invoice.js  # Lightning invoice generation
│   └── check-invoice.js   # Payment verification
└── words/
    ├── english.txt     # 5-letter word lists by language
    ├── french.txt
    ├── german.txt
    └── ...             # 14 language word lists
```

---

## API Endpoints

Both endpoints talk to your wallet over Nostr Wallet Connect (NIP-47), using the
`make_invoice` and `lookup_invoice` methods.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-invoice` | POST | Creates a Lightning invoice via NWC |
| `/api/check-invoice` | GET | Checks payment status by hash |

### Create Invoice

```bash
curl -X POST http://localhost:3000/api/create-invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "memo": "Turtle Game Payment"}'
```

**Response:**
```json
{
  "paymentHash": "abc123...",
  "paymentRequest": "lnbc100...",
  "satoshis": 100
}
```

Amounts are whole sats between 1 and 1,000,000; invoices expire after 10 minutes.

### Check Invoice

```bash
curl "http://localhost:3000/api/check-invoice?paymentHash=abc123..."
```

**Response:**
```json
{
  "paid": true,
  "status": "settled"
}
```

`paid` is the field to trust. NIP-47 treats `status` as optional, so it is derived from the
invoice's settlement timestamp and preimage rather than reported state.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Backend | Node.js 22+ (Vercel serverless functions) |
| Payments | Bitcoin Lightning Network via Nostr Wallet Connect (NIP-47) |
| Social | Nostr Protocol |
| Fonts | Clear Sans, Helvetica Neue |

### External Dependencies

- **WebLN** (v0.3.2) — Browser Lightning wallet integration
- **QRCode** (via CDN) — QR code generation for invoice payments
- **@getalby/sdk** — NWC client for server-side invoice creation and lookup

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| A-Z | Type a letter |
| Enter | Submit guess |
| Backspace | Delete last letter |

---

## Game Rules

- One free game per 24-hour period (resets at midnight UTC)
- Additional games require a 100 satoshi Lightning payment
- Word must be exactly 5 letters
- For English, guesses must be valid dictionary words
- Statistics tracked: games played, win rate, current streak, max streak

---

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing`)
4. Open a Pull Request

---

## License

MIT License — feel free to use, modify, and distribute.

---

## Acknowledgments

- Lightning payments powered by [Nostr Wallet Connect](https://nwc.dev/) (NIP-47)
- Social sharing powered by the [Nostr](https://nostr.com/) protocol
- Created by [jasonb](https://stacker.news/@jasonb) on Stacker News
