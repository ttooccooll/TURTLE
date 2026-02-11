const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

let WORDS = [];
let targetWord = "";
let currentGuess = "";
let currentRow = 0;
let gameOver = false;
let letterStates = {};
let activeTimeouts = [];
let isFocusSet = false;
let canPlayGame = false;
let currentLanguage = "english";
let username = localStorage.getItem("turtleUsername") || "";

canPlayGame = sessionStorage.getItem("turtleCanPlay") === "true";

const gameBoard = document.getElementById("game-board");
const messageContainer = document.getElementById("message-container");
const keyboard = document.getElementById("keyboard");

function handleFirstKeypress(e) {
  const activeEl = document.activeElement;
  const openModal = document.querySelector(".modal.show");

  // Don't steal focus if typing in a modal input
  if (
    (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
    openModal
  ) {
    return; // let modal handle it
  }

  if (/^[a-zA-Z]$/.test(e.key) || e.key === "Enter" || e.key === "Backspace") {
    gameBoard.focus();
    isFocusSet = true;
    document.removeEventListener("keydown", handleFirstKeypress);
  }
}

async function enableWebLN() {
  if (typeof WebLN === "undefined") {
    console.info("WebLN not available; QR payment will be used.");
    return false;
  }

  try {
    const webln = await WebLN.requestProvider();
    await webln.enable();
    console.log("WebLN enabled successfully!");
    return true;
  } catch (error) {
    console.warn("WebLN enable failed; falling back to QR:", error);
    return false;
  }
}

function setSafeTimeout(fn, delay) {
  const id = setTimeout(fn, delay);
  activeTimeouts.push(id);
}

function getWordListURL(lang) {
  const map = {
    afrikaans: "afrikaans.txt",
    dutch: "dutch.txt",
    english: "english.txt",
    french: "french.txt",
    german: "german.txt",
    italian: "italian.txt",
    polish: "polish.txt",
    portuguese: "portuguese.txt",
    spanish: "spanish.txt",
    swahili: "swahili.txt",
    turkish: "turkish.txt",
    vietnamese: "vietnamese.txt",
    xhosa: "xhosa.txt",
    zulu: "zulu.txt",
  };

  return `/words/${map[lang]}`;
}

async function loadWordList(language = "english") {
  const url = getWordListURL(language);

  const response = await fetch(url);

  if (!response.ok) {
    console.error("Failed to load word list:", url, response.status);
    WORDS = [];
    return;
  }

  const text = await response.text();
  WORDS = text
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => w.length === WORD_LENGTH)
    .map((w) => w.toUpperCase());
}

function canPlayFreeGameToday() {
  const today = new Date().toISOString().split("T")[0];
  const lastPlayDate = localStorage.getItem("turtleLastPlayDate");

  return lastPlayDate !== today;
}

function markFreeGamePlayed() {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem("turtleLastPlayDate", today);
}

async function startNewGame() {
  inputLocked = false;
  isFocusSet = false;
  document.addEventListener("keydown", handleFirstKeypress);

  activeTimeouts.forEach((id) => clearTimeout(id));
  activeTimeouts = [];

  currentGuess = "";
  currentRow = 0;
  gameOver = false;
  letterStates = {};

  document.getElementById("tip-btn").style.display = "inline-block";
  document.getElementById("tip-btn").disabled = false;

  createGameBoard();
  resetKeyboard();

  targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];

  let paymentRequired = !canPlayFreeGameToday();

  if (!paymentRequired) {
    markFreeGamePlayed();
  }

  if (paymentRequired) {
    showMessage("Payment required to continue playing...");

    inputLocked = true;
    const paymentSuccess = await handlePayment();
    if (!paymentSuccess) {
      showMessage("Payment not completed. Game cannot start.");
      canPlayGame = false;
      return;
    }

    inputLocked = false;
    canPlayGame = true;
    sessionStorage.setItem("turtleCanPlay", "true");
    showMessage("Payment received! Game started!");
  } else {
    canPlayGame = true;
    sessionStorage.setItem("turtleCanPlay", "true");
    showMessage("Game started! Good luck!");
  }

  closeModal("game-over-modal");
  closeModal("help-modal");
  closeModal("stats-modal");
  closeModal("username-modal");
}

async function generateInvoiceForBlink(amountSats) {
  try {
    const usernameSafe = username || "Anonymous";
    const resp = await fetch("/api/create-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        amount: amountSats,
        memo: `Turtle Game Payment - ${usernameSafe}`,
      }),
    });

    const text = await resp.text();
    console.log("Raw response:", text);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Response is not JSON");
      throw new Error("Failed to generate invoice: non-JSON response");
    }

    if (!resp.ok || !data.paymentRequest) {
      console.error("Invoice data missing paymentRequest:", data);
      throw new Error("Failed to generate invoice");
    }

    return data.paymentRequest;
  } catch (err) {
    console.error("Invoice generation error:", err);
    throw err;
  }
}

async function payInvoice(paymentRequest) {
  if (typeof WebLN === "undefined") throw new Error("WebLN not available");

  try {
    const webln = await WebLN.requestProvider();
    await webln.enable();
    await webln.sendPayment(paymentRequest);
  } catch (err) {
    throw new Error(`Payment failed ${err.message}`);
  }
}

async function payWithQR(amountSats) {
  const tipBtn = document.getElementById("tip-btn");
  tipBtn.disabled = true;
  const usernameSafe = username || "Anonymous";
  const memo = `Turtle Game Payment - ${usernameSafe}`;

  try {
    const resp = await fetch("/api/create-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ amount: amountSats, memo }),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse JSON from server:", text, err);
      showError("Payment failed: invalid server response.");
      tipBtn.disabled = false;
      return false;
    }

    if (!resp.ok || !data.paymentRequest || !data.paymentHash) {
      console.error("Invalid invoice data from server:", data);
      showError("Could not generate invoice. Please try again.");
      tipBtn.disabled = false;
      return false;
    }

    const invoice = data.paymentRequest;
    const paymentHash = data.paymentHash;

    showModal("payment-qr-modal");

    const canvas = document.getElementById("qr-code");
    const ctx = canvas.getContext("2d");
    canvas.width = 200;
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await QRCode.toCanvas(canvas, invoice, { width: 200 });

    const invoiceText = document.getElementById("invoice-text");
    invoiceText.value = invoice;

    document.getElementById("copy-invoice-btn").onclick = async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(invoiceText.value);
        } else {
          invoiceText.select();
          document.execCommand("copy");
        }
        document.getElementById("qr-status").textContent = "Invoice copied 📋";
      } catch (err) {
        invoiceText.select();
        document.execCommand("copy");
        document.getElementById("qr-status").textContent = "Invoice copied 📋";
      }
    };

    document.getElementById("close-qr-btn").onclick = () => {
      closeModal("payment-qr-modal");
      closeModal("game-over-modal");
      showMessage("Payment still pending. You can continue browsing.");
    };

    const statusEl = document.getElementById("qr-status");
    statusEl.textContent = "Waiting for payment...";

    const paid = await waitForPayment(paymentHash, statusEl);
    if (paid) {
      showMessage("Payment received! Thank you!");
      closeModal("payment-qr-modal");
      tipBtn.disabled = false;
      return true;
    } else {
      showError("Payment not received. Invoice expired.");
      closeModal("payment-qr-modal");
      tipBtn.disabled = false;
      return false;
    }
  } catch (err) {
    console.error("QR payment failed:", err);
    showError("Payment failed. Please try again.");
    tipBtn.disabled = false;
    return false;
  }
}

function waitForPayment(paymentHash, statusEl, timeout = 5 * 60 * 1000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(false);
        return;
      }

      try {
        const resp = await fetch(
          `/api/check-invoice?paymentHash=${paymentHash}`,
          {
            cache: "no-store",
          },
        );

        if (!resp.ok) throw new Error(`Invoice check failed: ${resp.status}`);

        let data;
        const contentType = resp.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            data = await resp.json();
          } catch (jsonErr) {
            const text = await resp.text();
            console.error("Failed to parse JSON in waitForPayment:", text);
            return;
          }
        } else {
          const text = await resp.text();
          console.error("Non-JSON response in waitForPayment:", text);
          return;
        }

        if (data.paid) {
          clearInterval(interval);
          statusEl.textContent = "Payment received!";
          resolve(true);
        }
      } catch (err) {
        console.error("waitForPayment error:", err);
      }
    }, 1000);
  });
}

async function handlePayment() {
  const tipBtn = document.getElementById("tip-btn");
  tipBtn.style.display = "inline-block";
  tipBtn.disabled = true;

  try {
    if (typeof WebLN !== "undefined") {
      try {
        const invoice = await generateInvoiceForBlink(100);
        await payInvoice(invoice);
        showMessage("Payment received! Game unlocked ⚡");
        tipBtn.disabled = false;
        return true;
      } catch (weblnErr) {
        console.warn("WebLN failed, falling back to QR:", weblnErr);
      }
    }
    const usernameSafe = username || "Anonymous";
    const memo = `Turtle Game Payment - ${usernameSafe}`;

    const qrSuccess = await payWithQR(100, memo);
    tipBtn.disabled = false;
    return qrSuccess;
  } catch (err) {
    console.error("Payment failed:", err);
    showError("Payment failed. Please try again.");
    tipBtn.disabled = false;
    return false;
  }
}

function createGameBoard() {
  gameBoard.innerHTML = "";
  for (let i = 0; i < MAX_GUESSES; i++) {
    const row = document.createElement("div");
    row.className = "tile-row";
    row.id = `row-${i}`;
    for (let j = 0; j < WORD_LENGTH; j++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${i}-${j}`;
      tile.textContent = "";
      row.appendChild(tile);
    }
    gameBoard.appendChild(row);
  }
}

function resetKeyboard() {
  const keys = document.querySelectorAll(".key");
  keys.forEach((key) => key.classList.remove("correct", "present", "absent"));
}

function addLetter(letter) {
  if (currentGuess.length < WORD_LENGTH) {
    currentGuess += letter;
    updateCurrentRow();
  }
}

function deleteLetter() {
  if (currentGuess.length > 0) {
    currentGuess = currentGuess.slice(0, -1);
    updateCurrentRow();
  }
}

function updateCurrentRow() {
  const row = document.getElementById(`row-${currentRow}`);
  const tiles = row.querySelectorAll(".tile");
  tiles.forEach((tile, index) => {
    if (index < currentGuess.length) {
      tile.textContent = currentGuess[index];
      tile.classList.add("filled");
    } else {
      tile.textContent = "";
      tile.classList.remove("filled");
    }
  });
}

function isValidEnglishWord(word) {
  return WORDS.includes(word.toUpperCase());
}

function submitGuess() {
  if (currentGuess.length !== WORD_LENGTH) {
    showMessage("Not enough letters");
    shakeRow();
    return;
  }

  // Only enforce dictionary check for English
  if (
    currentLanguage === "english" &&
    !WORDS.includes(currentGuess.toUpperCase())
  ) {
    showMessage("Word not in dictionary");
    shakeRow();
    return;
  }

  checkGuess();
}

function shakeRow() {
  const row = document.getElementById(`row-${currentRow}`);
  row.classList.add("shake");
  setSafeTimeout(() => row.classList.remove("shake"), 500);
}

let inputLocked = false;

function handleKeyPress(key) {
  if (!canPlayGame || gameOver || inputLocked) return;

  if (key === "enter") {
    submitGuess();
  } else if (key === "backspace") {
    deleteLetter();
  } else if (/^[a-z]$/.test(key)) {
    addLetter(key.toUpperCase());
  }
}

function checkGuess() {
  const row = document.getElementById(`row-${currentRow}`);
  const tiles = row.querySelectorAll(".tile");
  const targetLetters = targetWord.split("");
  const guessLetters = currentGuess.split("");
  const results = new Array(WORD_LENGTH).fill("absent");

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      results[i] = "correct";
      targetLetters[i] = null;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (results[i] === "absent" && targetLetters.includes(guessLetters[i])) {
      results[i] = "present";
      targetLetters[targetLetters.indexOf(guessLetters[i])] = null;
    }
  }

  inputLocked = true;

  tiles.forEach((tile, index) => {
    setSafeTimeout(() => {
      tile.classList.add("reveal", results[index]);
      updateKeyboard(guessLetters[index], results[index]);
    }, index * 100);
  });

  setSafeTimeout(
    () => {
      if (currentGuess === targetWord) {
        gameOver = true;
        updateStats(true, currentRow + 1);
        showGameOver(true);
      } else if (currentRow === MAX_GUESSES - 1) {
        gameOver = true;
        updateStats(false, 0);
        showGameOver(false);
      } else {
        currentRow++;
        currentGuess = "";
      }

      inputLocked = false;
    },
    WORD_LENGTH * 100 + 300,
  );
}

function updateKeyboard(letter, state) {
  const key = document.querySelector(`[data-key="${letter.toLowerCase()}"]`);
  if (!key) return;

  const currentState = letterStates[letter];
  if (currentState === "correct") return;
  if (currentState === "present" && state === "absent") return;

  letterStates[letter] = state;
  key.classList.remove("correct", "present", "absent");
  key.classList.add(state);
}

function showMessage(text) {
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];
  messageContainer.textContent = text;
  messageContainer.classList.add("show");
  setSafeTimeout(() => messageContainer.classList.remove("show"), 2000);
}

function showError(text, duration = 3000) {
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];
  messageContainer.textContent = text;
  messageContainer.classList.add("show", "error");
  setSafeTimeout(() => {
    messageContainer.classList.remove("show", "error");
  }, duration);
}

async function reloadGameForLanguageChange() {
  if (!canPlayGame) {
    showMessage("Payment required to play.");
    inputLocked = true;
    return;
  }
  inputLocked = false;
  isFocusSet = false;

  activeTimeouts.forEach((id) => clearTimeout(id));
  activeTimeouts = [];

  currentGuess = "";
  currentRow = 0;
  gameOver = false;
  letterStates = {};

  createGameBoard();
  resetKeyboard();

  targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];

  closeModal("game-over-modal");
  closeModal("help-modal");
  closeModal("stats-modal");
  closeModal("username-modal");

  showMessage("Language changed — new word loaded!");
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add("show");
}
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("show");
}

function showGameOver(won) {
  const title = document.getElementById("game-over-title");
  const message = document.getElementById("game-over-message");
  const answerDiv = document.getElementById("game-over-answer");

  canPlayGame = false;
  sessionStorage.removeItem("turtleCanPlay");

  if (won) {
    title.textContent = "Congratulations!";
    const messages = [
      "Genius",
      "Magnificent",
      "Impressive",
      "Splendid",
      "Great",
      "Phew",
    ];
    message.textContent = messages[currentRow];
    answerDiv.innerHTML = "";
  } else {
    title.textContent = "Game Over";
    message.textContent = "Better luck next time!";
    answerDiv.innerHTML = `<p>The word was <strong>${targetWord}</strong></p>`;
  }
  maybeEnableNostrShare();
  showModal("game-over-modal");
}

async function loadStats() {
  let stats = {
    played: 0,
    won: 0,
    current_streak: 0,
    max_streak: 0,
  };

  const userId = localStorage.getItem("turtleUserId");
  if (userId) {
    try {
      const resp = await fetch(
        `https://turtle-backend.jasonbohio.workers.dev/api/user/${userId}`,
      );
      if (resp.ok) {
        stats = await resp.json();
      }
    } catch (err) {
      console.warn("Could not fetch stats, falling back to localStorage:", err);
      const localStats = localStorage.getItem("turtleStats");
      if (localStats) stats = JSON.parse(localStats);
    }
  }

  document.getElementById("played").textContent = stats.played;
  document.getElementById("win-rate").textContent = stats.played
    ? Math.round((stats.won / stats.played) * 100)
    : 0;
  document.getElementById("current-streak").textContent = stats.current_streak;
  document.getElementById("max-streak").textContent = stats.max_streak;
}

async function updateStats(won, guessNumber) {
  const userId = localStorage.getItem("turtleUserId");
  if (!userId) return;

  const body = { won, guessNumber };

  try {
    await fetch(
      `https://turtle-backend.jasonbohio.workers.dev/api/update-stats`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      },
    );
  } catch (err) {
    console.error("Failed to update stats on backend:", err);
  }

  // fallback to localStorage
  const statsKey = "turtleStats";
  const stats = JSON.parse(localStorage.getItem(statsKey)) || {
    played: 0,
    won: 0,
    current_streak: 0,
    max_streak: 0,
  };

  stats.played++;
  if (won) {
    stats.won++;
    stats.current_streak++;
    stats.max_streak = Math.max(stats.max_streak, stats.current_streak);
  } else {
    stats.current_streak = 0;
  }

  localStorage.setItem(statsKey, JSON.stringify(stats));

  loadStats();
}

function setupKeyboard() {
  const keys = document.querySelectorAll(".key");
  keys.forEach((key) => {
    key.addEventListener("click", () => handleKeyPress(key.dataset.key));
  });
}

function maybeEnableNostrShare() {
  if (!window.nostr) return;

  const btn = document.getElementById("nostr-share-btn");
  if (btn) {
    btn.style.display = "inline-block";
  }
}

async function shareToNostr() {
  if (!window.nostr || !gameOver) return;

  try {
    const rows = [];
    for (let i = 0; i <= currentRow; i++) {
      const tiles = document.querySelectorAll(`#row-${i} .tile`);
      let row = "";
      tiles.forEach((tile) => {
        if (tile.classList.contains("correct")) row += "🟩";
        else if (tile.classList.contains("present")) row += "🟨";
        else row += "⬛";
      });
      rows.push(row);
    }

    const won =
      currentGuess === targetWord || (gameOver && currentRow < MAX_GUESSES);

    const content = `
🐢 Turtle Word 🐢

${won ? "🧩 Solved" : "❌ Failed"} ${won ? `in ${currentRow + 1}/${MAX_GUESSES}` : ""}
🌍 Language: ${currentLanguage}

${rows.join("\n")}

Play: https://turtlewordgame.xyz/
`.trim();

    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000) - 2,
      tags: [
        ["t", "turtleword"],
        ["t", "wordgame"],
        ["t", `lang-${currentLanguage}`],
        ["client", "turtle-word", "https://turtlewordgame.xyz"],
      ],
      content,
    };

    const signedEvent = await window.nostr.signEvent(event);

    await publishToRelays(signedEvent);

    showMessage("Shared to Nostr 🟣");
  } catch (err) {
    console.error("Nostr share failed:", err);
    showError("Could not share to Nostr.");
  }
}

async function publishToRelays(event) {
  const relays = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.snort.social",
  ];

  await Promise.all(
    relays.map((url) => {
      return new Promise((resolve) => {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          ws.send(JSON.stringify(["EVENT", event]));
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);

            if (data[0] === "OK" && data[1] === event.id) {
              ws.close();
              resolve(true);
            }
          } catch {}
        };

        ws.onerror = () => resolve(false);

        setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000);
      });
    }),
  );
}

document
  .getElementById("nostr-share-btn")
  ?.addEventListener("click", shareToNostr);

document.getElementById("username-submit").onclick = async () => {
  const username = document.getElementById("username-input").value.trim();
  if (!username) return;

  try {
    const resp = await fetch(
      `https://turtle-backend.jasonbohio.workers.dev/api/auth`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      },
    );

    const data = await resp.json();
    localStorage.setItem("turtleUserId", data.userId);
    localStorage.setItem("turtleUsername", data.username);

    showMessage(`Welcome, ${data.username}!`);
  } catch (err) {
    console.error("Failed to save username:", err);
    showError("Could not save username. Try again.");
  }

  closeModal("username-modal");
};

async function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  el.innerHTML = "<h3>Leaderboard</h3>";
  el.innerHTML += `
  <div class="leaderboard-header">
    <div class="leaderboard-number">#</div>
    <div>Player</div>
    <div class="leaderboard-stats-header">
      🏆 Won · 🔥 Streak · Win%
    </div>
  </div>
`;

  try {
    const resp = await fetch(
      `https://turtle-backend.jasonbohio.workers.dev/api/leaderboard`,
    );

    if (!resp.ok) throw new Error("Leaderboard fetch failed");

    let data = await resp.json();

    if (!data || data.length === 0) {
      el.innerHTML += "<p>No players yet. Play some games to appear here!</p>";
      return;
    }

    // Sort by games won descending
    data.sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      return b.win_rate - a.win_rate;
    });

    const currentUser = localStorage.getItem("turtleUsername");

    // Render each player
    data.forEach((u, i) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";

      // Highlight current user
      if (u.username === currentUser) {
        row.classList.add("current-player");
      }

      row.innerHTML = `
  <div class="leaderboard-rank">${i + 1}</div>
  <div class="leaderboard-name">${u.username}</div>
  <div class="leaderboard-stats">
    ${u.won} wins · ${u.max_streak} in a row · ${u.win_rate}%
  </div>
`;

      el.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to render leaderboard:", err);
    el.innerHTML += "<p>Error loading leaderboard. Try again later.</p>";
  }
}

document.addEventListener("keydown", (e) => {
  const activeEl = document.activeElement;
  const openModal = document.querySelector(".modal.show");

  // 1️⃣ Typing in input/textarea
  if (
    activeEl.tagName === "INPUT" ||
    activeEl.tagName === "TEXTAREA" ||
    activeEl.isContentEditable
  ) {
    // If username modal and Enter pressed, submit
    if (openModal?.id === "username-modal" && e.key === "Enter") {
      e.preventDefault();
      document.getElementById("username-submit").click();
    }
    return; // ignore game input
  }

  // 2️⃣ If modal open
  if (openModal) {
    if (e.key === "Enter") {
      e.preventDefault();
      // handle modal-specific logic
      if (openModal.id === "game-over-modal") {
        resetGame();
      }
    }
    return; // ignore game input
  }

  // 3️⃣ Game input
  if (e.key === "Enter") handleKeyPress("enter");
  else if (e.key === "Backspace") handleKeyPress("backspace");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKeyPress(e.key.toLowerCase());
});

document.addEventListener("DOMContentLoaded", async () => {
  const savedLang = localStorage.getItem("turtleLang") || "english";
  currentLanguage = savedLang;
  document.getElementById("language-select").value = savedLang;
  await loadWordList(currentLanguage);
  setupKeyboard();
  loadStats();
  document
    .getElementById("help-btn")
    .addEventListener("click", () => showModal("help-modal"));
  document.getElementById("stats-btn").addEventListener("click", async () => {
    showModal("stats-modal");
    await loadStats();
    await renderLeaderboard();
  });
  document
    .getElementById("username-btn")
    .addEventListener("click", () => showModal("username-modal"));
  startNewGame();
});

document
  .getElementById("language-select")
  .addEventListener("change", async (e) => {
    currentLanguage = e.target.value;
    localStorage.setItem("turtleLang", currentLanguage);

    e.target.blur();

    await loadWordList(currentLanguage);
    reloadGameForLanguageChange();
  });

document.getElementById("tip-btn").addEventListener("click", async () => {
  const tipBtn = document.getElementById("tip-btn");
  tipBtn.disabled = true;

  try {
    const invoiceTip = await generateInvoiceForBlink(10000);
    await payInvoice(invoiceTip);
    showMessage("Thank you for the 10,000 sats tip 💛");
  } catch (err) {
    console.error("Tip payment failed:", err);
    showError("Tip failed. Please try again.");
    tipBtn.disabled = false;
  }
});

window.resetGame = startNewGame;
window.closeModal = closeModal;
