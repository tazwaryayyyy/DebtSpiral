from models import UserFinancials


def simulate(financials: UserFinancials):
    months = financials.projection_years * 12
    results = []

    # Deep copy debts as dicts
    debts = [
        {
            "name": d.name,
            "balance": d.balance,
            "annual_interest_rate": d.annual_interest_rate,
            "minimum_payment": d.minimum_payment,
        }
        for d in financials.debts
    ]

    spiral_month = None
    consecutive_shortfall = 0
    initial_total_debt = sum(d["balance"] for d in debts)
    total_interest_accrued = 0.0

    for month in range(1, months + 1):
        # Apply monthly interest to each debt
        for d in debts:
            monthly_rate = d["annual_interest_rate"] / 12
            interest_added = d["balance"] * monthly_rate
            d["balance"] += interest_added
            total_interest_accrued += interest_added

        total_debt = sum(d["balance"] for d in debts)
        min_payments = sum(d["minimum_payment"] for d in debts)
        available_cash = financials.monthly_income - financials.monthly_essential_expenses

        shortfall = max(0.0, min_payments - available_cash)
        dti_ratio = (min_payments / financials.monthly_income) * 100 if financials.monthly_income > 0 else 0

        # Pay what we can toward debts (avalanche: highest interest first)
        payment_pool = max(0.0, available_cash)
        sorted_debts = sorted(debts, key=lambda x: x["annual_interest_rate"], reverse=True)
        for d in sorted_debts:
            if payment_pool <= 0:
                break
            pay = min(d["balance"], payment_pool)
            d["balance"] -= pay
            payment_pool -= pay

        # Recalculate total after payments
        total_debt = sum(d["balance"] for d in debts)

        # Spiral detection logic
        if shortfall > 0:
            consecutive_shortfall += 1
        else:
            consecutive_shortfall = 0

        debt_growth_rate = (total_debt / initial_total_debt) if initial_total_debt > 0 else 1

        is_spiral = (
            consecutive_shortfall >= 3
            or dti_ratio > 43
            or (month == 12 and debt_growth_rate > 2.0)
        )

        if spiral_month is None and is_spiral:
            spiral_month = month

        results.append(
            {
                "month": month,
                "total_debt": round(total_debt, 2),
                "dti_ratio": round(dti_ratio, 1),
                "shortfall": round(shortfall, 2),
                "available_cash": round(available_cash, 2),
                "min_payments": round(min_payments, 2),
            }
        )

        # Stop if debt is fully paid off
        if total_debt < 1.0:
            break

    # Summary stats
    final_debt = results[-1]["total_debt"]
    peak_debt = max(r["total_debt"] for r in results)

    return {
        "projection": results,
        "spiral_month": spiral_month,
        "spiral_detected": spiral_month is not None,
        "initial_total_debt": round(initial_total_debt, 2),
        "final_debt": round(final_debt, 2),
        "peak_debt": round(peak_debt, 2),
        "total_interest_estimated": round(total_interest_accrued, 2),
        "debt_free_month": next((r["month"] for r in results if r["total_debt"] < 1.0), None),
    }
