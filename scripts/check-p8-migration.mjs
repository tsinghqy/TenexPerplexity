// Diagnostic: is supabase/migrations/p8_research.sql applied?
// Reads .env.local locally and prints only PASS/FAIL per check (no secrets).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of envFile.split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match) {
    env[match[1]] = match[2].trim()
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.log('SKIP: missing Supabase env values')
  process.exit(0)
}

async function check(name, path) {
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (response.ok) {
      console.log(`PASS: ${name}`)
      return true
    }
    const body = await response.text()
    console.log(`FAIL: ${name} (${response.status}) ${body.slice(0, 140)}`)
    return false
  } catch (error) {
    console.log(`FAIL: ${name} (${error.message})`)
    return false
  }
}

const results = await Promise.all([
  check('chats.research_run_id column', 'chats?select=research_run_id&limit=1'),
  check('chats.confidence column', 'chats?select=confidence&limit=1'),
  check('node_claims table', 'node_claims?select=id&limit=1'),
  check('research_runs table', 'research_runs?select=id&limit=1'),
])

console.log(
  results.every(Boolean)
    ? '\np8_research.sql IS applied.'
    : '\np8_research.sql is NOT fully applied — run it in the Supabase SQL Editor.'
)
