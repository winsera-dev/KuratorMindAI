"""
KuratorMind AI — Semantic Reasoning Evaluation Suite

Quantitatively verifies the quality of AI legal reasoning using vector similarity.
Compares agent responses against Indonesian legal "Golden Answers".
"""

import pytest
import os
from google import genai
from kuratormind.agents.regulatory_scholar.agent import REGULATORY_SCHOLAR_INSTRUCTION

# Simple Cosine Similarity implementation
def cosine_similarity(v1, v2):
    dot = sum(a*b for a, b in zip(v1, v2))
    norm1 = sum(a*a for a in v1)**0.5
    norm2 = sum(b*b for b in v2)**0.5
    if norm1 == 0 or norm2 == 0:
        return 0
    return dot / (norm1 * norm2)

@pytest.fixture
def genai_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        pytest.skip("GOOGLE_API_KEY not set in environment.")
    return genai.Client(api_key=api_key)

# 5 Critical Legal Questions & Golden Answers for Indonesian Bankruptcy Law (UU 37/2004)
TEST_CASES = [
    {
        "name": "bankruptcy_criteria",
        "q": "Apa syarat materiil untuk mengajukan permohonan pailit bagi sebuah perusahaan di Indonesia?",
        "golden": "Berdasarkan Pasal 2 ayat (1) UU 37/2004, debitur harus mempunyai dua atau lebih kreditur dan tidak membayar lunas sedikitnya satu utang yang telah jatuh waktu dan dapat ditagih."
    },
    {
        "name": "actio_pauliana",
        "q": "Jelaskan apa itu Actio Pauliana dan batas waktu perbuatan hukum yang dapat dibatalkan.",
        "golden": "Actio Pauliana adalah hak kurator untuk membatalkan perbuatan hukum debitur yang merugikan kreditur yang dilakukan dalam jangka waktu 1 tahun sebelum putusan pernyataan pailit diucapkan (Pasal 41-47 UU 37/2004)."
    },
    {
        "name": "creditor_hierarchy",
        "q": "Bagaimana urutan prioritas pembagian aset (boedel) pailit antara kreditur separatis, pajak, dan konkuren?",
        "golden": "Secara umum, biaya perkara/kurator didahulukan, diikuti hak negara (pajak) dan upah pekerja (preferen), kemudian kreditur separatis (pemegang jaminan), dan terakhir kreditur konkuren (unsecured)."
    },
    {
        "name": "pkpu_duration",
        "q": "Berapa lama jangka waktu maksimal proses PKPU termasuk perpanjangannya?",
        "golden": "PKPU Tetap beserta perpanjangannya tidak boleh melebihi jangka waktu 270 hari setelah putusan PKPU Sementara diucapkan (Pasal 228 ayat 6 UU 37/2004)."
    },
    {
        "name": "simple_proof",
        "q": "Apa yang dimaksud dengan prinsip pembuktian sederhana (pembuktian sumir) dalam hukum kepailitan?",
        "golden": "Prinsip pembuktian sederhana (Pasal 8 ayat 4 UU 37/2004) berarti fakta adanya dua atau lebih kreditur dan utang yang jatuh tempo tidak dibayar harus dapat dibuktikan secara sederhana dan tidak rumit di pengadilan."
    }
]

@pytest.mark.parametrize("case", TEST_CASES)
def test_regulatory_reasoning_quality(genai_client, case):
    """
    Evaluates the Regulatory Scholar's reasoning quality by comparing 
    embeddings of its response against a 'Golden Answer'.
    """
    # 1. Get Response from Agent (using its system instruction)
    try:
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash", # Use 2.0 flash for better availability/stability
            contents=case["q"],
            config={
                "system_instruction": REGULATORY_SCHOLAR_INSTRUCTION,
                "temperature": 0.1 # Low temperature for deterministic evaluation
            }
        )
    except Exception as e:
        pytest.skip(f"Gemini API call failed (unsupported model?): {e}")
        return
        
    agent_answer = response.text
    assert agent_answer, f"Agent returned empty response for {case['name']}"

    # 2. Generate Embeddings for both answers
    try:
        embed_response = genai_client.models.embed_content(
            model="text-embedding-004", # Updated embedding model
            contents=[agent_answer, case["golden"]]
        )
    except Exception as e:
        pytest.skip(f"Gemini Embedding API call failed: {e}")
        return
    
    v_agent = embed_response.embeddings[0].values
    v_golden = embed_response.embeddings[1].values

    # 3. Calculate Semantic Similarity
    similarity = cosine_similarity(v_agent, v_golden)
    
    # Log results for debugging
    print(f"\nTest: {case['name']}")
    print(f"Similarity Score: {similarity:.4f}")
    
    # Assert similarity threshold (Target: > 0.85)
    assert similarity > 0.85, (
        f"Reasoning quality below threshold for {case['name']}.\n"
        f"Score: {similarity:.4f}\n"
        f"Agent Answer: {agent_answer[:100]}...\n"
        f"Golden Answer: {case['golden'][:100]}..."
    )
