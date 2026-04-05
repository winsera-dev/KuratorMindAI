# Technology Stack: E2E Testing for Forensic AI

**Project:** KuratorMind-AI
**Researched:** 2026-04-05

## Recommended Stack

### Core Framework (Python)
| Technology | Purpose | Why |
|------------|---------|-----|
| Pytest | Main testing runner | Support for data-driven testing (fixtures, parametrize). |
| Playwright | Web E2E testing | Best-in-class for modern Next.js apps; supports network interception for SSE testing. |

### PDF & OCR Validation
| Technology | Purpose | Why |
|------------|---------|-----|
| JiWER | OCR Accuracy calculation | Industry standard for CER (Character Error Rate) and WER (Word Error Rate). |
| PyMuPDF (fitz) | PDF manipulation/reading | Fast, high-performance library for reading text and images from legal PDFs. |
| Groundlight (Optional)| Human-in-the-Loop | For manual verification of OCR "noisy" documents. |

### Financial Audit Testing
| Technology | Purpose | Why |
|------------|---------|-----|
| Pandas/NumPy | Data manipulation | Core for Benford's Law and numerical outlier detection. |
| Faker | Synthetic data generation | Generating massive sets of fake financial transactions for edge-case logic testing. |

### Entity Resolution & Linking
| Technology | Purpose | Why |
|------------|---------|-----|
| Splink | Probabilistic record linkage | Scalable, Fellegi-Sunter based library for entity resolution. |
| DuckDB | Fast analytical database | Perfect for running cross-case deduplication tests on a local machine. |
| eyecite | Legal citation parsing | Essential for normalizing and linking legal citations across documents. |

### AI Orchestration & Observability
| Technology | Purpose | Why |
|------------|---------|-----|
| Langfuse / LangSmith| LLM Observability | Essential for tracing multi-agent workflows and evaluating LLM-as-Judge. |
| OpenTelemetry | Distributed tracing | Monitoring how context passes between agents across the system. |
| Arize Phoenix | Eval benchmarks | For running semantic similarity and groundedness evaluations. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| OCR Eval | JiWER | Diffchecker API | JiWER provides quantitative metrics (CER/WER) vs visual diffs. |
| Entity Res| Splink | Zingg | Splink is easier to integrate with Python and duckDB. |
| Tracing | Langfuse | custom logs | Custom logs lack the visualization and evaluation tools needed for agents. |

## Installation

```bash
# Testing & OCR
pip install pytest playwright jiwer pymupdf

# Entity Resolution
pip install splink eyecite

# Financial/Data
pip install pandas numpy faker

# AI Observability
pip install langfuse opentelemetry-api
```

## Sources

- [JiWER Documentation](https://github.com/jitsi/jiwer)
- [Splink Documentation](https://moj-analytical-services.github.io/splink/)
- [Langfuse Documentation](https://langfuse.com/)
- [UU 37/2004 - Kepailitan dan PKPU](https://peraturan.go.id/id/uu-no-37-tahun-2004)
