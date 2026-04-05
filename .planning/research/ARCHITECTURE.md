# Architecture for Forensic AI Testing

**Domain:** Forensic AI & Multi-Agent Orchestration
**Researched:** 2026-04-05

## Recommended Testing Architecture

### 1. The Forensic Testing Pyramid
Instead of a simple "Unit/Integration/E2E" pyramid, KuratorMind requires a "Reasoning/Data/Human" pyramid for AI-driven forensic logic:

| Level | Goal | Method | Tools |
|-------|------|--------|-------|
| **Level 4: Human-in-the-Loop** | Ground Truth generation | Expert manual review of "uncertain" claims. | Groundlight / Custom UI |
| **Level 3: LLM-as-Judge** | Semantic Reasoning eval | Using a stronger LLM (e.g., Gemini 1.5 Pro) to grade agent logic. | Arize Phoenix / Langfuse |
| **Level 2: Constrained Model** | Logic flow validation | Forcing AI agents to return structured JSON and checking for schemas. | Zod / Pydantic / Constrained prompts |
| **Level 1: Deterministic Plumbing** | System-level E2E | Testing that SSE flows, tool calls, and API routes work mechanically. | Pytest / Playwright / Mocks |

### 2. SSE Streaming Test Adapter Pattern
To test the real-time response of the orchestrator, we use a "Buffer-and-Parse" adapter:

```python
# Conceptual Test Adapter for SSE
class SSEStreamTester:
    def __init__(self, response_stream):
        self.stream = response_stream
        self.buffer = ""
        self.events = []

    def capture_events(self):
        for line in self.stream.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith("data: "):
                    # Handle multi-line events or split JSON
                    payload = decoded_line.replace("data: ", "")
                    self.events.append(json.loads(payload))
                elif decoded_line == "event: done":
                    break
        return self.events
```

### 3. Compliance Engine Logic (UU 37/2004)
The testing engine for compliance follows Article 2 and 8 of Indonesian Bankruptcy Law:

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Creditor Counter** | Verifies unique creditor plurality (>= 2). | Claim Database |
| **Maturity Evaluator**| Compares debt due date with current date. | Financial Service |
| **Simple Proof Checker**| Asserts presence of PDF "Invoices" and "Contracts." | OCR / Vault |
| **Voting Validator** | Checks for Composition thresholds (>50% count, >67% value). | Voting Database |

## Patterns to Follow

### Pattern 1: Semantic Distance Assertion
Instead of string matching, use vector embeddings to test if the "Claim Audit Reasoning" is semantically correct.
**Example:**
```python
def test_reasoning_semantic_similarity(agent_output, ground_truth):
    similarity = calculate_cosine_similarity(
        embed(agent_output), 
        embed(ground_truth)
    )
    assert similarity > 0.85
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: "Happy Path Only" OCR Testing
**What:** Testing only with clean digital-born PDFs.
**Why bad:** Real-world Indonesian court filings are often messy scans with stamps.
**Instead:** Create a "Noise Injection" pipeline for test data (skewed pages, stamps).

## Sources

- [LangChain Eval Best Practices](https://python.langchain.com/v0.2/docs/guides/evaluation/)
- [Playwright for SSE Testing](https://playwright.dev/python/docs/api/class-request#request-all-headers)
