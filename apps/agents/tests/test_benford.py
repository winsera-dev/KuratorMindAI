"""
Test Suite: Benford's Law Analysis

Verifies the statistical outlier detection for digit distributions.
"""

import pytest
import random
import math
from kuratormind.services.accounting import perform_benford_analysis

def test_benford_natural_dataset():
    """Verify that a natural financial dataset (powers of 2) passes Benford's test."""
    # Powers of 2 follow Benford's Law closely
    data = [float(2**i) for i in range(1, 101)]
    result = perform_benford_analysis(data)
    
    assert result["is_flagged"] is False
    assert result["sample_size"] == 100
    assert "pola angka sesuai" in result["description"].lower()

def test_benford_manipulated_dataset():
    """Verify that a uniform/random dataset triggers a Benford flag."""
    # Data that starts with '5' 50% of the time is highly non-natural
    data = []
    for _ in range(50):
        data.append(float(random.randint(5000, 5999)))
    for _ in range(50):
        data.append(float(random.randint(1000, 9999)))
        
    result = perform_benford_analysis(data)
    
    # This should likely fail as 5 is over-represented
    assert result["is_flagged"] is True
    assert result["chi_squared"] > result["critical_value"]
    assert "anomali" in result["title"].lower()

def test_benford_small_sample():
    """Verify that Benford analysis handles small samples gracefully."""
    data = [1.0, 2.0, 3.0]
    result = perform_benford_analysis(data)
    
    assert result["is_flagged"] is False
    assert "data tidak cukup" in result["message"].lower()

def test_benford_zero_filtering():
    """Verify that zeros are ignored and correctly filtered, even if it results in a flag."""
    data = [0.0, 0, 100.0, 200.0, 300.0] * 15 # 45 valid samples
    result = perform_benford_analysis(data)
    
    assert result["sample_size"] == 45
    # The distribution [1, 2, 3] repeated is unnatural and should be flagged
    assert result["is_flagged"] is True
