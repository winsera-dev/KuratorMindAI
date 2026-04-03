"""
KuratorMind AI — Lead Orchestrator Agent

The root agent that coordinates the forensic swarm. Receives user queries,
decomposes into sub-tasks, and delegates to specialized agents via ADK.
"""

from google.adk.agents import Agent  # type: ignore
from kuratormind.tools.supabase_tools import (  # type: ignore
    search_vault_documents,
    get_document_summary,
    semantic_search,
    global_semantic_search,
    resolve_global_entity,
)

ORCHESTRATOR_INSTRUCTION = """You are the Lead Orchestrator for KuratorMind AI, a forensic workspace 
designed for Indonesian Kurators (Bankruptcy Receivers).

## Domain Context: Indonesian Insolvency Lifecycle
You MUST be aware of the 6 stages of the Indonesian insolvency process:
1. **Petition**: Initial filing.
2. **Temporary PKPU (45 days)**: First meeting, claim collection begins.
3. **Permanent PKPU (270 days)**: Intensive negotiation & verification phase.
4. **Resolution**: Homologasi (Peace) OR Bankrupt (Pailit).
5. **Bankruptcy & Liquidation**: Kurator appointed to sell assets.
6. **Termination**: Final report and closure.

## Creditor Priority Hierarchy (UU 37/2004)
When analyzing claims or financial outputs, respect this hierarchy:
1. **Preferential**: Taxes, Labor/Wages (Pekerja).
2. **Secured (Separatis)**: Mortgages (HT), Pledges (Gadai), Fiducia.
3. **Preferential General**: Legal costs, auction costs.
4. **Concurrent**: Unsecured creditors (Trade payables, etc.).

## Workflow
1. Understand the user's request and the current **Lifecycle Stage** (from metadata).
2. Search the vault using `semantic_search`.
3. **Global Intelligence**: Use `global_semantic_search` to see if similar patterns or precedents exist in other cases.
4. **Entity Resolution**: When a creditor or director is identified, ALWAYS use `resolve_global_entity` to check if they are "Repeated Bankruptors" or have "Conflicts of Interest" across cases.
5. If a conflict is found → flag it immediately as a high-severity Audit Flag.
6. **Compliance Pass**: Every conclusion must be validated by the **Regulatory Scholar** for UU 37/2004 alignment.
7. **Forensic Reporting**: Use **Output Architect** to consolidate data into a final report.
8. Present findings with citations.
"""

from kuratormind.agents.ingestor.agent import forensic_ingestor  # type: ignore
from kuratormind.agents.claim_auditor.agent import claim_auditor  # type: ignore
from kuratormind.agents.forensic_accountant.agent import forensic_accountant  # type: ignore
from kuratormind.agents.regulatory_scholar.agent import regulatory_scholar  # type: ignore
from kuratormind.agents.output_architect.agent import output_architect  # type: ignore

root_agent = Agent(
    name="lead_orchestrator",
    model="gemini-2.0-pro-exp-02-05",
    description=(
        "Lead Orchestrator for KuratorMind AI. Coordinates forensic sub-agents "
        "to help Indonesian Kurators verify claims, map debts, and generate reports."
    ),
    instruction=ORCHESTRATOR_INSTRUCTION,
    tools=[
        search_vault_documents,
        get_document_summary,
        semantic_search,
        global_semantic_search,
        resolve_global_entity,
    ],
    sub_agents=[
        forensic_ingestor, 
        claim_auditor, 
        forensic_accountant, 
        regulatory_scholar,
        output_architect
    ],
)
