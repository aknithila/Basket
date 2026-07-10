/**
 * Basket Catch Game - Core Logic & Visuals
 * Built with HTML5 Canvas & Web Audio API synthesis fallback
 */

// --- CONFIGURATION FLAGS ---
const PENALIZE_MISSES = false; // Set to true if letting good items hit the floor costs a life

// --- GAME CONSTANTS & PROFILES ---
const DIFFICULTY_PROFILES = {
    easy: {
        basketWidth: 140,
        baseSpeed: 3.5,
        spawnInterval: 1200, // ms
        bombChance: 0.10,
        lightningChance: 0.05,
        iceChance: 0.05,
        heartChance: 0.05,
        starChance: 0.15,
        coinChance: 0.20,
        // Apple is fallback if other chances not met (~40%)
        multiSpawnWeight: 0.0, // Easy only has single spawns
    },
    medium: {
        basketWidth: 100,
        baseSpeed: 5.0,
        spawnInterval: 900, // ms
        bombChance: 0.20,
        lightningChance: 0.05,
        iceChance: 0.05,
        heartChance: 0.05,
        starChance: 0.15,
        coinChance: 0.20,
        multiSpawnWeight: 0.15, // 15% chance of 2 falling items
    },
    hard: {
        basketWidth: 70,
        baseSpeed: 7.2,
        spawnInterval: 650, // ms
        bombChance: 0.30,
        lightningChance: 0.05,
        iceChance: 0.05,
        heartChance: 0.04,
        starChance: 0.15,
        coinChance: 0.15,
        multiSpawnWeight: 0.40, // 40% chance of 2-3 falling items
    }
};

// Object specs
const OBJECT_TYPES = {
    apple: { label: '🍎', points: 10, color: '#ff4757', effect: 'score' },
    star: { label: '⭐', points: 20, color: '#ffa502', effect: 'score' },
    coin: { label: '🪙', points: 15, color: '#eccc68', effect: 'score' },
    heart: { label: '❤️', points: 0, color: '#ff6b81', effect: 'heart' },
    bomb: { label: '💣', points: 0, color: '#2f3542', effect: 'bomb' },
    ice: { label: '❄️', points: 0, color: '#00d2d3', effect: 'ice' },
    lightning: { label: '⚡', points: 0, color: '#ffa502', effect: 'lightning' }
};

// --- SOUND MANAGER (WITH NATIVE WEB AUDIO SYNTHESIZER FALLBACK) ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.sounds = {};
        this.muted = false;

        // Cache files mapping
        this.soundSources = {
            click: 'assets/sounds/click.mp3',
            catch_fruit: 'assets/sounds/catch_fruit.mp3',
            catch_coin: 'assets/sounds/catch_coin.mp3',
            explosion: 'assets/sounds/explosion.mp3',
            level_up: 'assets/sounds/level_up.mp3',
            game_over: 'assets/sounds/game_over.mp3',
            highscore: 'assets/sounds/highscore.mp3'
        };

        // Try to initialize AudioContext on user interaction
        window.addEventListener('click', () => this.initContext(), { once: true });
        window.addEventListener('keydown', () => this.initContext(), { once: true });
    }

    initContext() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            console.log("AudioContext initialized");
            this.loadSoundFiles();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    loadSoundFiles() {
        // We will attempt to fetch actual audio, but if it's too short (stubs) or format issues, 
        // they will error out and we will run fallback synthesizers.
        Object.entries(this.soundSources).forEach(([name, path]) => {
            fetch(path)
                .then(resp => {
                    if (!resp.ok) throw new Error("File not found");
                    return resp.arrayBuffer();
                })
                .then(buffer => this.ctx.decodeAudioData(buffer))
                .then(audioBuffer => {
                    // Check if file is silent stub (typically under 1000 bytes or empty)
                    if (audioBuffer.duration < 0.1) {
                        throw new Error("File is silent placeholder stub");
                    }
                    this.sounds[name] = audioBuffer;
                })
                .catch(err => {
                    console.log(`Using synth fallback for '${name}' audio:`, err.message);
                    this.sounds[name] = null; // Will trigger synthesizer fallback on play
                });
        });
    }

    play(name) {
        if (this.muted) return;
        this.initContext();
        if (!this.ctx) return;

        // Try playing native loaded file
        if (this.sounds[name] && this.sounds[name] !== null) {
            try {
                const source = this.ctx.createBufferSource();
                source.buffer = this.sounds[name];
                source.connect(this.ctx.destination);
                source.start(0);
                return;
            } catch (e) {
                console.warn("Failed to play loaded sound file, falling back to synth", e);
            }
        }

        // Run synthesizer fallbacks (high-fidelity arcade synthesizer)
        this.synthSound(name);
    }

    synthSound(name) {
        const time = this.ctx.currentTime;
        switch (name) {
            case 'click': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(400, time + 0.08);
                gain.gain.setValueAtTime(0.15, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + 0.08);
                break;
            }
            case 'catch_fruit': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, time);
                osc.frequency.exponentialRampToValueAtTime(600, time + 0.12);
                gain.gain.setValueAtTime(0.2, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + 0.12);
                break;
            }
            case 'catch_coin': {
                // Retro double-tone coin sound
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc1.type = 'sine';
                osc2.type = 'sine';

                osc1.frequency.setValueAtTime(987.77, time); // B5
                osc1.frequency.setValueAtTime(1318.51, time + 0.08); // E6
                osc2.frequency.setValueAtTime(1318.51, time);
                osc2.frequency.setValueAtTime(1975.53, time + 0.08); // B6

                gain.gain.setValueAtTime(0.12, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(this.ctx.destination);

                osc1.start(time);
                osc2.start(time);
                osc1.stop(time + 0.3);
                osc2.stop(time + 0.3);
                break;
            }
            case 'explosion': {
                // Low-pass noise-like crash sound
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, time);
                osc.frequency.linearRampToValueAtTime(40, time + 0.35);

                gain.gain.setValueAtTime(0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + 0.4);
                break;
            }
            case 'level_up': {
                // Ascending major chord chimes
                const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4 major scale notes
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, time + idx * 0.08);
                    gain.gain.setValueAtTime(0.15, time + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + idx * 0.08 + 0.25);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(time + idx * 0.08);
                    osc.stop(time + idx * 0.08 + 0.25);
                });
                break;
            }
            case 'game_over': {
                // Descending sad sine tones
                const notes = [392.00, 349.23, 311.13, 220.00]; // G4, F4, Eb4, A3
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, time + idx * 0.15);
                    gain.gain.setValueAtTime(0.18, time + idx * 0.15);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + idx * 0.15 + 0.3);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(time + idx * 0.15);
                    osc.stop(time + idx * 0.15 + 0.3);
                });
                break;
            }
            case 'highscore': {
                // Triumphant fast arpeggios
                const theme = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
                theme.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, time + idx * 0.06);
                    gain.gain.setValueAtTime(0.15, time + idx * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + idx * 0.06 + 0.15);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(time + idx * 0.06);
                    osc.stop(time + idx * 0.06 + 0.15);
                });
                break;
            }
        }
    }
}

const audio = new SoundManager();

// --- IMAGE PRELOAD & VECTOR RENDERING FALLBACKS ---
const imageAssets = {};
const assetNames = ['basket', 'apple', 'star', 'coin', 'heart', 'bomb', 'ice', 'lightning'];
let assetsLoaded = 0;

function preloadAssets() {
    assetNames.forEach(name => {
        const img = new Image();
        img.src = `assets/images/${name}.png`;
        img.onload = () => {
            // Check if it's the 1x1 pixel dummy
            if (img.width <= 1 && img.height <= 1) {
                imageAssets[name] = null; // Forces high-fidelity vector draw
            } else {
                imageAssets[name] = img;
            }
            checkLoadProgress();
        };
        img.onerror = () => {
            console.log(`Failed to load ${name} image, using vector canvas draw instead.`);
            imageAssets[name] = null;
            checkLoadProgress();
        };
    });
}

function checkLoadProgress() {
    assetsLoaded++;
    if (assetsLoaded === assetNames.length) {
        console.log("Assets checked/loaded. Initial fallback matrices established.");
    }
}

// Vector asset drawer fallback (crisp HD rendering directly on HTML5 Canvas)
function drawVectorSprite(ctx, name, x, y, size, angle, state = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    switch (name) {
        case 'basket': {
            // Drawn centered (y stands for top of basket)
            const w = size;
            const h = 25;

            // Draw rim
            ctx.fillStyle = '#8B5A2B'; // SaddleBrown
            ctx.beginPath();
            ctx.roundRect(-w / 2, 0, w, 8, 4);
            ctx.fill();

            // Wicker grid base
            ctx.fillStyle = '#CD853F'; // Peru
            ctx.beginPath();
            ctx.moveTo(-w / 2 + 10, 8);
            ctx.lineTo(w / 2 - 10, 8);
            ctx.lineTo(w / 2 - 20, h);
            ctx.lineTo(-w / 2 + 20, h);
            ctx.closePath();
            ctx.fill();

            // Wicker texture lines
            ctx.strokeStyle = '#5C3818';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = -w / 2 + 20; i <= w / 2 - 20; i += 15) {
                ctx.moveTo(i * 0.8, 8);
                ctx.lineTo(i * 0.7, h);
            }
            ctx.stroke();
            break;
        }
        case 'apple': {
            const r = size / 2;
            // Apple Red Body
            ctx.fillStyle = '#ff4757';
            ctx.beginPath();
            ctx.arc(-r / 5, 0, r * 0.9, 0, Math.PI * 2);
            ctx.arc(r / 5, 0, r * 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Stem
            ctx.strokeStyle = '#8B5A2B';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, -r + 2);
            ctx.quadraticCurveTo(5, -r - 5, 8, -r - 4);
            ctx.stroke();

            // Leaf
            ctx.fillStyle = '#2ed573';
            ctx.beginPath();
            ctx.ellipse(5, -r - 3, 4, 2, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'star': {
            const r = size / 2;
            const spikes = 5;
            let rot = Math.PI / 2 * 3;
            let cx = 0, cy = 0;
            let step = Math.PI / spikes;

            ctx.fillStyle = '#ffa502';
            ctx.shadowColor = 'rgba(255, 165, 2, 0.4)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            for (let i = 0; i < spikes; i++) {
                cx = Math.cos(rot) * r;
                cy = Math.sin(rot) * r;
                ctx.lineTo(cx, cy);
                rot += step;

                cx = Math.cos(rot) * (r * 0.4);
                cy = Math.sin(rot) * (r * 0.4);
                ctx.lineTo(cx, cy);
                rot += step;
            }
            ctx.lineTo(0, -r);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'coin': {
            const r = size / 2;
            // Outer Coin Gold
            ctx.fillStyle = '#ffa502';
            ctx.strokeStyle = '#eccc68';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Inner circle
            ctx.strokeStyle = '#b37400';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
            ctx.stroke();

            // Currency sign "¢" or "$"
            ctx.fillStyle = '#ff7f00';
            ctx.font = `bold ${Math.round(size * 0.5)}px var(--font-main)`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
            break;
        }
        case 'heart': {
            const r = size / 2;
            ctx.fillStyle = '#ff6b81';
            ctx.beginPath();
            ctx.moveTo(0, -r / 3);
            ctx.bezierCurveTo(-r, -r, -r, r / 2, 0, r);
            ctx.bezierCurveTo(r, r / 2, r, -r, 0, -r / 3);
            ctx.fill();
            break;
        }
        case 'bomb': {
            const r = size / 2.2;

            // Draw fuse
            ctx.strokeStyle = '#f1f2f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.quadraticCurveTo(10, -r - 10, 5, -r - 16);
            ctx.stroke();

            // Spark
            ctx.fillStyle = '#ffa502';
            ctx.beginPath();
            ctx.arc(5, -r - 16, 3, 0, Math.PI * 2);
            ctx.fill();

            // Bomb main body
            ctx.fillStyle = '#2f3542';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Cap
            ctx.fillStyle = '#57606f';
            ctx.fillRect(-4, -r - 2, 8, 4);

            // Shading glare
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(-r / 3, -r / 3, r / 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'ice': {
            const r = size / 2;
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 3;
            // Draw snowflake branches
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                ctx.rotate(Math.PI / 3);
                ctx.moveTo(0, 0);
                ctx.lineTo(0, r);
                ctx.moveTo(0, r * 0.5);
                ctx.lineTo(-r * 0.2, r * 0.7);
                ctx.moveTo(0, r * 0.5);
                ctx.lineTo(r * 0.2, r * 0.7);
            }
            ctx.stroke();
            break;
        }
        case 'lightning': {
            const r = size / 2.2;
            ctx.fillStyle = '#ffd32a';
            ctx.shadowColor = '#ffd32a';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 0.6, -r * 0.1);
            ctx.lineTo(r * 0.1, -r * 0.1);
            ctx.lineTo(r * 0.5, r);
            ctx.lineTo(-r * 0.6, r * 0.1);
            ctx.lineTo(-r * 0.1, r * 0.1);
            ctx.closePath();
            ctx.fill();
            break;
        }
    }
    ctx.restore();
}

// --- PARTICLES ENGINE ---
class Particle {
    constructor(x, y, color, emoji = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.emoji = emoji;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 4; // Spawn moving slightly upwards
        this.size = Math.random() * 5 + 4;
        this.alpha = 1.0;
        this.decay = Math.random() * 0.02 + 0.015;
        this.rotation = Math.random() * Math.PI;
        this.spin = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.18; // Gravity
        this.rotation += this.spin;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        if (this.emoji) {
            ctx.font = `${Math.round(this.size * 2)}px sans-serif`;
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillText(this.emoji, -this.size, this.size);
        } else {
            ctx.fillStyle = this.color;
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }
        ctx.restore();
    }
}

// --- SYSTEM STATE REGISTRY ---
const STATE = {
    screen: 'START', // START, PLAYING, PAUSED, GAMEOVER
    difficulty: 'medium',
    score: 0,
    highscore: 0,
    lives: 3,
    level: 1,
    levelTimeTracker: 0, // keeps track of difficulty speed scaling timer
    difficultyScaleTime: 18000, // Speed increases every 18 seconds
    baseSpeed: 5.0,
    currentSpeed: 5.0,
    keys: {},
    particles: [],
    fallingObjects: [],

    // Basket properties
    basket: {
        x: 350,
        y: 530,
        width: 100,
        height: 20,
        speed: 8,
        scaleX: 1.0,
        scaleY: 1.0
    },

    // Timers & Duration Trackers
    iceTimer: 0,
    lightningTimer: 0,

    lastSpawnTime: 0
};

// --- DOM ELEMENT REFERENCES ---
const DOM = {
    gameContainer: document.getElementById('game-container'),
    canvas: document.getElementById('gameCanvas'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    hud: document.getElementById('hud'),
    score: document.getElementById('hud-score'),
    highscore: document.getElementById('hud-highscore'),
    menuHighscore: document.getElementById('menu-highscore'),
    heartsBox: document.getElementById('hearts-box'),
    levelBadge: document.getElementById('level-badge'),
    multiplierBadge: document.getElementById('multiplier-badge'),
    toastContainer: document.getElementById('toast-container'),
    frostOverlay: document.getElementById('frost-overlay'),
    screenFlash: document.getElementById('screen-flash'),
    finalScore: document.getElementById('final-score'),
    newHighscoreBadge: document.getElementById('new-highscore-badge'),

    // Buttons
    startBtn: document.getElementById('start-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    restartBtn: document.getElementById('restart-btn'),
    pauseRestartBtn: document.getElementById('pause-restart-btn'),
    pauseMenuBtn: document.getElementById('pause-menu-btn'),
    gameoverMenuBtn: document.getElementById('gameover-menu-btn')
};

const ctx = DOM.canvas.getContext('2d');

// --- EVENT LISTENERS INITIALIZATION ---
function initEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', e => {
        STATE.keys[e.key] = true;

        // Handle Game Over / Pause shortcuts globally
        if (e.key === 'p' || e.key === 'P') {
            if (STATE.screen === 'PLAYING') {
                pauseGame();
            } else if (STATE.screen === 'PAUSED') {
                resumeGame();
            }
        }
        if (e.key === 'r' || e.key === 'R') {
            if (STATE.screen === 'PLAYING' || STATE.screen === 'PAUSED' || STATE.screen === 'GAMEOVER') {
                restartGame();
            }
        }
        if (e.key === 'Escape') {
            if (STATE.screen === 'PLAYING' || STATE.screen === 'PAUSED' || STATE.screen === 'GAMEOVER') {
                returnToMenu();
            }
        }
    });

    window.addEventListener('keyup', e => {
        STATE.keys[e.key] = false;
    });

    // Difficulty selection toggle
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            audio.play('click');
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            STATE.difficulty = btn.dataset.diff;
        });
    });

    // Button clicks
    DOM.startBtn.addEventListener('click', () => {
        audio.play('click');
        startGame();
    });
    DOM.resumeBtn.addEventListener('click', () => {
        audio.play('click');
        resumeGame();
    });
    DOM.restartBtn.addEventListener('click', () => {
        audio.play('click');
        restartGame();
    });
    DOM.pauseRestartBtn.addEventListener('click', () => {
        audio.play('click');
        restartGame();
    });
    DOM.pauseMenuBtn.addEventListener('click', () => {
        audio.play('click');
        returnToMenu();
    });
    DOM.gameoverMenuBtn.addEventListener('click', () => {
        audio.play('click');
        returnToMenu();
    });

    // Load initial highscore
    fetchHighscore();
}

// --- STATE PERSISTENCE / BACKEND APIS ---
function fetchHighscore() {
    fetch('/highscore')
        .then(resp => resp.json())
        .then(data => {
            const hs = data.highscore || 0;
            STATE.highscore = hs;
            DOM.highscore.innerText = hs;
            DOM.menuHighscore.innerText = hs;
        })
        .catch(err => console.warn("Failed fetching high score from Flask:", err));
}

function submitHighscore(score) {
    fetch('/highscore', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score })
    })
        .then(resp => resp.json())
        .then(data => {
            const hs = data.highscore || 0;
            const new_record = score > STATE.highscore && score > 0;

            STATE.highscore = hs;
            DOM.highscore.innerText = hs;
            DOM.menuHighscore.innerText = hs;

            if (new_record) {
                DOM.newHighscoreBadge.classList.remove('hidden');
                audio.play('highscore');
                createConfettiBurst(400, 300, 80);
            } else {
                DOM.newHighscoreBadge.classList.add('hidden');
                audio.play('game_over');
            }
        })
        .catch(err => {
            console.warn("Failed saving high score:", err);
            // Local fallback in case server fails
            if (score > STATE.highscore) {
                STATE.highscore = score;
                DOM.highscore.innerText = score;
                DOM.menuHighscore.innerText = score;
                DOM.newHighscoreBadge.classList.remove('hidden');
                audio.play('highscore');
            } else {
                DOM.newHighscoreBadge.classList.add('hidden');
                audio.play('game_over');
            }
        });
}

// --- POP TOAST NOTICE TRIGGER ---
function showToast(text, typeClass = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${typeClass}`;
    toast.innerText = text;
    DOM.toastContainer.appendChild(toast);

    // Automatically delete after animation
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// --- SCREEN STATE CONTROLLERS ---
function startGame() {
    STATE.screen = 'PLAYING';
    DOM.startScreen.classList.add('hidden');
    DOM.pauseScreen.classList.add('hidden');
    DOM.gameOverScreen.classList.add('hidden');
    DOM.hud.classList.remove('hidden');

    resetGameStats();
}

function pauseGame() {
    STATE.screen = 'PAUSED';
    DOM.pauseScreen.classList.remove('hidden');
}

function resumeGame() {
    STATE.screen = 'PLAYING';
    DOM.pauseScreen.classList.add('hidden');
}

function restartGame() {
    STATE.screen = 'PLAYING';
    DOM.startScreen.classList.add('hidden');
    DOM.pauseScreen.classList.add('hidden');
    DOM.gameOverScreen.classList.add('hidden');
    DOM.hud.classList.remove('hidden');

    resetGameStats();
}

function returnToMenu() {
    STATE.screen = 'START';
    DOM.startScreen.classList.remove('hidden');
    DOM.pauseScreen.classList.add('hidden');
    DOM.gameOverScreen.classList.add('hidden');
    DOM.hud.classList.add('hidden');

    // Refresh high score on menu reload
    fetchHighscore();
}

function gameOver() {
    STATE.screen = 'GAMEOVER';
    DOM.hud.classList.add('hidden');
    DOM.gameOverScreen.classList.remove('hidden');
    DOM.finalScore.innerText = STATE.score;

    // Send score to Flask server
    submitHighscore(STATE.score);
}

function resetGameStats() {
    const profile = DIFFICULTY_PROFILES[STATE.difficulty];

    STATE.score = 0;
    STATE.lives = 3;
    STATE.level = 1;
    STATE.levelTimeTracker = 0;
    STATE.baseSpeed = profile.baseSpeed;
    STATE.currentSpeed = profile.baseSpeed;

    STATE.basket.width = profile.basketWidth;
    STATE.basket.x = (DOM.canvas.width - profile.basketWidth) / 2;
    STATE.basket.scaleX = 1.0;
    STATE.basket.scaleY = 1.0;

    STATE.iceTimer = 0;
    STATE.lightningTimer = 0;
    STATE.fallingObjects = [];
    STATE.particles = [];

    updateHUD();
    renderHearts();
}

// --- HUD RENDERING WRAPPERS ---
function updateHUD() {
    // Animating HUD score counters on change
    const curVal = parseInt(DOM.score.innerText);
    if (curVal !== STATE.score) {
        DOM.score.innerText = STATE.score;
        DOM.score.classList.add('pop');
        setTimeout(() => DOM.score.classList.remove('pop'), 200);
    }

    DOM.levelBadge.innerText = `Level ${STATE.level}`;

    if (STATE.iceTimer > 0) {
        DOM.multiplierBadge.classList.remove('hidden');
        DOM.multiplierBadge.innerText = '50% SLOW';
        DOM.frostOverlay.classList.remove('hidden');
    } else {
        DOM.multiplierBadge.classList.add('hidden');
        DOM.frostOverlay.classList.add('hidden');
    }
}

function renderHearts() {
    const box = DOM.heartsBox;
    box.innerHTML = '';

    // Draw total hearts up to the current count
    for (let i = 0; i < 5; i++) {
        const heartEl = document.createElement('span');
        heartEl.className = 'heart';

        if (i < STATE.lives) {
            heartEl.innerText = '❤️';
            heartEl.classList.add('active');
        } else {
            heartEl.innerText = '🖤';
            heartEl.classList.add('broken');
        }

        box.appendChild(heartEl);
    }
}

// Perform animations on lives adjustment
function decrementLives() {
    STATE.lives--;
    renderHearts();

    // Spark animation or HUD break
    if (STATE.lives <= 0) {
        gameOver();
    }
}

function incrementLives() {
    if (STATE.lives < 5) {
        STATE.lives++;
        renderHearts();

        // Pop/grow animation on recently filled heart
        const activeHearts = DOM.heartsBox.querySelectorAll('.heart.active');
        if (activeHearts.length > 0) {
            const lastHeart = activeHearts[activeHearts.length - 1];
            lastHeart.classList.add('pop');
            setTimeout(() => lastHeart.classList.remove('pop'), 400);
        }
    }
}

// --- PARTICLE BURSTS GENERATOR ---
function createConfettiBurst(x, y, count = 20, emoji = null) {
    const colors = ['#2ed573', '#ff4757', '#ffa502', '#00d2d3', '#eccc68', '#f1f2f6'];
    for (let i = 0; i < count; i++) {
        const randColor = colors[Math.floor(Math.random() * colors.length)];
        STATE.particles.push(new Particle(x, y, randColor, emoji));
    }
}

function triggerBombExplosion(x, y) {
    // Fire sparks
    for (let i = 0; i < 30; i++) {
        const p = new Particle(x, y, '#ff4757', null);
        p.vx = (Math.random() - 0.5) * 14;
        p.vy = (Math.random() - 0.5) * 14 - 5;
        p.size = Math.random() * 6 + 5;
        STATE.particles.push(p);
    }

    // Screen shake overlay
    DOM.gameContainer.classList.add('shake');
    DOM.screenFlash.classList.add('active');

    setTimeout(() => {
        DOM.gameContainer.classList.remove('shake');
        DOM.screenFlash.classList.remove('active');
    }, 400);
}

// --- SPAWN MANAGER ---
function selectObjectType(profile) {
    const roll = Math.random();

    let sum = 0;

    sum += profile.bombChance;
    if (roll < sum) return 'bomb';

    sum += profile.lightningChance;
    if (roll < sum) return 'lightning';

    sum += profile.iceChance;
    if (roll < sum) return 'ice';

    sum += profile.heartChance;
    if (roll < sum) return 'heart';

    sum += profile.starChance;
    if (roll < sum) return 'star';

    sum += profile.coinChance;
    if (roll < sum) return 'coin';

    return 'apple'; // default fruit
}

function spawnFallbackObjects() {
    const profile = DIFFICULTY_PROFILES[STATE.difficulty];

    // Choose spawn item
    const type = selectObjectType(profile);
    const w = 32; // size
    const boundsX = DOM.canvas.width - w * 2;
    const spawnX = Math.random() * boundsX + w;
    const swayAmplitude = Math.random() * 40 + 10;
    const swayFrequency = Math.random() * 0.04 + 0.01;
    const rotationSpeed = (Math.random() - 0.5) * 0.05;

    STATE.fallingObjects.push({
        id: Math.random(),
        type,
        baseX: spawnX,
        x: spawnX,
        y: -30,
        size: 32,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed,
        swayAmplitude,
        swayFrequency,
        swayPhase: Math.random() * Math.PI * 2,
        spawnTime: Date.now()
    });
}

function attemptSpawning(timestamp) {
    const profile = DIFFICULTY_PROFILES[STATE.difficulty];

    // Scale spawn rate based on level: items drop slightly faster/closer together
    const scaledInterval = Math.max(profile.spawnInterval - (STATE.level * 40), 300);

    if (timestamp - STATE.lastSpawnTime >= scaledInterval) {
        STATE.lastSpawnTime = timestamp;

        // Spawn original item
        spawnFallbackObjects();

        // Hard difficulty multi-spawns trigger chance check
        if (profile.multiSpawnWeight > 0 && Math.random() < profile.multiSpawnWeight) {
            // Spawn 1 or 2 additional objects
            const count = Math.random() < 0.8 ? 1 : 2;
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (STATE.screen === 'PLAYING') {
                        spawnFallbackObjects();
                    }
                }, Math.random() * 250);
            }
        }
    }
}

// --- COLLISION RESOLUTION ---
function checkCollisions() {
    const basket = STATE.basket;

    for (let i = STATE.fallingObjects.length - 1; i >= 0; i--) {
        const item = STATE.fallingObjects[i];

        // AABB check or basic radius offset detection relative to basket
        const basketLeft = basket.x;
        const basketRight = basket.x + basket.width;
        // The wicker basket visual renders from y downwards (thickness ~ 25px)
        const basketTop = basket.y;
        const basketBottom = basket.y + basket.height;

        // item points
        const itemX = item.x;
        const itemY = item.y;
        const itemRadius = item.size / 2;

        // Simple bounding check
        const hitX = (itemX + itemRadius >= basketLeft) && (itemX - itemRadius <= basketRight);
        const hitY = (itemY + itemRadius >= basketTop) && (itemY - itemRadius <= basketBottom);

        if (hitX && hitY) {
            // Collision caught!
            triggerCatchEffect(item);
            STATE.fallingObjects.splice(i, 1);
            continue;
        }

        // Missed item (floor hit)
        if (item.y - itemRadius > DOM.canvas.height) {
            const spec = OBJECT_TYPES[item.type];
            if (PENALIZE_MISSES && spec.effect !== 'bomb') {
                // Cost life for missing good items
                decrementLives();
                showToast("Missed!", "speed-up");
            }
            STATE.fallingObjects.splice(i, 1);
        }
    }
}

function triggerCatchEffect(item) {
    const spec = OBJECT_TYPES[item.type];

    // Squash & Stretch Basket Animation triggers
    STATE.basket.scaleX = 1.25;
    STATE.basket.scaleY = 0.70;

    if (spec.effect === 'score') {
        STATE.score += spec.points;
        updateHUD();

        // Different sounds/particles for star/coin vs fruit
        if (item.type === 'star') {
            audio.play('catch_coin');
            createConfettiBurst(item.x, item.y, 12, '⭐');
        } else if (item.type === 'coin') {
            audio.play('catch_coin');
            createConfettiBurst(item.x, item.y, 8, '🪙');
        } else {
            audio.play('catch_fruit');
            createConfettiBurst(item.x, item.y, 5);
        }
    } else if (spec.effect === 'bomb') {
        audio.play('explosion');
        triggerBombExplosion(item.x, item.y);
        decrementLives();
    } else if (spec.effect === 'heart') {
        audio.play('catch_fruit');
        createConfettiBurst(item.x, item.y, 10, '❤️');
        incrementLives();
        showToast("+1 Life!", "level-up");
    } else if (spec.effect === 'ice') {
        audio.play('catch_fruit');
        createConfettiBurst(item.x, item.y, 12, '❄️');
        STATE.iceTimer = 300; // 5 seconds at 60 FPS
        showToast("Blizzard: Slow Down!", "level-up");
        updateHUD();
    } else if (spec.effect === 'lightning') {
        audio.play('catch_coin');
        createConfettiBurst(item.x, item.y, 15, '⚡');
        STATE.lightningTimer = 300; // 5 seconds
        showToast("Supercharged!", "level-up");
        DOM.screenFlash.classList.add('flash-lightning');
        setTimeout(() => DOM.screenFlash.classList.remove('flash-lightning'), 150);
    }
}

// --- STATE UPDATE LOOP ---
function update(delta) {
    // 1. Move Basket
    let moveSpeed = STATE.basket.speed;

    // Lightning power-up speed multiplier (+65% speed boost)
    if (STATE.lightningTimer > 0) {
        moveSpeed *= 1.65;
        STATE.lightningTimer--;
    }

    if (STATE.keys['ArrowLeft'] || STATE.keys['a'] || STATE.keys['A']) {
        STATE.basket.x -= moveSpeed;
    }
    if (STATE.keys['ArrowRight'] || STATE.keys['d'] || STATE.keys['D']) {
        STATE.basket.x += moveSpeed;
    }

    // Bounds boundary clamp
    if (STATE.basket.x < 0) STATE.basket.x = 0;
    if (STATE.basket.x + STATE.basket.width > DOM.canvas.width) {
        STATE.basket.x = DOM.canvas.width - STATE.basket.width;
    }

    // Recover squash stretch factor slowly
    STATE.basket.scaleX += (1.0 - STATE.basket.scaleX) * 0.12;
    STATE.basket.scaleY += (1.0 - STATE.basket.scaleY) * 0.12;

    // 2. Power-Up active timers and UI updates
    if (STATE.iceTimer > 0) {
        STATE.iceTimer--;
        if (STATE.iceTimer === 0) {
            updateHUD(); // resets frost style
        }
    }

    // 3. Move items
    let fallSpeed = STATE.currentSpeed;
    if (STATE.iceTimer > 0) {
        fallSpeed *= 0.50; // Slow 50%
    }

    STATE.fallingObjects.forEach(item => {
        item.y += fallSpeed;

        // Horizontal sway disabled — objects fall straight down
        // const elapsed = (Date.now() - item.spawnTime) * item.swayFrequency;
        // item.x = item.baseX + Math.sin(elapsed + item.swayPhase) * item.swayAmplitude;

        // Spin rotation
        item.angle += item.rotationSpeed;
    });

    // 4. Update particles
    for (let i = STATE.particles.length - 1; i >= 0; i--) {
        const p = STATE.particles[i];
        p.update();
        if (p.alpha <= 0) {
            STATE.particles.splice(i, 1);
        }
    }

    // 5. Level progression triggers: increment every 18 seconds
    STATE.levelTimeTracker += delta;
    if (STATE.levelTimeTracker >= STATE.difficultyScaleTime) {
        STATE.levelTimeTracker = 0;
        STATE.level++;

        // Base scaling increments
        STATE.currentSpeed += 0.55;

        audio.play('level_up');
        showToast(`LEVEL UP! (Speed Up)`, 'level-up');
        updateHUD();
    }
}

// --- RENDERING LOOP ---
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

    // Modern space background gradients
    const bgGrad = ctx.createRadialGradient(
        DOM.canvas.width / 2, DOM.canvas.height / 2, 50,
        DOM.canvas.width / 2, DOM.canvas.height / 2, 400
    );

    // Tint background colors slightly if freezing blizzard is active
    if (STATE.iceTimer > 0) {
        bgGrad.addColorStop(0, '#102A45');
        bgGrad.addColorStop(1, '#081424');
    } else {
        bgGrad.addColorStop(0, '#1a1f33');
        bgGrad.addColorStop(1, '#090b11');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, DOM.canvas.width, DOM.canvas.height);

    // Draw grid background lines
    ctx.strokeStyle = STATE.iceTimer > 0 ? 'rgba(0, 210, 211, 0.04)' : 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1.5;
    for (let i = 50; i < DOM.canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, DOM.canvas.height);
        ctx.stroke();
    }
    for (let i = 50; i < DOM.canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(DOM.canvas.width, i);
        ctx.stroke();
    }

    // Draw falling items
    STATE.fallingObjects.forEach(item => {
        drawVectorSprite(ctx, item.type, item.x, item.y, item.size, item.angle);
    });

    // Draw Particles
    STATE.particles.forEach(p => p.draw(ctx));

    // Draw Basket (with Squash and Stretch scale factor applied)
    const basket = STATE.basket;
    ctx.save();

    // Translate origin to basket center base to perform scale transforms
    const centerX = basket.x + basket.width / 2;
    const centerY = basket.y + basket.height;

    ctx.translate(centerX, centerY);
    ctx.scale(basket.scaleX, basket.scaleY);

    // If fast lightning outline is active, project glowing electric aura
    if (STATE.lightningTimer > 0) {
        ctx.shadowColor = '#ffd32a';
        ctx.shadowBlur = 15;
    } else {
        ctx.shadowBlur = 0;
    }

    // Render vector basket offset back to original coordinates
    drawVectorSprite(ctx, 'basket', 0, -basket.height, basket.width, 0);
    ctx.restore();
}

// --- MAIN ENGINE LOOP ---
let lastTime = 0;
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    if (STATE.screen === 'PLAYING') {
        attemptSpawning(timestamp);
        update(delta);
        checkCollisions();
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// --- INITIALIZE APPLICATION ---
window.addEventListener('DOMContentLoaded', () => {
    initEvents();
    preloadAssets();

    // Start main game animation loop
    requestAnimationFrame(gameLoop);
});
