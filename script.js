const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

let WORDS = [];
let targetWord = '';
let currentGuess = '';
let currentRow = 0;
let gameOver = false;
let letterStates = {};
let activeTimeouts = [];
let isFocusSet = false;
let currentLanguage = 'en';

const gameBoard = document.getElementById('game-board');
const messageContainer = document.getElementById('message-container');
const keyboard = document.getElementById('keyboard');

function handleFirstKeypress(e) {
    if (/^[a-zA-Z]$/.test(e.key) || e.key === 'Enter' || e.key === 'Backspace') {
        gameBoard.focus();
        isFocusSet = true;
        
        document.removeEventListener('keydown', handleFirstKeypress);
    }
}

async function enableWebLN() {
  if (typeof WebLN === 'undefined') {
    alert('WebLN is not loaded or available in your browser.');
    return;
  }

  try {
    const webln = await WebLN.requestProvider();
    await webln.enable();
    console.log("WebLN enabled successfully!");

    const info = await webln.getInfo();
    console.log("Node Info:", info);
  } catch (error) {
    console.error("Error:", error);
    alert("WebLN provider not found. Please install a WebLN-compatible wallet.");
  }
}

function setSafeTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    activeTimeouts.push(id);
}

function getWordListURL(lang) {
    const map = {
        english: "english.txt",
        spanish: "spanish.txt",
        french: "french.txt",
        german: "german.txt"
    };

    return `https://github.com/ttooccooll/TURTLE/main/words/${map[lang]}`;
}

async function loadWordList(language = 'english') {
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
        .map(w => w.trim())
        .filter(w => w.length === WORD_LENGTH)
        .map(w => w.toUpperCase());
}

async function startNewGame() {
    inputLocked = false;
    isFocusSet = false;
    document.addEventListener('keydown', handleFirstKeypress);

    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];

    currentGuess = '';
    currentRow = 0;
    gameOver = false;
    letterStates = {};

    document.getElementById('tip-btn').style.display = 'none';

    createGameBoard();
    resetKeyboard();

    targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];

    const stats = JSON.parse(localStorage.getItem('turtleStats')) || {
        played: 0, won: 0, currentStreak: 0, maxStreak: 0, guessDistribution: [0,0,0,0,0,0]
    };

    if (stats.played >= 3) {
        showMessage("Payment required to continue playing...");

        const paymentSuccess = await handlePayment();
        if (!paymentSuccess) {
            showMessage("Payment not completed. Game cannot start.");
            inputLocked = true;
            return;
        }
    }

    closeModal('game-over-modal');
    closeModal('help-modal');
    closeModal('stats-modal');

    inputLocked = false;
    showMessage("Game started! Good luck!");
}

async function generateInvoiceForBlink(amountSats) {
  try {
    const resp = await fetch('/api/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountSats, memo: 'Turtle Game Payment' })
    });

    let data;
    const contentType = resp.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await resp.json();
    } else {
      const text = await resp.text();
      console.error('Server returned non-JSON:', text);
      throw new Error('Failed to generate invoice: server returned non-JSON response');
    }

    if (!resp.ok || !data.paymentRequest) {
      console.error("Blink API error:", data);
      throw new Error("Failed to generate invoice");
    }

    return data.paymentRequest;

  } catch (err) {
    console.error("Invoice generation error:", err);
    throw err;
  }
}

async function payInvoice(paymentRequest) {
  if (typeof WebLN === 'undefined') throw new Error("WebLN not available");

  try {
    const webln = await WebLN.requestProvider();
    await webln.enable();
    await webln.sendPayment(paymentRequest);
  } catch (err) {
    console.error("WebLN payment failed:", err);
    throw new Error("Payment failed");
  }
}

async function handlePayment() {
  try {
    const invoice = await generateInvoiceForBlink(100);
    await payInvoice(invoice);
    alert("Payment of 100 sats successful!");

    const tipBtn = document.getElementById('tip-btn');
    tipBtn.style.display = 'inline-block';
    tipBtn.disabled = false;

    return true;
  } catch (err) {
    console.error("Payment failed:", err);
    alert("Payment failed. Please try again.");
    return false;
  }
}

function createGameBoard() {
    gameBoard.innerHTML = '';
    for (let i = 0; i < MAX_GUESSES; i++) {
        const row = document.createElement('div');
        row.className = 'tile-row';
        row.id = `row-${i}`;
        for (let j = 0; j < WORD_LENGTH; j++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${i}-${j}`;
            tile.textContent = '';
            row.appendChild(tile);
        }
        gameBoard.appendChild(row);
    }
}

function resetKeyboard() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => key.classList.remove('correct', 'present', 'absent'));
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
    const tiles = row.querySelectorAll('.tile');
    tiles.forEach((tile, index) => {
        if (index < currentGuess.length) {
            tile.textContent = currentGuess[index];
            tile.classList.add('filled');
        } else {
            tile.textContent = '';
            tile.classList.remove('filled');
        }
    });
}

function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
        showMessage('Not enough letters');
        shakeRow();
        return;
    }
    checkGuess();
}

function shakeRow() {
    const row = document.getElementById(`row-${currentRow}`);
    row.classList.add('shake');
    setSafeTimeout(() => row.classList.remove('shake'), 500);
}

let inputLocked = false;

function handleKeyPress(key) {
    if (gameOver || inputLocked) return;

    if (key === 'enter') {
        submitGuess();
    } else if (key === 'backspace') {
        deleteLetter();
    } else if (/^[a-z]$/.test(key)) {
        addLetter(key.toUpperCase());
    }
}

function checkGuess() {
    const row = document.getElementById(`row-${currentRow}`);
    const tiles = row.querySelectorAll('.tile');
    const targetLetters = targetWord.split('');
    const guessLetters = currentGuess.split('');
    const results = new Array(WORD_LENGTH).fill('absent');

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessLetters[i] === targetLetters[i]) {
            results[i] = 'correct';
            targetLetters[i] = null;
        }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (results[i] === 'absent' && targetLetters.includes(guessLetters[i])) {
            results[i] = 'present';
            targetLetters[targetLetters.indexOf(guessLetters[i])] = null;
        }
    }

    inputLocked = true;

    tiles.forEach((tile, index) => {
        setSafeTimeout(() => {
            tile.classList.add('reveal', results[index]);
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
            currentGuess = '';
        }

        inputLocked = false;
    }, WORD_LENGTH * 100 + 300);
}

function updateKeyboard(letter, state) {
    const key = document.querySelector(`[data-key="${letter.toLowerCase()}"]`);
    if (!key) return;

    const currentState = letterStates[letter];
    if (currentState === 'correct') return;
    if (currentState === 'present' && state === 'absent') return;

    letterStates[letter] = state;
    key.classList.remove('correct', 'present', 'absent');
    key.classList.add(state);
}

function showMessage(text) {
    messageContainer.textContent = text;
    messageContainer.classList.add('show');
    setSafeTimeout(() => messageContainer.classList.remove('show'), 2000);
}

function showModal(modalId) { document.getElementById(modalId).classList.add('show'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('show'); }

function showGameOver(won) {
    const title = document.getElementById('game-over-title');
    const message = document.getElementById('game-over-message');
    const answerDiv = document.getElementById('game-over-answer');

    if (won) {
        title.textContent = 'Congratulations!';
        const messages = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];
        message.textContent = messages[currentRow];
        answerDiv.innerHTML = '';
    } else {
        title.textContent = 'Game Over';
        message.textContent = 'Better luck next time!';
        answerDiv.innerHTML = `<p>The word was <strong>${targetWord}</strong></p>`;
    }

    showModal('game-over-modal');
}

function loadStats() {
    const stats = JSON.parse(localStorage.getItem('turtleStats')) || {
        played: 0, won: 0, currentStreak: 0, maxStreak: 0,
        guessDistribution: [0,0,0,0,0,0]
    };
    document.getElementById('played').textContent = stats.played;
    document.getElementById('win-rate').textContent = stats.played ? Math.round((stats.won/stats.played)*100) : 0;
    document.getElementById('current-streak').textContent = stats.currentStreak;
    document.getElementById('max-streak').textContent = stats.maxStreak;
    updateGuessDistribution(stats.guessDistribution);
}

function updateStats(won, guessNumber) {
    const stats = JSON.parse(localStorage.getItem('turtleStats')) || {
        played: 0, won: 0, currentStreak: 0, maxStreak: 0,
        guessDistribution: [0,0,0,0,0,0]
    };
    stats.played++;
    if (won) {
        stats.won++;
        stats.currentStreak++;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.guessDistribution[guessNumber-1]++;
    } else {
        stats.currentStreak = 0;
    }
    localStorage.setItem('turtleStats', JSON.stringify(stats));
    loadStats();
}

function updateGuessDistribution(distribution) {
    const container = document.getElementById('distribution-bars');
    container.innerHTML = '';
    const maxCount = Math.max(...distribution,1);
    distribution.forEach((count,index)=>{
        const barContainer = document.createElement('div');
        barContainer.style.display = 'flex'; barContainer.style.alignItems='center'; barContainer.style.margin='5px 0';

        const label = document.createElement('span');
        label.textContent = index+1; label.style.width='20px'; label.style.textAlign='right'; label.style.marginRight='10px';

        const bar = document.createElement('div');
        bar.style.height='20px'; bar.style.backgroundColor = count>0 ? '#538d4e':'#3a3a3c';
        bar.style.width = `${(count/maxCount)*100}px`; bar.style.marginRight='10px'; bar.style.transition='width 0.3s';

        const countText = document.createElement('span'); countText.textContent = count;

        barContainer.appendChild(label); barContainer.appendChild(bar); barContainer.appendChild(countText);
        container.appendChild(barContainer);
    });
}

function setupKeyboard() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key=>{
        key.addEventListener('click',()=>handleKeyPress(key.dataset.key));
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    const openModal = document.querySelector('.modal.show');
    if (openModal) {
        e.preventDefault();
        e.stopPropagation();
        if (openModal.id === 'game-over-modal') {
            resetGame();
            return;
        }
        openModal.classList.remove('show');
    }
}, true);

document.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') handleKeyPress('enter');
    else if (e.key === 'Backspace') handleKeyPress('backspace');
    else if (/^[a-zA-Z]$/.test(e.key)) handleKeyPress(e.key.toLowerCase());
});

document.addEventListener('DOMContentLoaded', async ()=>{
    const savedLang = localStorage.getItem('turtleLang') || 'en';
    currentLanguage = savedLang;
    document.getElementById('language-select').value = savedLang;
    await loadWordList();
    setupKeyboard();
    loadStats();
    document.getElementById('help-btn').addEventListener('click', () => showModal('help-modal'));
    document.getElementById('stats-btn').addEventListener('click', () => showModal('stats-modal'));
    startNewGame();
});

document.getElementById('language-select').addEventListener('change', async (e) => {
    currentLanguage = e.target.value;
    localStorage.setItem('turtleLang', currentLanguage);

    await loadWordList(currentLanguage);
    startNewGame();
});


document.getElementById('tip-btn').addEventListener('click', async () => {
    const tipBtn = document.getElementById('tip-btn');
    tipBtn.disabled = true;

    try {
        const invoiceTip = await generateInvoiceForBlink(10000);
        await payInvoice(invoiceTip);
        alert("Tip of 10,000 sats successful!");

        tipBtn.style.display = 'none';

    } catch (err) {
        console.error("Tip payment failed:", err);
        alert("Tip failed. Please try again.");
        tipBtn.disabled = false;
    }
});


window.resetGame = startNewGame;
window.closeModal = closeModal;