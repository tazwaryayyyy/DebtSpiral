from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from models import UserFinancials
from simulator import simulate
from ai_advisor import get_advice

app = FastAPI(title="Debt Spiral Early Warning System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")


@app.get("/")
async def root():
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Debt Spiral API is running. Frontend not found."}


@app.post("/analyze")
async def analyze(financials: UserFinancials):
    if not financials.debts:
        raise HTTPException(status_code=400, detail="At least one debt is required.")
    if financials.monthly_income <= 0:
        raise HTTPException(status_code=400, detail="Monthly income must be greater than 0.")

    try:
        simulation = simulate(financials)
        advice = get_advice(financials, simulation)
        return {
            "simulation": simulation,
            "advice": advice,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
