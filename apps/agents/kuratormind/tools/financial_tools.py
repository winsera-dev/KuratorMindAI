"""
KuratorMind AI — Financial Tools

ADK-compatible tools for forensic accounting analysis.
Wraps the accounting service for agent utilization.
"""

from typing import Dict, Any, List, Optional
from kuratormind.services.accounting import (  # type: ignore
    calculate_financial_ratios,
    detect_accounting_anomalies
)
from kuratormind.tools.supabase_tools import _get_supabase  # type: ignore

def analyze_financial_data(
    vault_id: str,
    current_assets: float,
    current_liabilities: float,
    total_assets: float,
    total_liabilities: float,
    equity: float,
    net_income: float = 0.0,
    revenue: float = 0.0,
    period: str = "FY2023",
    document_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Perform a forensic analysis of a financial period.
    Calculates ratios, identifies anomalies, and persists results to Supabase.
    
    Args:
        vault_id: UUID of the vault.
        current_assets: Total current assets (Lancar).
        current_liabilities: Total short-term liabilities (Jangka Pendek).
        total_assets: Total assets.
        total_liabilities: Total liabilities.
        equity: Total Equity/Modal.
        net_income: Net income for the period.
        revenue: Total revenue/turnover.
        period: Timeframe identifier (e.g. 'FY2023').
        document_id: Optional UUID of the source document for citation.
        
    Returns:
        The analysis result including ratios and anomalies.
    """
    try:
        data = {
            "current_assets": current_assets,
            "current_liabilities": current_liabilities,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "equity": equity,
            "net_income": net_income,
            "revenue": revenue
        }
        
        # 1. Logic call
        ratios = calculate_financial_ratios(data)
        anomalies = detect_accounting_anomalies(data)
        
        # 2. Persist to Supabase
        sb = _get_supabase()
        analysis_record = {
            "vault_id": vault_id,
            "document_id": document_id,
            "report_type": "consolidated",
            "period": period,
            "ratios": ratios,
            "psak_compliance": [], # Future Scholar agent task
            "anomalies": anomalies,
        }
        
        result = sb.table("financial_analyses").insert(analysis_record).execute()
        
        return {
            "analysis": result.data[0] if result.data else None,
            "ratios": ratios,
            "anomalies": anomalies,
            "error": None
        }
    except Exception as e:
        return {"error": str(e), "analysis": None}

def log_accounting_red_flag(
    vault_id: str,
    title: str,
    description: str,
    severity: str = "medium",
    document_id: Optional[str] = None,
    evidence_snippet: str = ""
) -> Dict[str, Any]:
    """
    Record an accounting-specific red flag (anomaly, audit exception).
    
    Args:
        vault_id: UUID of the vault.
        title: Title of the flag (e.g. 'Neraca Tidak Seimbang').
        description: Forensic explanation of the flag.
        severity: 'critical', 'high', 'medium', 'low'.
        document_id: Source document UUID.
        evidence_snippet: Snippet from the PDF/Excel.
    """
    try:
        sb = _get_supabase()
        data = {
            "vault_id": vault_id,
            "title": title,
            "description": description,
            "severity": severity,
            "flag_type": "accounting_anomaly",
            "evidence": [{"source_id": document_id, "snippet": evidence_snippet}] if document_id else [],
            "resolved": False
        }
        result = sb.table("audit_flags").insert(data).execute()
        return {"flag": result.data[0] if result.data else None, "error": None}
    except Exception as e:
        return {"error": str(e)}
