"""
KuratorMind AI — Forensic Migration Script (PII Encryption)

Encrypts existing plain-text PII in the database into Fernet ciphertexts.
Fields:
- claims.creditor_name
- claims.creditor_aliases
- cases.debtor_entity
"""

import os
import sys
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

# Add apps/agents to path to import our security service
sys.path.append(os.path.join(os.getcwd(), "apps", "agents"))

from kuratormind.services.security import encrypt_pii, decrypt_pii

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

def run_migration():
    if not os.path.exists(".env"):
        logger.error(".env file not found. Run this from the project root.")
        return

    load_dotenv()
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    sb: Client = create_client(url, key)
    
    # 1. Migrate Cases (debtor_entity)
    logger.info("Starting Case migration (debtor_entity)...")
    cases = sb.table("cases").select("id, debtor_entity").execute()
    cases_updated = 0
    for case in (cases.data or []):
        debtor = case.get("debtor_entity")
        if debtor and not debtor.startswith("gAAAA"): # Fernet tokens usually start with this
            encrypted = encrypt_pii(debtor)
            sb.table("cases").update({"debtor_entity": encrypted}).eq("id", case["id"]).execute()
            cases_updated += 1
    logger.info(f"Updated {cases_updated} cases.")

    # 2. Migrate Claims (creditor_name, creditor_aliases)
    logger.info("Starting Claims migration (creditor_name, creditor_aliases)...")
    claims = sb.table("claims").select("id, creditor_name, creditor_aliases").execute()
    claims_updated = 0
    for claim in (claims.data or []):
        updates = {}
        
        name = claim.get("creditor_name")
        if name and not name.startswith("gAAAA"):
            updates["creditor_name"] = encrypt_pii(name)
            
        aliases = claim.get("creditor_aliases") or []
        if aliases and any(not a.startswith("gAAAA") for a in aliases):
            updates["creditor_aliases"] = [encrypt_pii(a) if not a.startswith("gAAAA") else a for a in aliases]
            
        if updates:
            sb.table("claims").update(updates).eq("id", claim["id"]).execute()
            claims_updated += 1
            
    logger.info(f"Updated {claims_updated} claims.")
    logger.info("Migration Completed Successfully.")

if __name__ == "__main__":
    run_migration()
