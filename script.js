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

enableWebLN();

function setSafeTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    activeTimeouts.push(id);
}

async function loadWordList() {
    const url = "https://darkermango.github.io/5-Letter-words/words.txt";
    const response = await fetch(url);
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

    createGameBoard();
    resetKeyboard();

    targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];

    const stats = JSON.parse(localStorage.getItem('turtleStats')) || { played: 0, won: 0, currentStreak: 0, maxStreak: 0, guessDistribution: [0,0,0,0,0,0] };
    
    if (stats.played >= 3) {
        await handlePayment();
    }

    closeModal('game-over-modal');
    closeModal('help-modal');
    closeModal('stats-modal');
}

async function handlePayment() {
    if (typeof WebLN === 'undefined') {
        alert("WebLN is not loaded or available in your browser.");
        return;
    }

    try {
        const webln = await WebLN.requestProvider();
        if (!webln) {
            alert("Please install a WebLN wallet to proceed with payment.");
            return;
        }

        const lightningAddress = "jasonbohio@getalby.com";

        const invoiceRequest100 = await generateInvoiceForAddress(lightningAddress, 100);
        console.log("Generated invoice for 100 sats:", invoiceRequest100);

        await webln.sendPayment(invoiceRequest100);
        alert("Payment of 100 sats successful!");

        const tip = confirm("Would you like to tip 10,000 sats?");
        if (tip) {
            const invoiceRequestTip = await generateInvoiceForAddress(lightningAddress, 10000);
            console.log("Generated tip invoice for 10,000 sats:", invoiceRequestTip);
            await webln.sendPayment(invoiceRequestTip);
            alert("Tip of 10,000 sats successful!");
        }

    } catch (error) {
        console.error("Payment failed:", error);
        alert("Payment failed. Please try again.");
    }
}

async function generateInvoiceForAddress(address, amountSats) {
    if (typeof WebLN === 'undefined') {
        throw new Error("WebLN is not available in your browser.");
    }

    try {
        const webln = await WebLN.requestProvider();

        const invoice = await webln.makeInvoice({
            amount: amountSats,
            description: `Payment to ${address}`,
            memo: "Turtle Game Payment"
        });

        return invoice.paymentRequest;
    } catch (error) {
        console.error("Error generating invoice:", error);
        throw new Error("Failed to generate Lightning invoice.");
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
    await loadWordList();
    setupKeyboard();
    loadStats();
    document.getElementById('help-btn').addEventListener('click', () => showModal('help-modal'));
    document.getElementById('stats-btn').addEventListener('click', () => showModal('stats-modal'));
    startNewGame();
});

window.resetGame = startNewGame;
window.closeModal = closeModal;