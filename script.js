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
let currentLanguage = "english";

const gameBoard = document.getElementById("game-board");
const messageContainer = document.getElementById("message-container");
const keyboard = document.getElementById("keyboard");

function handleFirstKeypress(e) {
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
      return;
    }

    inputLocked = false;
    showMessage("Payment received! Game started!");
  } else {
    showMessage("Game started! Good luck!");
  }

  closeModal("game-over-modal");
  closeModal("help-modal");
  closeModal("stats-modal");
}

async function generateInvoiceForBlink(amountSats) {
  try {
    const resp = await fetch("/api/create-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ amount: amountSats, memo: "Turtle Game Payment" }),
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

async function payWithQR(amountSats, memo = "Turtle Game Payment") {
  const tipBtn = document.getElementById("tip-btn");
  tipBtn.disabled = true;

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
          }
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

    const qrSuccess = await payWithQR(100, "Turtle Game Payment");
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

function submitGuess() {
  if (currentGuess.length !== WORD_LENGTH) {
    showMessage("Not enough letters");
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
  if (gameOver || inputLocked) return;

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

  setSafeTimeout(() => {
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
  }, WORD_LENGTH * 100 + 300);
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

  showModal("game-over-modal");
}

function loadStats() {
  const stats = JSON.parse(
    localStorage.getItem(fetch(`https://turtle-backend.jasonbohio.workers.dev/api/leaderboard`))
  ) || {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0],
  };
  document.getElementById("played").textContent = stats.played;
  document.getElementById("win-rate").textContent = stats.played
    ? Math.round((stats.won / stats.played) * 100)
    : 0;
  document.getElementById("current-streak").textContent = stats.currentStreak;
  document.getElementById("max-streak").textContent = stats.maxStreak;
}

function updateStats(won, guessNumber) {
  const stats = JSON.parse(localStorage.getItem(`https://turtle-backend.jasonbohio.workers.dev/api/auth`)) || {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0],
  };
  stats.played++;
  if (won) {
    stats.won++;
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.guessDistribution[guessNumber - 1]++;
  } else {
    stats.currentStreak = 0;
  }
  localStorage.setItem(`https://turtle-backend.jasonbohio.workers.dev/api/auth`, JSON.stringify(stats));
  loadStats();
}

function setupKeyboard() {
  const keys = document.querySelectorAll(".key");
  keys.forEach((key) => {
    key.addEventListener("click", () => handleKeyPress(key.dataset.key));
  });
}

async function ensureUserSignedIn() {
  if (localStorage.getItem("turtleUserId")) return;

  showModal("username-modal");

  document.getElementById("username-submit").onclick = async () => {
    const username = document.getElementById("username-input").value.trim();
    if (!username) return;

    const resp = await fetch(`https://turtle-backend.jasonbohio.workers.dev/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await resp.json();
    localStorage.setItem("turtleUserId", data.userId);
    localStorage.setItem("turtleUsername", data.username);

    closeModal("username-modal");
  };
}

async function renderLeaderboard() {
  const resp = await fetch(`https://turtle-backend.jasonbohio.workers.dev/api/leaderboard`);
  const data = await resp.json();

  const el = document.getElementById("leaderboard");
  el.innerHTML = "";

  data.forEach((u, i) => {
    const row = document.createElement("div");
    row.textContent = `#${i + 1} ${u.username} — ${
      u.win_rate
    }% win rate — max streak ${u.max_streak}`;
    el.appendChild(row);
  });
}

document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Enter") return;

    const openModal = document.querySelector(".modal.show");
    if (openModal) {
      if (openModal.id === "payment-qr-modal") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (openModal.id === "game-over-modal") {
        resetGame();
        return;
      }
      openModal.classList.remove("show");
    }
  },
  true
);

document.addEventListener("keydown", (e) => {
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
  document
    .getElementById("stats-btn")
    .addEventListener("click", () => showModal("stats-modal"));
  startNewGame();
});

document
  .getElementById("language-select")
  .addEventListener("change", async (e) => {
    currentLanguage = e.target.value;
    localStorage.setItem("turtleLang", currentLanguage);

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
