"""
Test Suite: Forensic Audit Logic

Verifies the claim discrepancy detection for the Sritex BCA scenario.
"""

import pytest
import pandas as pd
from kuratormind.services.accounting import detect_claim_discrepancies

def test_sritex_bca_discrepancy():
    """Verify the 78% variance discrepancy for Bank BCA (Sritex case)."""
    # Claimed in Sritex BCA case: 2,000,000,000,000 (2T)
    # Expected Ledger from forensic report: 1,120,000,000,000 (1.12T)
    # Variance: (2-1.12)/1.12 = 0.785 = 78.5%
    
    claimed = 2000000000000
    ledger = 1120000000000
    
    result = detect_claim_discrepancies(claimed, ledger)
    
    assert result["is_discrepancy"] == True
    assert round(result["variance"], 3) == 0.786 # Slightly more due to rounding or exact 78%
    assert result["severity"] == "critical"

def test_no_discrepancy():
    """Verify low variance doesn't trigger an audit flag."""
    claimed = 1050000
    ledger = 1000000 # 5% variance (threshold)
    
    result = detect_claim_discrepancies(claimed, ledger, threshold=0.1)
    assert result["is_discrepancy"] is False

def test_low_variance_flag():
    """Verify small variance above threshold results in medium severity."""
    claimed = 1070000
    ledger = 1000000 # 7% variance
    
    result = detect_claim_discrepancies(claimed, ledger, threshold=0.05)
    assert result["is_discrepancy"] == True
    assert result["severity"] == "medium"

def test_csv_data_audit_integration():
    """Verify audit logic using the test_sritex_claims.csv data."""
    # Try different potential paths for the test data
    paths = [
        "tests/data/test_sritex_claims.csv",
        "apps/agents/tests/data/test_sritex_claims.csv", # If run from root
        "../tests/data/test_sritex_claims.csv" # If run from inside tests/
    ]
    
    df = None
    for path in paths:
        try:
            df = pd.read_csv(path)
            break
        except FileNotFoundError:
            continue
            
    if df is None:
        pytest.skip("Test data CSV not found.")
        
    bca_claim = df[df["creditor_name"].str.contains("BCA")].iloc[0]
    
    claimed = bca_claim["claimed_amount"]
    # Simulation: Ledger says 1.12T
    ledger = 1120000000000
    
    result = detect_claim_discrepancies(claimed, ledger)
    assert result["is_discrepancy"] == True
    assert result["severity"] == "critical"
