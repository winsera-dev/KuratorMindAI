import os
import sys
import json

# Add parent directory to sys.path to allow imports from tools
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from tools.supabase_tools import resolve_global_entity, _get_supabase

def verify_heryanto_overlap():
    print("🚀 Starting Cross-Case Verification for 'Heryanto'...")
    
    sb = _get_supabase()
    
    # 1. Target Cases
    vault_a = "00000000-0000-0000-0000-000000000001"
    vault_b = "0a25cb8a-9e96-4ebd-aac4-30d32c282b14"
    
    # 2. Fetch Claim IDs
    claim_a = sb.table("claims").select("id").eq("case_id", vault_a).eq("creditor_name", "Heryanto").maybe_single().execute()
    claim_b = sb.table("claims").select("id").eq("case_id", vault_b).eq("creditor_name", "Heryanto").maybe_single().execute()
    
    if not claim_a.data or not claim_b.data:
        print("❌ Error: Could not find seeded claims for Heryanto. Run the SQL seed first.")
        return

    id_a = claim_a.data["id"]
    id_b = claim_b.data["id"]
    
    print(f"✅ Found Claim A: {id_a}")
    print(f"✅ Found Claim B: {id_b}")

    # 3. Resolve for Case A
    print("\n🔗 Resolving Heryanto for Case A...")
    res_a = resolve_global_entity(
        name="Heryanto", 
        entity_type="person", 
        case_id=vault_a,
        source_id=id_a,
        source_type="claim"
    )
    print(f"Result A: {res_a}")

    # 4. Resolve for Case B (This should trigger the conflict)
    print("\n🔗 Resolving Heryanto for Case B...")
    res_b = resolve_global_entity(
        name="Heryanto", 
        entity_type="person", 
        case_id=vault_b,
        source_id=id_b,
        source_type="claim"
    )
    
    print(f"\n📊 Tool result B: {json.dumps(res_b, indent=2)}")
    
    # 5. Verify Results
    # Check occurrences
    occurrences = sb.table("entity_occurrences").select("*").eq("entity_id", res_b['entity_id']).execute()
    print(f"\n🔗 Total occurrences for Heryanto: {len(occurrences.data)}")
    for occ in occurrences.data:
        print(f"  - Case: {occ['case_id']} | Source: {occ['source_type']}")
        
    # Check audit flags for Case B
    # Note: If resolve_global_entity doesn't automatically create the flag, 
    # we should confirm if the agent is supposed to do it based on 'has_conflict'.
    # In my supabase_tools.py, I am ONLY returning 'has_conflict'.
    # THE AGENT INSTRUCTIONS FOR ORCHESTRATOR should handle the flag creation.
    
    if res_b.get("has_conflict"):
        print("\n🔥 CONFLICT DETECTED!")
    else:
        print("\n⚠️ No conflict detected. Check logic.")

if __name__ == "__main__":
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.")
        sys.exit(1)
    verify_heryanto_overlap()
