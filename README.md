# 🧺 Basket Catch

A fun 2D arcade-style game built with HTML5 Canvas + vanilla JavaScript, backed by a Python Flask server for high-score persistence.

Catch falling fruits, stars, and coins while avoiding bombs! Collect power-ups like Ice (slows everything) and Lightning (speeds up your basket).

## 🚀 Quick Start (Mac / Apple Silicon)

```bash
cd Basket
python3 -m venv venv
source venv/bin/activate
pip install flask
python3 server.py
```

Then open **http://localhost:5000** (or **http://localhost:5001** if port 5000 is occupied by macOS AirPlay) in your browser.

## 🎮 Controls

| Key | Action |
|---|---|
| `←` / `→` or `A` / `D` | Move basket |
| `P` | Pause / Resume |
| `R` | Restart game |
| `Esc` | Return to title screen |

## 🎯 Object Types

| Object | Effect |
|---|---|
| 🍎 Apple | +10 points |
| ⭐ Star | +20 points |
| 🪙 Coin | +15 points |
| ❤️ Heart | +1 life (max 5) |
| 💣 Bomb | Lose 1 life |
| ❄️ Ice | Slows all objects 50% for 5s |
| ⚡ Lightning | Speeds up basket for 5s |

## 🏆 Difficulty Levels

- **Easy** — Slow speed, large basket, few bombs (~10%)
- **Medium** — Moderate speed, medium basket, more bombs (~20%)
- **Hard** — Fast speed, tiny basket, frequent bombs (~30%), multi-drops

## 📁 Project Structure

```
Basket/
├── index.html          # Game shell, HUD, menus
├── style.css           # Dark glassmorphic UI styling
├── script.js           # Canvas game engine & logic
├── server.py           # Flask server + highscore API
├── highscore.json      # Persistent high score storage
├── assets/
│   ├── images/         # Sprite placeholders (vector fallback used)
│   └── sounds/         # Audio stubs (Web Audio synth fallback used)
└── README.md
```

## ⚙️ Configuration

In `script.js`, toggle `PENALIZE_MISSES = true` to make missed good items cost a life.

## 🔊 Audio

The game uses a **Web Audio API synthesizer** as fallback. To replace with your own sounds, drop MP3 files into `assets/sounds/` matching the existing filenames.
