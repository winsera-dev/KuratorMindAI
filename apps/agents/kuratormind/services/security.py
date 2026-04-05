"""
KuratorMind AI — Forensic Security Service

Provides field-level encryption (FLE) for PII (Personally Identifiable Information)
using Fernet symmetric encryption.
"""

import os
import base64
import logging
from typing import Optional
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# Cache for the cipher suite
_cipher: Optional[Fernet] = None

def _get_cipher() -> Fernet:
    """Initialize or return the central encryption cipher."""
    global _cipher
    if _cipher is None:
        key = os.environ.get("FORENSIC_ENCRYPTION_KEY")
        if not key:
            # Fallback for dev mode only - NEVER for production
            logger.warning("FORENSIC_ENCRYPTION_KEY not set. Generating temporary key for this session.")
            key = Fernet.generate_key().decode()
        
        try:
            # Ensure key is valid base64
            _cipher = Fernet(key.encode())
        except Exception as e:
            logger.error(f"Failed to initialize encryption cipher: {e}")
            raise
            
    return _cipher

def encrypt_pii(text: str) -> str:
    """
    Encrypts a string (e.g., creditor name) into a base64 encoded ciphertext.
    
    If text is empty or None, returns it as is.
    """
    if not text:
        return text
    
    cipher = _get_cipher()
    # Fernet.encrypt returns bytes, we decode to string for JSON/DB storage
    return cipher.encrypt(text.encode()).decode()

def decrypt_pii(ciphertext: Optional[str]) -> str:
    """
    Decrypts a base64 encoded ciphertext back into plain text.
    
    If decryption fails or input is not a cipher (doesn't look like Fernet), 
    returns the original text as a fallback (useful for migration phase).
    """
    if not ciphertext or not isinstance(ciphertext, str):
        return ciphertext or ""
    
    # Heuristic: Fernet tokens are usually quite long. 
    # If it's short, it's likely plain text from before encryption was enabled.
    if len(ciphertext) < 32:
        return ciphertext

    try:
        cipher = _get_cipher()
        return cipher.decrypt(ciphertext.encode()).decode()
    except Exception:
        # Fallback to original text if it was never encrypted
        return ciphertext
