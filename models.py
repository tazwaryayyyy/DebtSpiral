from pydantic import BaseModel
from typing import List

class Debt(BaseModel):
    name: str
    balance: float
    annual_interest_rate: float  # e.g. 0.18 for 18%
    minimum_payment: float

class UserFinancials(BaseModel):
    monthly_income: float
    monthly_essential_expenses: float
    debts: List[Debt]
    projection_years: int = 10
    currency: str = "USD"
