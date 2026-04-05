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

def seed_users():
    print("Ensuring test users exist...")
    users = [
        {
            "id": USER_A_ID,
            "email": "test-user-a@kuratormind.ai",
            "password": "password123",
            "email_confirm": True
        },
        {
            "id": USER_B_ID,
            "email": "test-user-b@kuratormind.ai",
            "password": "password123",
            "email_confirm": True
        }
    ]
    
    for user in users:
        try:
            # Use auth.admin.create_user with service role
            supabase.auth.admin.create_user({
                "id": user["id"],
                "email": user["email"],
                "password": user["password"],
                "email_confirm": user["email_confirm"]
            })
            print(f" - Created user: {user['email']}")
        except Exception as e:
            if "already exists" in str(e).lower() or "23505" in str(e):
                print(f" - User already exists: {user['email']}")
            else:
                print(f"   Error ensuring user {user['email']}: {e}")

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
            print(f" - Deleting from {table}...")
            # Deleting all records for a clean state
            supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as e:
            print(f"   Error clearing {table}: {e}")

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
    seed_users()
    clear_data()
    seed_cases()
    print("\nSeeding complete!")

if __name__ == "__main__":
    main()
