from slowapi import Limiter
from slowapi.util import get_remote_address

# T-23: Tiered Rate Limiting System
# Protects expensive forensic compute (Gemini) and prevents ingestion spoliation attempts.
limiter = Limiter(
    key_func=get_remote_address, 
    default_limits=["100/minute"], # General API threshold
    headers_enabled=True
)

# Explicit tiers for the KuratorMind forensic environment
LIMIT_CHAT = "10/minute"
LIMIT_INGESTION = "5/minute"
LIMIT_SEARCH = "15/minute"
