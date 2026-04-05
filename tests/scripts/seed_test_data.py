import os
import sys
import uuid
import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Add apps/agents to path if needed for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../../apps/agents'))

load_dotenv(os.path.join(os.path.dirname(__file__), '../../apps/agents/.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Deterministic UUIDs for testing
USER_A_ID = "00000000-0000-0000-0000-000000000001"
USER_B_ID = "00000000-0000-0000-0000-000000000002"

SRITEX_CASE_ID = "550e8400-e29b-41d4-a716-446655440001"
MITRA_CASE_ID = "550e8400-e29b-41d4-a716-446655440002"

def clear_data():
    print("Clearing existing test data...")
    # Clear tables in reverse dependency order
    tables = [
        "audit_flags",
        "claims",
        "chat_messages",
        "chat_sessions",
        "document_chunks",
        "case_documents",
        "agent_tasks",
        "generated_outputs",
        "financial_analyses",
        "cases"
    ]
    
    for table in tables:
        try:
            # We filter by our deterministic test cases to avoid deleting everything if not desired
            # But the plan says "reset and seed", so we'll clear all if using a test DB
            # For safety in shared environments, we can delete by case_id if we have it
            # But since it's a seed script, it's usually destructive
            print(f" - Deleting from {table}...")
            supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as e:
            print(f"   Error clearing {table}: {e}")

def seed_users():
    print("Ensuring test users exist (this may fail if not superuser, but we can proceed)...")
    # Note: supabase-py doesn't support creating auth users easily with service role
    # unless using auth.admin.create_user.
    # For local tests, we assume these users exist or we just use their IDs for cases
    pass

def seed_cases():
    print("Seeding cases...")
    
    cases = [
        {
            "id": SRITEX_CASE_ID,
            "user_id": USER_A_ID,
            "name": "Sritex Bankruptcy Case",
            "debtor_entity": "PT Sri Rejeki Isman Tbk",
            "case_number": "PU-001/SRITEX/2025",
            "court_name": "Pengadilan Niaga Semarang",
            "bankruptcy_date": "2025-01-15",
            "stage": "pkpu_temp",
            "status": "active"
        },
        {
            "id": MITRA_CASE_ID,
            "user_id": USER_A_ID,
            "name": "Mitralanggeng Construction Audit",
            "debtor_entity": "PT Mitralanggeng Jaya Konstruksi",
            "case_number": "PU-042/MITRA/2024",
            "court_name": "Pengadilan Niaga Jakarta Pusat",
            "bankruptcy_date": "2024-11-20",
            "stage": "pkpu_permanent",
            "status": "active"
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": USER_B_ID,
            "name": "Private Isolation Case",
            "debtor_entity": "Secret Entity",
            "case_number": "SECRET-007",
            "court_name": "Unknown Court",
            "status": "active"
        }
    ]
    
    for case in cases:
        try:
            supabase.table("cases").upsert(case).execute()
            print(f" - Seeded case: {case['name']}")
        except Exception as e:
            print(f"   Error seeding case {case['name']}: {e}")

def main():
    clear_data()
    seed_cases()
    print("\nSeeding complete!")

if __name__ == "__main__":
    main()
