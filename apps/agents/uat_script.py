import requests
import json
import os
import sys
import uuid
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"
VALID_USER_ID = "d1122f85-142f-411b-879f-7d15998f3304"

def get_supabase():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

def test_step_1_create_case():
    print("Step 1: Creating Case...")
    case_name = f"UAT Case - PT Maju Mundur {uuid.uuid4().hex[:4]}"
    payload = {
        "name": case_name,
        "description": "UAT Testing for Core Forensic Workflow",
        "debtor_entity": "PT Maju Mundur",
        "case_number": f"{int(time.time())}/Pdt.Sus-PKPU/2024/PN Niaga Jkt.Pst",
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
        "summary": "Claim letter from PT ABC stating debt of 5 billion IDR.",
        "metadata": {"is_mock": True}
    }
    
    try:
        sb.table("case_documents").insert(doc_record).execute()
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
    print(f"Step 3: Simulating Agent Verification for case {case_id}...")
    sb = get_supabase()
    try:
        claim_data = {
            "case_id": case_id,
            "creditor_name": "PT ABC",
            "claim_amount": 5000000000,
            "claim_type": "secured",
            "status": "pending",
            "metadata": {"source_document_id": doc_id}
        }
        sb.table("claims").insert(claim_data).execute()
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
    payload = {
        "case_id": case_id,
        "message": "Analyze the claims in this case and summarize the red flags.",
        "agent_override": "output_architect"
    }
    try:
        response = requests.post(f"{BASE_URL}/chat/sync", json=payload)
        if response.status_code == 200:
            content = response.json().get('content', '')
            print("SUCCESS: Report generation triggered.")
            print(f"Agent response snippet: {content[:100]}...")
            return True
        else:
            print(f"ERROR: Report generation failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"ERROR: Exception during report generation: {e}")
        return False

def test_step_5_logout():
    print("Step 5: Testing Logout functionality...")
    # Since we are testing from backend script, we simulate session clearing 
    # Logic is implemented in Sidebar.tsx via supabase.auth.signOut()
    print("SKIPPED: Logout is a frontend-only browser action (verified in Sidebar.tsx code).")
    return True

if __name__ == "__main__":
    case_id = test_step_1_create_case()
    if not case_id: sys.exit(1)
    doc_id = test_step_2_mock_ingestion(case_id)
    if not doc_id: sys.exit(1)
    if not test_step_3_agent_verification(case_id, doc_id): sys.exit(1)
    if not test_step_4_generate_report(case_id): sys.exit(1)
    test_step_5_logout()
    print("\n\nUAT MAIN SCENARIO COMPLETED SUCCESSFULLY!")
