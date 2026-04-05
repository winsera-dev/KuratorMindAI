"""
Test Suite: Entity Resolution Benchmarks

Verifies the probabilistic entity resolution using Splink for cross-case creditor detection.
Focuses on the 'Heryanto' scenario where similar names appear across different bankruptcies.
"""

import pytest
import pandas as pd
try:
    from splink.duckdb.linker import DuckDBLinker
    import splink.duckdb.comparison_library as cl
except ImportError:
    DuckDBLinker = None

def test_splink_installed():
    """Ensure Splink is available for entity resolution."""
    assert DuckDBLinker is not None, "Splink is required for entity resolution benchmarks"

@pytest.mark.skipif(DuckDBLinker is None, reason="Splink not installed")
def test_heryanto_probabilistic_match():
    """
    TC-DISC-02: Verify Heryanto and Herianto are linked as the same entity.
    This scenario simulates a creditor appearing in 'Sritex' and 'Mitralanggeng' 
    with slight name variations.
    """
    # 1. Prepare synthetic data representing cross-case claims
    data = [
        {"unique_id": "claim_001", "name": "Heryanto", "case_id": "sritex-uuid"},
        {"unique_id": "claim_002", "name": "Herianto", "case_id": "mitra-uuid"},
        {"unique_id": "claim_003", "name": "Heryanto S.", "case_id": "other-uuid"},
        {"unique_id": "claim_004", "name": "Budi Utomo", "case_id": "sritex-uuid"},
    ]
    df = pd.DataFrame(data)

    # 2. Configure Splink settings
    # We use a simple Levenshtein comparison for name
    settings = {
        "link_type": "dedupe_only",
        "comparisons": [
            cl.levenshtein_at_thresholds("name", [1, 2]),
        ],
        "blocking_rules_to_generate_predictions": [
            "l.name = r.name",
            "substr(l.name,1,3) = substr(r.name,1,3)"
        ],
        "retain_intermediate_calculation_columns": True,
        "retain_matching_columns": True,
    }

    # 3. Initialize Linker and Predict
    linker = DuckDBLinker(df, settings)
    
    # We don't have enough data to train properly, so we use a high-level heuristic 
    # or just check if it identifies them as candidates with high similarity
    predictions = linker.predict(threshold_match_probability=0.7).as_pandas_dataframe()

    # 4. Verify Matches
    # Match 1: Heryanto vs Herianto (1 char diff)
    heryanto_match = predictions[
        ((predictions["unique_id_l"] == "claim_001") & (predictions["unique_id_r"] == "claim_002")) |
        ((predictions["unique_id_l"] == "claim_002") & (predictions["unique_id_r"] == "claim_001"))
    ]
    
    assert len(heryanto_match) > 0, "Splink failed to link Heryanto and Herianto"
    assert heryanto_match.iloc[0]["match_probability"] > 0.8
    
    # Match 2: Heryanto vs Heryanto S.
    suffix_match = predictions[
        ((predictions["unique_id_l"] == "claim_001") & (predictions["unique_id_r"] == "claim_003")) |
        ((predictions["unique_id_l"] == "claim_003") & (predictions["unique_id_r"] == "claim_001"))
    ]
    assert len(suffix_match) > 0, "Splink failed to link Heryanto and Heryanto S."

    # Non-match: Heryanto vs Budi
    budi_match = predictions[
        (predictions["unique_id_l"] == "claim_004") | (predictions["unique_id_r"] == "claim_004")
    ]
    assert len(budi_match) == 0, "Splink incorrectly linked Budi to Heryanto"

def test_heryanto_exact_match_benchmark():
    """Verify that even with exact matching, 'Heryanto' triggers a cross-case conflict."""
    # This simulates the current tool logic in supabase_tools.py
    from kuratormind.tools.supabase_tools import resolve_global_entity
    import os
    
    if not os.environ.get("SUPABASE_URL"):
        pytest.skip("Supabase not configured")

    # Mock IDs for the benchmark
    case_a = "00000000-0000-0000-0000-000000000001"
    case_b = "0a25cb8a-9e96-4ebd-aac4-30d32c282b14"
    
    # We resolve for Case A
    res_a = resolve_global_entity(
        name="Heryanto", 
        entity_type="creditor", 
        case_id=case_a,
        source_id="dummy-1",
        source_type="claim"
    )
    
    # We resolve for Case B
    res_b = resolve_global_entity(
        name="Heryanto", 
        entity_type="creditor", 
        case_id=case_b,
        source_id="dummy-2",
        source_type="claim"
    )
    
    assert res_b.get("has_conflict") is True
    assert res_b.get("other_vault_count") >= 1
