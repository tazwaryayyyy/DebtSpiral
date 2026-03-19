from dotenv import load_dotenv
load_dotenv()

import os
import requests

def get_advice(financials, simulation_result: dict) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "ERROR: GROQ_API_KEY not found in environment. Please check your .env file."

    spiral = simulation_result.get("spiral_month")
    initial = simulation_result.get("initial_total_debt", 0)
    peak = simulation_result.get("peak_debt", 0)
    interest = simulation_result.get("total_interest_estimated", 0)
    debt_free = simulation_result.get("debt_free_month")
    currency = financials.currency

    debt_list = "\n".join([
        f"  - {d.name}: {currency}{d.balance:,.0f} at {d.annual_interest_rate * 100:.1f}% APR, min payment {currency}{d.minimum_payment:,.0f}/mo"
        for d in financials.debts
    ])

    situation = (
        f"They will enter a DEBT SPIRAL in {spiral} months ({spiral // 12} years {spiral % 12} months)."
        if spiral else (
            f"They will be DEBT FREE in {debt_free} months."
            if debt_free else "Their debt trajectory is currently stable but not resolved."
        )
    )

    prompt = f"""You are a straight-talking financial advisor helping someone understand their debt situation.

User's financial profile:
- Monthly income: {currency}{financials.monthly_income:,.0f}
- Monthly essential expenses: {currency}{financials.monthly_essential_expenses:,.0f}
- Monthly surplus before debt: {currency}{financials.monthly_income - financials.monthly_essential_expenses:,.0f}
- Debts:
{debt_list}

Simulation result:
- Total debt today: {currency}{initial:,.0f}
- {situation}
- Estimated interest you'll pay: {currency}{interest:,.0f}
- Peak debt projected: {currency}{peak:,.0f}

Write your response in EXACTLY this format:

SITUATION
[2-3 sentences in plain language. No jargon.]

RED FLAGS
- [Specific red flag]
- [Specific red flag]
- [Specific red flag]

EXIT STRATEGIES
1. [Most impactful action with specific numbers]
2. [Second action]
3. [Third action]

BOTTOM LINE
[One punchy sentence on what they must do first.]

Be direct. Be honest. Don't sugarcoat."""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 700,
                "temperature": 0.7
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"ERROR: Failed to get AI advice. {str(e)}"
