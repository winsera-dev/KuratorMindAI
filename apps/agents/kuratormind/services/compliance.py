"""
KuratorMind AI — Regulatory Compliance Service

Implements logical triggers for Indonesian Bankruptcy Law (UU 37/2004).
Specifically validates Article 2 (Creditor Plurality) and 
Article 8 (Debt Maturity/Payment Failure).
"""

from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

def check_bankruptcy_eligibility(claims: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates if a set of claims meets the criteria for a bankruptcy petition 
    under UU 37/2004 Articles 2 and 8.
    
    Article 2: At least 2 creditors.
    Article 8: At least 1 matured and unpaid debt.
    """
    # 1. Article 2: Creditor Plurality
    creditors = {c.get("creditor_name") for c in claims if c.get("creditor_name")}
    creditor_count = len(creditors)
    meets_article_2 = creditor_count >= 2
    
    # 2. Article 8: Debt Maturity & Payment Failure
    # We look for claims that have 'matured': true in metadata or status is 'verified'/'disputed'
    # and represent a failure to pay.
    matured_claims = []
    for c in claims:
        metadata = c.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
            
        is_matured = metadata.get("is_matured") or metadata.get("jatuh_tempo")
        if is_matured:
            matured_claims.append(c)
            
    meets_article_8 = len(matured_claims) >= 1
    
    # 3. Simple Proof (Pembuktian Sederhana)
    # UU 37/2004 requires facts to be 'simply proven'. 
    # We verify that matured claims have documentation references.
    SIMPLE_PROOF_TYPES = ["Contract", "Invoice", "Agreement", "Akta", "Kuitansi", "Faktur", "SPK", "PO"]
    matured_with_proof = []
    for c in matured_claims:
        meta = c.get("metadata", {}) or {}
        doc_type = str(meta.get("document_type", ""))
        if any(pt.lower() in doc_type.lower() for pt in SIMPLE_PROOF_TYPES):
            matured_with_proof.append(c)
            
    meets_simple_proof = len(matured_with_proof) >= 1
    
    # Overall Eligibility
    eligible = meets_article_2 and meets_article_8 and meets_simple_proof
    
    reasons = []
    if not meets_article_2:
        reasons.append(f"Kurang dari 2 kreditur (Hanya ditemukan {creditor_count}).")
    if not meets_article_8:
        reasons.append("Tidak ditemukan utang yang telah jatuh waktu dan dapat ditagih.")
    if meets_article_8 and not meets_simple_proof:
        reasons.append("Utang yang jatuh tempo tidak memiliki bukti dokumen pendukung yang kuat (Pembuktian Sederhana).")
        
    return {
        "eligible": eligible,
        "article_2": {
            "status": meets_article_2,
            "creditor_count": creditor_count,
            "creditors": list(creditors)
        },
        "article_8": {
            "status": meets_article_8,
            "matured_claims_count": len(matured_claims),
            "matured_claims": [c.get("creditor_name") for c in matured_claims]
        },
        "simple_proof": {
            "status": meets_simple_proof,
            "proven_claims_count": len(matured_with_proof)
        },
        "reasons": reasons
    }
