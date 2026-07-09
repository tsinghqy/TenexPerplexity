**When to use this file**: Refer to this file when setting up the project or troubleshooting environment configuration.

## Required Environment Variables (by phase)

```env
# P1 Auth
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# P2+ LLM
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=...

# Optional
OPENAI_WEB_SEARCH_API_KEY=...
DEFAULT_MODEL_ID=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Environment Setup

- **Supabase**: Required from P1 for database and authentication
- **OpenAI / OpenRouter**: Required from P2 for LLM (and embeddings from P5)

---

**See also**: `SETUP.md` for detailed setup instructions.
