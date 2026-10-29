// ==========================================
// 1. HISTORICAL ENIGMA M3 SPECIFICATIONS
// ==========================================
const ROTOR_SPECS = {
    'I': { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: 'Q' },
    'II': { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: 'E' },
    'III': { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: 'V' },
    'IV': { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: 'J' },
    'V': { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: 'Z' }
};

const REFLECTORS = {
    'B': "YRUHQSLDPXNGOKMIEBFZCWVJAT",
    'C': "FVPJIAOYEDRZXWGCTKUQSBNMHL"
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Audio Effects Synthesizer using Web Audio API
let audioCtx = null;
let soundEnabled = true;

function playClickSound() {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
        // Ignore audio restriction errors
    }
}

// Helper Utilities
function charToIndex(char) {
    return char.toUpperCase().charCodeAt(0) - 65;
}

function indexToChar(index) {
    return String.fromCharCode(((index % 26 + 26) % 26) + 65);
}

// ==========================================
// 2. ENIGMA CORE ALGORITHM & SIGNAL TRACING
// ==========================================

class EnigmaMachine {
    constructor(rLeft, rMid, rRight, posL, posM, posR, ringL, ringM, ringR, reflector, plugboardPairs) {
        this.rLeft = rLeft;
        this.rMid = rMid;
        this.rRight = rRight;

        this.posL = charToIndex(posL);
        this.posM = charToIndex(posM);
        this.posR = charToIndex(posR);

        this.ringL = ringL; // 0..25
        this.ringM = ringM;
        this.ringR = ringR;

        this.reflector = REFLECTORS[reflector] || REFLECTORS['B'];
        this.plugPairs = plugboardPairs; // Array of [charA, charB]
    }

    // Plugboard Swap
    applyPlugboard(char) {
        for (let pair of this.plugPairs) {
            if (pair.length === 2) {
                if (char === pair[0]) return pair[1];
                if (char === pair[1]) return pair[0];
            }
        }
        return char;
    }

    // Double Stepping Mechanism
    stepRotors() {
        const charM = indexToChar(this.posM);
        const charR = indexToChar(this.posR);

        const notchM = ROTOR_SPECS[this.rMid].notch;
        const notchR = ROTOR_SPECS[this.rRight].notch;

        let rotateM = false;
        let rotateL = false;

        // Double stepping anomaly
        if (charM === notchM) {
            rotateM = true;
            rotateL = true;
        } else if (charR === notchR) {
            rotateM = true;
        }

        this.posR = (this.posR + 1) % 26;
        if (rotateM) this.posM = (this.posM + 1) % 26;
        if (rotateL) this.posL = (this.posL + 1) % 26;
    }

    // Forward Signal Pass (Right -> Left)
    passForward(charIdx, rotorType, pos, ring) {
        let shift = (charIdx + pos - ring + 26) % 26;
        let substitutedChar = ROTOR_SPECS[rotorType].wiring[shift];
        let outIdx = (charToIndex(substitutedChar) - pos + ring + 26) % 26;
        return outIdx;
    }

    // Backward Signal Pass (Left -> Right)
    passBackward(charIdx, rotorType, pos, ring) {
        let shift = (charIdx + pos - ring + 26) % 26;
        let charToFind = indexToChar(shift);
        let origIdx = ROTOR_SPECS[rotorType].wiring.indexOf(charToFind);
        let outIdx = (origIdx - pos + ring + 26) % 26;
        return outIdx;
    }

    // Encrypt Single Character
    encryptChar(char) {
        if (!ALPHABET.includes(char)) {
            return { char: char, path: null };
        }

        // Step 1: Step Rotors BEFORE processing character
        this.stepRotors();

        let trace = [];
        trace.push(`In: ${char}`);

        // Step 2: Plugboard Input
        let c1 = this.applyPlugboard(char);
        trace.push(`Plug: ${c1}`);

        let idx = charToIndex(c1);

        // Step 3: Rotors Forward
        idx = this.passForward(idx, this.rRight, this.posR, this.ringR);
        trace.push(`R3(${this.rRight}): ${indexToChar(idx)}`);

        idx = this.passForward(idx, this.rMid, this.posM, this.ringM);
        trace.push(`R2(${this.rMid}): ${indexToChar(idx)}`);

        idx = this.passForward(idx, this.rLeft, this.posL, this.ringL);
        trace.push(`R1(${this.rLeft}): ${indexToChar(idx)}`);

        // Step 4: Reflector
        let reflectedChar = this.reflector[idx];
        idx = charToIndex(reflectedChar);
        trace.push(`Reflector: ${reflectedChar}`);

        // Step 5: Rotors Backward
        idx = this.passBackward(idx, this.rLeft, this.posL, this.ringL);
        trace.push(`R1-Rev: ${indexToChar(idx)}`);

        idx = this.passBackward(idx, this.rMid, this.posM, this.ringM);
        trace.push(`R2-Rev: ${indexToChar(idx)}`);

        idx = this.passBackward(idx, this.rRight, this.posR, this.ringR);
        trace.push(`R3-Rev: ${indexToChar(idx)}`);

        // Step 6: Plugboard Output
        let c2 = indexToChar(idx);
        let finalChar = this.applyPlugboard(c2);
        trace.push(`Out: ${finalChar}`);

        return {
            char: finalChar,
            path: trace.join(' ➔ ')
        };
    }
}

// ==========================================
// 3. UI STATE MANAGEMENT & DOM HELPERS
// ==========================================

const DOM = {
    rLeftType: document.getElementById('rotor-left-type'),
    rMidType: document.getElementById('rotor-middle-type'),
    rRightType: document.getElementById('rotor-right-type'),

    posLeftVal: document.getElementById('pos-left-val'),
    posMidVal: document.getElementById('pos-middle-val'),
    posRightVal: document.getElementById('pos-right-val'),

    drumLeft: document.getElementById('pos-left-display'),
    drumMid: document.getElementById('pos-middle-display'),
    drumRight: document.getElementById('pos-right-display'),

    ringLeft: document.getElementById('ring-left'),
    ringMid: document.getElementById('ring-middle'),
    ringRight: document.getElementById('ring-right'),

    reflectorSelect: document.getElementById('reflector-select'),
    plugboardInput: document.getElementById('plugboard-input'),
    plugboardError: document.getElementById('plugboard-error'),
    plugboardErrorMsg: document.getElementById('plugboard-error-msg'),
    plugboardTags: document.getElementById('plugboard-tags'),
    plugCount: document.getElementById('plug-count'),

    textInput: document.getElementById('text-input'),
    textOutput: document.getElementById('text-output'),
    outputCharCount: document.getElementById('output-char-count'),

    signalCharLabel: document.getElementById('signal-char-label'),
    signalPathDisplay: document.getElementById('signal-path-display'),

    btnSwap: document.getElementById('btn-swap'),
    btnCopy: document.getElementById('btn-copy'),
    btnReset: document.getElementById('preset-reset'),
    btnNavyPreset: document.getElementById('preset-navy'),
    btnClearInput: document.getElementById('btn-clear-input'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    soundIcon: document.getElementById('sound-icon'),
    soundLabel: document.getElementById('sound-label'),

    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toast-msg'),
};

let enigmaSession = null;
let lastInputLength = 0;
// Populate Ring Dropdowns (01/A to 26/Z)
function initRingDropdowns() {
    [DOM.ringLeft, DOM.ringMid, DOM.ringRight].forEach(select => {
        select.innerHTML = '';
        for (let i = 0; i < 26; i++) {
            const letter = indexToChar(i);
            const num = String(i + 1).padStart(2, '0');
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${num} (${letter})`;
            select.appendChild(option);
        }
    });
}

// Parse Plugboard Text
function getPlugboardPairs() {
    const val = DOM.plugboardInput.value.toUpperCase().trim();
    if (!val) {
        hidePlugboardError();
        renderPlugboardTags([]);
        return [];
    }

    const tokens = val.split(/\s+/);
    const pairs = [];
    const usedLetters = new Set();
    let error = null;

    for (let token of tokens) {
        if (token.length !== 2) {
            error = `Pasangan "${token}" harus persis 2 huruf.`;
            break;
        }
        const a = token[0];
        const b = token[1];

        if (!ALPHABET.includes(a) || !ALPHABET.includes(b)) {
            error = `Karakter tidak valid dalam "${token}". Hanya A-Z.`;
            break;
        }
        if (a === b) {
            error = `Huruf tidak boleh berpasangan dengan dirinya sendiri (${a}${b}).`;
            break;
        }
        if (usedLetters.has(a) || usedLetters.has(b)) {
            error = `Huruf '${usedLetters.has(a) ? a : b}' digunakan lebih dari satu kali!`;
            break;
        }

        usedLetters.add(a);
        usedLetters.add(b);
        pairs.push([a, b]);
    }

    if (pairs.length > 10) {
        error = "Maksimal 10 pasang kabel plugboard!";
    }

    if (error) {
        showPlugboardError(error);
    } else {
        hidePlugboardError();
    }

    renderPlugboardTags(pairs);
    DOM.plugCount.textContent = `${pairs.length}/10 Pasang`;
    return pairs;
}

function showPlugboardError(msg) {
    DOM.plugboardErrorMsg.textContent = msg;
    DOM.plugboardError.classList.remove('hidden');
}

function hidePlugboardError() {
    DOM.plugboardError.classList.add('hidden');
}

function renderPlugboardTags(pairs) {
    if (pairs.length === 0) {
        DOM.plugboardTags.innerHTML = `<span class="text-[11px] text-gray-500 italic">Belum ada kabel terpasang</span>`;
        return;
    }

    DOM.plugboardTags.innerHTML = pairs.map(p => `
    <span class="px-2 py-0.5 bg-brass/20 text-brass border border-brass/40 rounded text-xs font-bold tracking-wider flex items-center gap-1">
        <i class="fa-solid fa-link text-[10px]"></i> ${p[0]}-${p[1]}
    </span>
    `).join('');
}

// Show glowing lamp highlight
function highlightLamp(char) {
    // Turn off all lamps
    document.querySelectorAll('.lamp').forEach(l => l.classList.remove('lit'));

    if (char && ALPHABET.includes(char)) {
        const lamp = document.getElementById(`lamp-${char.toUpperCase()}`);
        if (lamp) {
            lamp.classList.add('lit');
        }
    }
}

// Show Toast Notification
function showToast(msg) {
    DOM.toastMsg.textContent = msg;
    DOM.toast.classList.remove('toast-enter');
    DOM.toast.classList.add('toast-show');
    setTimeout(() => {
        DOM.toast.classList.remove('toast-show');
        DOM.toast.classList.add('toast-enter');
    }, 2500);
}

// Update Rotor Drum Visual Displays
function updateDrumDisplays(posL, posM, posR) {
    DOM.drumLeft.textContent = indexToChar(posL);
    DOM.drumMid.textContent = indexToChar(posM);
    DOM.drumRight.textContent = indexToChar(posR);

    DOM.posLeftVal.value = indexToChar(posL);
    DOM.posMidVal.value = indexToChar(posM);
    DOM.posRightVal.value = indexToChar(posR);
}

// ==========================================
// 4. REAL-TIME PROCESSING ENGINE
// ==========================================

function processRealtimeText(triggerSource = 'text') {
    const rawInput = DOM.textInput.value.toUpperCase();
    const plugPairs = getPlugboardPairs();

    const initPosL = DOM.posLeftVal.value || 'A';
    const initPosM = DOM.posMidVal.value || 'A';
    const initPosR = DOM.posRightVal.value || 'A';

    // Jika konfigurasi berubah, mulai ulang sesi enkripsi.
    if (triggerSource !== 'input' && triggerSource !== 'virtual-keyboard') {
        enigmaSession = new EnigmaMachine(
            DOM.rLeftType.value,
            DOM.rMidType.value,
            DOM.rRightType.value,
            initPosL,
            initPosM,
            initPosR,
            parseInt(DOM.ringLeft.value),
            parseInt(DOM.ringMid.value),
            parseInt(DOM.ringRight.value),
            DOM.reflectorSelect.value,
            plugPairs
        );

        lastInputLength = 0;
        DOM.textOutput.value = '';
    }

    // Buat sesi baru jika belum tersedia.
    if (!enigmaSession) {
        enigmaSession = new EnigmaMachine(
            DOM.rLeftType.value,
            DOM.rMidType.value,
            DOM.rRightType.value,
            initPosL,
            initPosM,
            initPosR,
            parseInt(DOM.ringLeft.value),
            parseInt(DOM.ringMid.value),
            parseInt(DOM.ringRight.value),
            DOM.reflectorSelect.value,
            plugPairs
        );
    }

    // Jika input dihapus atau diganti menjadi lebih pendek,
    // reset sesi agar posisi rotor kembali konsisten.
    if (rawInput.length < lastInputLength) {
        enigmaSession = new EnigmaMachine(
            DOM.rLeftType.value,
            DOM.rMidType.value,
            DOM.rRightType.value,
            initPosL,
            initPosM,
            initPosR,
            parseInt(DOM.ringLeft.value),
            parseInt(DOM.ringMid.value),
            parseInt(DOM.ringRight.value),
            DOM.reflectorSelect.value,
            plugPairs
        );

        lastInputLength = 0;
        DOM.textOutput.value = '';
    }

    let result = DOM.textOutput.value;
    let lastTracePath = null;
    let lastOutputChar = null;

    // Proses hanya karakter baru yang belum dienkripsi.
    const newInput = rawInput.slice(lastInputLength);

    for (const char of newInput) {
        if (ALPHABET.includes(char)) {
            const res = enigmaSession.encryptChar(char);

            result += res.char;
            lastOutputChar = res.char;
            lastTracePath = res.path;
        } else {
            result += char;
        }
    }

    lastInputLength = rawInput.length;

    // Perbarui output tanpa menghitung ulang karakter lama.
    DOM.textOutput.value = result;
    DOM.outputCharCount.textContent = `${result.length} Karakter`;

    updateDrumDisplays(
        enigmaSession.posL,
        enigmaSession.posM,
        enigmaSession.posR
    );

    if (lastOutputChar) {
        highlightLamp(lastOutputChar);
        DOM.signalCharLabel.textContent = lastOutputChar;
        DOM.signalPathDisplay.textContent = lastTracePath;
    } else {
        highlightLamp(null);
        DOM.signalCharLabel.textContent = '-';
        DOM.signalPathDisplay.textContent =
            'Ketik huruf untuk melihat alur sinyal kabel...';
    }
}
// ==========================================
// 5. EVENT LISTENERS & HANDLERS
// ==========================================

function bindEvents() {
    // Real-time Text Input Event
    DOM.textInput.addEventListener('input', () => {
        playClickSound();
        processRealtimeText('input');
    });

    // Plugboard Real-time Change
    DOM.plugboardInput.addEventListener('input', () => {
        processRealtimeText('plugboard');
    });

    // Rotor Type & Reflector Selector Changes
    [DOM.rLeftType, DOM.rMidType, DOM.rRightType, DOM.reflectorSelect, DOM.ringLeft, DOM.ringMid, DOM.ringRight].forEach(el => {
        el.addEventListener('change', () => {
            playClickSound();
            processRealtimeText('config');
        });
    });

    // Position Inputs (Text Change)
    [DOM.posLeftVal, DOM.posMidVal, DOM.posRightVal].forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
            if (!e.target.value) e.target.value = 'A';
            playClickSound();
            processRealtimeText('position');
        });
    });

    // Step Buttons (+ / -)
    document.querySelectorAll('.btn-step').forEach(btn => {
        btn.addEventListener('click', (e) => {
            playClickSound();
            const rotor = e.currentTarget.dataset.rotor;
            const dir = parseInt(e.currentTarget.dataset.dir);

            let inputEl = DOM.posRightVal;
            if (rotor === 'left') inputEl = DOM.posLeftVal;
            if (rotor === 'middle') inputEl = DOM.posMidVal;

            let currIdx = charToIndex(inputEl.value || 'A');
            let nextIdx = (currIdx + dir + 26) % 26;
            inputEl.value = indexToChar(nextIdx);

            processRealtimeText('step');
        });
    });

    // Virtual Typewriter Keyboard Click
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.currentTarget.dataset.key;
            btn.classList.add('pressed');
            setTimeout(() => btn.classList.remove('pressed'), 120);

            playClickSound();

            // Append to text input
            DOM.textInput.value += key;
            processRealtimeText('input');
        });
    });

    // Physical Keyboard Support
    window.addEventListener('keydown', (e) => {
        // Ignore if user is inside plugboard input or other inputs
        if (document.activeElement === DOM.plugboardInput) return;

        const key = e.key.toUpperCase();
        if (ALPHABET.includes(key) && key.length === 1 && document.activeElement !== DOM.textInput) {
            const btn = document.querySelector(`.key-btn[data-key="${key}"]`);
            if (btn) {
                btn.classList.add('pressed');
                setTimeout(() => btn.classList.remove('pressed'), 120);
            }
            DOM.textInput.focus();
        }
    });

    // Clear Input
    DOM.btnClearInput.addEventListener('click', () => {
        playClickSound();
        DOM.textInput.value = '';
        processRealtimeText('clear');
    });

    // Swap Input / Output
    DOM.btnSwap.addEventListener('click', () => {
        playClickSound();
        const outVal = DOM.textOutput.value;
        DOM.textInput.value = outVal;
        processRealtimeText('swap');
        showToast("Teks hasil ditukar ke input!");
    });

    // Copy Output
    DOM.btnCopy.addEventListener('click', () => {
        playClickSound();
        if (!DOM.textOutput.value) return;

        // Copy fallback safe implementation
        const textToCopy = DOM.textOutput.value;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        showToast("Hasil enkripsi berhasil disalin!");
    });

    // Reset All Control
    DOM.btnReset.addEventListener('click', () => {
        playClickSound();
        DOM.rLeftType.value = 'I';
        DOM.rMidType.value = 'II';
        DOM.rRightType.value = 'III';

        DOM.posLeftVal.value = 'A';
        DOM.posMidVal.value = 'A';
        DOM.posRightVal.value = 'A';

        DOM.ringLeft.value = 0;
        DOM.ringMid.value = 0;
        DOM.ringRight.value = 0;

        DOM.reflectorSelect.value = 'B';
        DOM.plugboardInput.value = '';
        DOM.textInput.value = '';

        processRealtimeText('reset');
        showToast("Seluruh pengaturan Enigma direset!");
    });

    // Preset WWII Navy
    DOM.btnNavyPreset.addEventListener('click', () => {
        playClickSound();
        DOM.rLeftType.value = 'M' in ROTOR_SPECS ? 'IV' : 'III';
        DOM.rLeftType.value = 'I';
        DOM.rMidType.value = 'IV';
        DOM.rRightType.value = 'V';

        DOM.posLeftVal.value = 'K';
        DOM.posMidVal.value = 'M';
        DOM.posRightVal.value = 'R';

        DOM.ringLeft.value = 2; // C
        DOM.ringMid.value = 11; // L
        DOM.ringRight.value = 4; // E

        DOM.reflectorSelect.value = 'B';
        DOM.plugboardInput.value = 'AN FZ UH SY';

        processRealtimeText('preset');
        showToast("Preset Standard Kriegsmarine dimuat!");
    });

    // Audio Toggle
    DOM.btnSoundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (soundEnabled) {
            DOM.soundIcon.className = "fa-solid fa-volume-high text-brass";
            DOM.soundLabel.textContent = "Audio On";
            playClickSound();
        } else {
            DOM.soundIcon.className = "fa-solid fa-volume-xmark text-gray-500";
            DOM.soundLabel.textContent = "Audio Off";
        }
    });
}

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    initRingDropdowns();
    bindEvents();
    processRealtimeText('init');
});