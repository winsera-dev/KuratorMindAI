import requests
import json
import os
import sys
import uuid
import time

BASE_URL = "http://localhost:8000/api/v1"
VALID_USER_ID = "d1122f85-142f-411b-879f-7d15998f3304"

def get_supabase():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

def test_step_1_create_case():
    print("Step 1: Creating Case...")
    payload = {
        "name": "UAT Case - PT Maju Mundur",
        "description": "UAT Testing for Core Forensic Workflow",
        "debtor_entity": "PT Maju Mundur",
        "case_number": "123/Pdt.Sus-PKPU/2024/PN Niaga Jkt.Pst",
        "court_name": "PN Niaga Jkt.Pst",
        "stage": "pkpu_temp",
        "user_id": VALID_USER_ID
    }
    
    try:
        response = requests.post(f"{BASE_URL}/cases", json=payload)
        if response.status_code == 200:
            case = response.json()
            print(f"SUCCESS: Case created: {case['id']}")
            return case['id']
        elif response.status_code == 409:
            print("WARNING: Case already exists, fetching existing one...")
            list_res = requests.get(f"{BASE_URL}/cases")
            cases = list_res.json().get("cases", [])
            for c in cases:
                if c["case_number"] == payload["case_number"]:
                    print(f"SUCCESS: Found existing case: {c['id']}")
                    return c['id']
        
        print(f"ERROR: Failed to create case: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"ERROR: Exception occurred during case creation: {e}")
    return None

def test_step_2_mock_ingestion(case_id):
    print(f"Step 2: Mocking Document Ingestion for case {case_id}...")
    sb = get_supabase()
    
    doc_id = str(uuid.uuid4())
    doc_record = {
        "id": doc_id,
        "case_id": case_id,
        "file_name": "Claim_Letter_PT_ABC.pdf",
        "file_type": "application/pdf",
        "file_path": f"{case_id}/{doc_id}/Claim_Letter_PT_ABC.pdf",
        "file_size": 1024,
        "status": "ready",
        "summary": "Mocked claim letter from PT ABC stating debt of 5 billion IDR.",
        "metadata": {"is_mock": True}
    }
    
    try:
        # 1. Insert document record
        sb.table("case_documents").insert(doc_record).execute()
        
        # 2. Insert mock chunks with dummy embeddings
        mock_embedding = [0.1] * 768
        chunk_record = {
            "id": str(uuid.uuid4()),
            "document_id": doc_id,
            "case_id": case_id,
            "content": "PT ABC holds a secured claim of IDR 5,000,000,000 against PT Maju Mundur based on loan agreement No. 456/2023.",
            "chunk_index": 0,
            "page_number": 1,
            "embedding": mock_embedding,
            "metadata": {"is_mock": True}
        }
        sb.table("document_chunks").insert(chunk_record).execute()
        
        print(f"SUCCESS: Mock document and chunks created: {doc_id}")
        return doc_id
    except Exception as e:
        print(f"ERROR: Exception during mock ingestion: {e}")
        return None

def test_step_3_agent_verification(case_id, doc_id):
    print(f"Step 3: Triggering Agent Verification for case {case_id}...")
    sb = get_supabase()
    
    # We manually insert a claim and a flag to simulate agent output
    try:
        # Mock Claim
        claim_data = {
            "case_id": case_id,
            "creditor_name": "PT ABC",
            "claim_amount": 5000000000,
            "claim_type": "secured",
            "status": "pending",
            "metadata": {"source_document_id": doc_id}
        }
        sb.table("claims").insert(claim_data).execute()
        
        # Mock Audit Flag
        flag_data = {
            "case_id": case_id,
            "severity": "high",
            "flag_type": "contradiction",
            "title": "Amount Mismatch",
            "description": "Claim letter states 5B but debtor ledger shows 4.5B.",
            "evidence": [{"source_document_id": doc_id, "page": 1, "excerpt": "IDR 5,000,000,000"}],
            "resolved": False
        }
        sb.table("audit_flags").insert(flag_data).execute()
        
        print("SUCCESS: Mock claim and audit flag created.")
        return True
    except Exception as e:
        print(f"ERROR: Exception during agent verification: {e}")
        return False

def test_step_4_generate_report(case_id):
    print(f"Step 4: Testing Report Generation for case {case_id}...")
    # Testing the chat endpoint with agent_override="output_architect"
    payload = {
        "case_id": case_id,
        "message": "Generate a forensic audit report for this case.",
        "agent_override": "output_architect"
    }
    
    try:
        # Use sync endpoint for UAT script
        response = requests.post(f"{BASE_URL}/chat/sync", json=payload)
        if response.status_code == 200:
            print("SUCCESS: Report generation triggered successfully.")
            content = response.json().get('content', '')
            print(f"Agent response snippet: {content[:100]}...")
            return True
        else:
            print(f"ERROR: Report generation failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"ERROR: Exception during report generation: {e}")
        return False

if __name__ == "__main__":
    # Ensure uvicorn is running or this will fail
    case_id = test_step_1_create_case()
    if not case_id: sys.exit(1)
    
    doc_id = test_step_2_mock_ingestion(case_id)
    if not doc_id: sys.exit(1)
    
    if not test_step_3_agent_verification(case_id, doc_id): sys.exit(1)
    
    if not test_step_4_generate_report(case_id): sys.exit(1)
    
    print("\n\nUAT MAIN SCENARIO COMPLETED SUCCESSFULLY!")
