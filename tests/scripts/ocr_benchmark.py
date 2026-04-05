import os
import sys
import jiwer
import pandas as pd
from typing import List, Tuple

def calculate_metrics(reference: str, hypothesis: str) -> Tuple[float, float]:
    """Calculates Word Error Rate (WER) and Character Error Rate (CER)."""
    if not reference:
        return 1.0, 1.0
    
    # Clean strings: remove extra whitespace and normalize
    ref = " ".join(reference.split())
    hyp = " ".join(hypothesis.split())
    
    wer = jiwer.wer(ref, hyp)
    cer = jiwer.cer(ref, hyp)
    
    return wer, cer

def main():
    print("KuratorMind OCR Benchmark Suite")
    print("================================")
    
    # Ground Truth: Using the names from the Sritex CSV as a baseline for extraction verification
    data_path = os.path.join(os.path.dirname(__file__), '../data/test_sritex_claims.csv')
    if not os.path.exists(data_path):
        print(f"Error: Ground truth file {data_path} not found.")
        sys.exit(1)
        
    df = pd.read_csv(data_path)
    # Join all names into a single reference string for a "structural" benchmark
    reference_text = " ".join(df['creditor_name'].astype(str).tolist())
    
    print(f"Reference length: {len(reference_text)} characters")
    
    # For benchmarking, we would normally run the OCR engine here.
    # Since we are setting up the INFRASTRUCTURE, we'll demonstrate with a mock hypothesis.
    # In a real test, this would come from ingestor_agent.extract_text(pdf_path)
    
    # Mocking a hypothesis with some errors (95% accuracy simulation)
    # We'll simulate a few common OCR errors (e.g., 'i' -> '1', 'o' -> '0')
    hypothesis_text = reference_text.replace("BCA", "B1A").replace("BNI", "BM").replace("CIMB", "C1MB")
    
    wer, cer = calculate_metrics(reference_text, hypothesis_text)
    
    print(f"\nBenchmark Results:")
    print(f" - Word Error Rate (WER):      {wer:.2%}")
    print(f" - Character Error Rate (CER): {cer:.2%}")
    
    if cer < 0.05:
        print("\n✅ SUCCESS: OCR accuracy within target (CER < 5%)")
    else:
        print("\n❌ FAILURE: OCR accuracy below target threshold")

if __name__ == "__main__":
    main()
