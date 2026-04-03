"""
KuratorMind AI — Output Architect Agent

Specialized ADK agent responsible for synthesizing data from all forensic 
sub-agents into a final, structured Forensic Audit Report for the Kurator.
"""

from google.adk.agents import Agent # type: ignore
from kuratormind.tools.supabase_tools import ( # type: ignore
    get_vault_consolidated_findings,
    create_audit_flag,
    save_generated_output
)

OUTPUT_ARCHITECT_INSTRUCTION = """You are the **Output Architect** of the KuratorMind AI Swarm. 
Your goal is to transform complex forensic findings into standardized Audit Reports.

## Your Mission
Generate a structured, professional, and thorough **Laporan Audit Forensik** for the Kurator. 
Your report must be grounded in Indonesian Law (UU 37/2004) and PSAK standards.

## Report Structure
1. **Executive Summary**: High-level status of the debtor (Solvency, Red Flags).
2. **Financial Analysis**:
   - Key Ratios (Solvency, Liquidity).
   - Analysis of assets vs liabilities.
3. **Creditor & Claims Summary**:
   - Distribution of Secured, Preferential, and Concurrent debts.
   - Identified contradictions in creditor claims.
4. **Forensic Audit Findings**:
   - Critical Red Flags (e.g. Actio Pauliana risks).
   - Accounting anomalies.
5. **Kurator's Action Plan**: Suggested next steps for document verification or legal challenge.

## Working Principles
- **Conciseness**: Avoid fluff. Every paragraph should expose a legal or financial fact.
- **Tone**: Professional, authoritative, and forensic.
- **Markdown Excellence**: Use tables, bold headers, and lists for maximum readability.
- **Grounding**: Always reference the 'Regulatory Scholar' for legal citations if those are missing from the input findings.

## Workflow
1. Use `get_vault_consolidated_findings` to pull all raw data for the vault.
2. Format the data into the structure above.
3. If findings highlight a specific legal risk (like hidden assets), explicitly reference the relevant Pasal from UU 37/2004.
4. **CRITICAL**: Once the report content is ready, you MUST call the `generate_and_save_report` tool with the `vault_id`, `title`, `output_type`, and the full `markdown_content` to persist it to the database and storage.
"""

def generate_and_save_report(
    vault_id: str, 
    title: str, 
    output_type: str, 
    markdown_content: str
) -> dict:
    """Generates a professional PDF and saves the report to the database.
    
    Args:
        vault_id: UUID of the vault.
        title: Title of the report.
        output_type: 'judge_report', 'creditor_list', 'forensic_summary'.
        markdown_content: The full markdown body of the report.
    """
    import os
    import uuid
    import logging
    from kuratormind.services.reporting import generate_forensic_pdf # type: ignore
    from supabase import create_client # type: ignore

    # Memory Safety: Truncate extremely large content to avoid OOM in fpdf
    # 500k characters is roughly 100-200 pages, enough for a forensic report
    MAX_CHARS = 500_000
    if len(markdown_content) > MAX_CHARS:
        logging.warning(f"Truncating report content from {len(markdown_content)} to {MAX_CHARS}")
        markdown_content = markdown_content[:MAX_CHARS] + "\n\n... [Content Truncated for Size] ..."

    try:
        logging.info(f"Starting report generation: {title} for vault {vault_id}")
        # 1. Generate local PDF
        report_id = str(uuid.uuid4())
        tmp_path = f"/tmp/{report_id}.pdf"
        generate_forensic_pdf(title, markdown_content, tmp_path)
        
        # 2. Upload to Supabase Storage
        logging.info(f"Uploading report {report_id} to storage...")
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
             return {"error": "Missing Supabase credentials in environment"}

        sb = create_client(url, key)
        
        storage_path = f"outputs/{vault_id}/{report_id}.pdf"
        with open(tmp_path, "rb") as f:
            sb.storage.from_("vault-files").upload(
                path=storage_path,
                file=f.read(),
                file_options={"content-type": "application/pdf"}
            )
            
        # 3. Save record to DB
        logging.info(f"Saving report record to database...")
        res = save_generated_output(
            vault_id=vault_id,
            title=title,
            output_type=output_type,
            content=markdown_content,
            file_path=storage_path,
            metadata={"report_id": report_id}
        )
        
        # Cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            
        logging.info(f"Report generation successful: {storage_path}")
        return {
            "success": True, 
            "message": f"Report '{title}' generated and saved successfully.",
            "output_id": res.get("id"), 
            "file_path": storage_path
        }
    except Exception as e:
        logging.error(f"Failed to generate report: {e}", exc_info=True)
        return {"error": str(e)}

output_architect = Agent(
    name="output_architect",
    model="models/gemini-flash-latest",
    description=(
        "Specializes in report generation and forensic synthesis. "
        "Consolidates findings from all agents into a final Audit Report."
    ),
    instruction=OUTPUT_ARCHITECT_INSTRUCTION,
    tools=[
        get_vault_consolidated_findings,
        create_audit_flag,
        generate_and_save_report
    ],
)
