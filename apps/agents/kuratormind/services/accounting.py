"""
KuratorMind AI — Forensic Accounting Service

Provides computational logic for analyzing Indonesian financial statements.
Calculates key bankruptcy-relevant ratios (Liquidity, Solvency) and 
checks for accounting integrity (Double-Entry Balance).
"""

from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

def calculate_financial_ratios(data: Dict[str, float]) -> Dict[str, Any]:
    """
    Calculate key forensic ratios for bankruptcy analysis.
    
    Expected keys in data:
        - current_assets
        - current_liabilities
        - total_assets
        - total_liabilities
        - equity
        - net_income
        - revenue
    """
    ratios = {}
    
    # 1. Liquidity (Can they pay short-term?)
    ca = data.get("current_assets", 0)
    cl = data.get("current_liabilities", 0)
    ratios["current_ratio"] = ca / cl if cl != 0 else 0
    
    # 2. Solvency (Is the entity technically bankrupt?)
    ta = data.get("total_assets", 1) # avoid div by zero
    tl = data.get("total_liabilities", 0)
    ratios["debt_to_equity"] = tl / data.get("equity", 1) if data.get("equity") != 0 else 0
    ratios["debt_to_assets"] = tl / ta
    
    # 3. Profitability
    rev = data.get("revenue", 1)
    ratios["net_profit_margin"] = data.get("net_income", 0) / rev if rev != 0 else 0
    
    return ratios

def detect_accounting_anomalies(data: Dict[str, float]) -> List[Dict[str, Any]]:
    """
    Check for red flags/contradictions in financial reporting.
    """
    anomalies = []
    
    ta = data.get("total_assets", 0)
    tl = data.get("total_liabilities", 0)
    eq = data.get("equity", 0)
    
    # 1. Balance Sheet Identity: Assets = Liabilities + Equity
    diff = abs(ta - (tl + eq))
    if diff > 1000: # tolerance of 1000 IDR
        anomalies.append({
            "type": "balance_mismatch",
            "severity": "critical",
            "title": "Neraca Tidak Seimbang",
            "description": f"Total Aset ({ta}) tidak sama dengan Liabilitas + Ekuitas ({tl + eq}). Selisih: {diff}.",
        })
        
    # 2. Technical Insolvency Check (Under UU 37/2004)
    if eq < 0:
        anomalies.append({
            "type": "negative_equity",
            "severity": "high",
            "title": "Ekuitas Negatif",
            "description": "Perusahaan mengalami defisiensi modal (insolvency teknis).",
        })
        
    return anomalies

def detect_claim_discrepancies(claimed_amount: float, ledger_amount: float, threshold: float = 0.05) -> Dict[str, Any]:
    """
    Calculate variance between claimed amount and ledger amount.
    Returns audit flag details if variance exceeds threshold.
    """
    if ledger_amount == 0:
        variance = 1.0 if claimed_amount > 0 else 0
    else:
        variance = abs(claimed_amount - ledger_amount) / ledger_amount
        
    is_discrepancy = variance > threshold
    
    return {
        "is_discrepancy": is_discrepancy,
        "variance": variance,
        "claimed_amount": claimed_amount,
        "ledger_amount": ledger_amount,
        "severity": "critical" if variance > 0.5 else "high" if variance > 0.2 else "medium" if is_discrepancy else "low"
    }
