# 🌀 Debt Spiral — Early Warning System

An AI-powered web app that simulates your debt trajectory over 10 years, detects the exact point your debt becomes unrecoverable, and gives you personalized exit strategies via Claude AI.

Built for **Hackonomics** hackathon.

---

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, Anthropic Claude API
- **Frontend:** Vanilla JS, HTML/CSS, Chart.js
- **AI:** Claude claude-sonnet-4-5 via Anthropic SDK

---

## Setup & Run

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Set your Anthropic API key

```bash
# Windows (Git Bash / PowerShell)
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Windows CMD
set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Run the server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Open in browser

```
http://localhost:8000
```

---

## Project Structure

```
debt-spiral/
├── backend/
│   ├── main.py          # FastAPI app + routes
│   ├── simulator.py     # Month-by-month debt projection math
│   ├── ai_advisor.py    # Claude API integration
│   └── models.py        # Pydantic input models
├── frontend/
│   ├── index.html       # UI structure
│   ├── style.css        # Dark terminal aesthetic
│   └── app.js           # Chart.js + API calls
├── requirements.txt
└── README.md
```

---

## How It Works

1. User enters income, expenses, and all their debts
2. FastAPI runs a month-by-month simulation (up to 20 years)
3. Spiral threshold detected when:
   - DTI ratio exceeds 43%, OR
   - Minimum payments exceed available cash for 3+ consecutive months, OR
   - Debt doubles within 12 months
4. Claude API generates a personalized analysis with red flags + exit strategies
5. Chart.js visualizes the debt trajectory with a danger zone marker

---

## Deployment (Render)

1. Push to GitHub
2. Create a new Web Service on [render.com](https://render.com)
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5. Add env variable: `ANTHROPIC_API_KEY`
