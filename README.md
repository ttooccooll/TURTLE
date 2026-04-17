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

# Create environment file for Lightning payments (optional)
cp .env.example .env
# Add your Blink API credentials if you want payment features:
# BLINK_API_KEY=your_api_key
# BLINK_WALLET_ID=your_wallet_id
# BLINK_SERVER=https://api.blink.sv/graphql

# Start the server
npm start
```

The game will be available at `http://localhost:3000`.

---

## Project Structure

```
turtle/
├── index.html          # Main HTML with all modals
├── script.js           # Game logic, API calls, Nostr integration
├── style.css           # Styling with responsive design
├── package.json        # Dependencies and scripts
├── api/
│   ├── create-invoice.js   # Lightning invoice generation
│   └── check-invoice.js   # Payment verification
└── words/
    ├── english.txt     # 5-letter word lists by language
    ├── french.txt
    ├── german.txt
    └── ...             # 14 language word lists
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-invoice` | POST | Creates a Lightning invoice via Blink |
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
  "externalId": "uuid...",
  "satoshis": 100
}
```

### Check Invoice

```bash
curl "http://localhost:3000/api/check-invoice?paymentHash=abc123..."
```

**Response:**
```json
{
  "paid": true,
  "status": "PAID"
}
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Backend | Node.js |
| Payments | Bitcoin Lightning Network (Blink API) |
| Social | Nostr Protocol |
| Fonts | Clear Sans, Helvetica Neue |

### External Dependencies

- **WebLN** (v0.3.2) — Browser Lightning wallet integration
- **QRCode** (via CDN) — QR code generation for invoice payments
- **node-fetch** — HTTP client for server-side API calls

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

- Lightning payments powered by [Blink](https://blink.sv/)
- Social sharing powered by the [Nostr](https://nostr.com/) protocol
- Created by [jasonb](https://stacker.news/@jasonb) on Stacker News
