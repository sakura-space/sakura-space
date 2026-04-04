"""
Configuration — loads .env and exposes typed constants.

Microsoft Agent Framework does NOT auto-load .env files, so load_dotenv()
must be called here before any os.environ access.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Azure OpenAI ──────────────────────────────────────────────────────────────
AZURE_OPENAI_ENDPOINT = os.environ["AZURE_OPENAI_ENDPOINT"]
AZURE_OPENAI_DEPLOYMENT = os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"]
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

# ── Azure AD app registration ─────────────────────────────────────────────────
AZURE_CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
AZURE_TENANT_ID = os.environ["AZURE_TENANT_ID"]
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")

# ── Microsoft Todo ────────────────────────────────────────────────────────────
AZURE_TODO_USER_ID = os.environ["AZURE_TODO_USER_ID"]
AZURE_TODO_LIST_ID = os.environ["AZURE_TODO_LIST_ID"]
