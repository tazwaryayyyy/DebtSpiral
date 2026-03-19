# 🌀 Debt Spiral — Early Warning System

### *“Debt is a silent predator. Know its move before it strikes.”*

**Debt Spiral** is a high-fidelity financial simulator designed to reveal the exact moment your debt becomes mathematically unrecoverable. We don't just show you numbers; we show you the **"Point of No Return"**—the precise flashpoint where your interest accrual outpaces your ability to recover without external help.

Built with **FastAPI** and **Vanilla JS**, powered by **Groq AI**.

---

## ✨ Key Features

- **🔴 Emergency Landing Mode**: An adaptive UI that shifts into high-alert (ambient red glow, pulsing borders) when your financial health enters the danger zone (DTI > 43%).
- **🧠 AI Strategic Advisor**: A Groq-powered financial mentor that analyzes your specific debt structure and drafts a "Battle Plan" for recovery.
- **⚡ Daily Bleed Meter**: A real-time tracker showing exactly how much money you’re losing to interest every single day, down to the cent.
- **🛠️ What-If Simulator**: Interactive sliders allow you to test recovery scenarios (extra payments, expense cuts, rate refinancing) with instant Chart.js updates.
- **📈 Hybrid Area Visualization**: Indigo (Safe) vs. Red (Danger) area charts with sharp "Insolvency Zone" shading to visualize your headroom against monthly income.

---

## 🚀 Getting Started

### 1. Prepare the Environment
Ensure you have Python 3.11+ installed. Clone this repository and install the dependencies:

```bash
pip install -r requirements.txt
```

### 2. Configure Your Keys
Create a `.env` file in the `backend/` directory (you can copy `.env.example`):

```bash
GROQ_API_KEY=your_key_here
```

### 3. Launch the System
Start the FastAPI server using Uvicorn:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Then visit `http://localhost:8000` in your browser.

---

## 🔬 How the Simulation Works

The system uses a month-by-month **Avalanche Method** simulation:
1. **Interest Calculation**: Interest is applied to each debt individually at the start of every month.
2. **Avalanche Allocation**: Your monthly surplus (Income - Expenses) is prioritized toward the debt with the **highest interest rate**.
3. **Flashpoint Logic**: A "Spiral" is triggered if:
   - Your **DTI (Debt-to-Income)** ratio exceeds the critical **43%** threshold.
   - You experience **3 consecutive months** where minimum payments exceed available cash.
   - Your total debt doubles within a 12-month window.

---

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI, Pydantic, Python-Dotenv
- **AI Engine**: Groq (Llama-3.3-70b-versatile)
- **Frontend**: Vanilla JS (ES6+), CSS Grid/Variables, Chart.js 4.x
- **Visualization**: `chartjs-plugin-annotation` for real-time trajectory markers

---

## ⚖️ Disclaimer
This tool is for educational and simulation purposes only. It is not a substitute for professional financial advice. Always consult with a certified financial planner or credit counselor regarding serious debt situations.

---
*Built for the **Hackonomics Hackathon** · High-performance financial literacy.*
