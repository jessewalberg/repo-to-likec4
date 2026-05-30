import { execFileSync, spawn } from 'node:child_process'
import type { RefineRequest, Refiner } from './refine.ts'

// The production view-refine refiner, backed by the **Claude Code CLI** (`claude -p`)
// rather than the SDK: no extra dependency, no separate ANTHROPIC_API_KEY, and it
// reuses whatever Claude auth the user already has (the skill runs where `claude`
// is installed). The shared writer instructions go via --append-system-prompt; the
// per-node facts via stdin; structured output is a JSON object we parse out of the
// CLI's result envelope. Haiku per the cost tiering.

const MODEL = 'haiku'

const SYSTEM =
  'You are a precise software-architecture technical writer documenting one code module for an ' +
  'architecture viewer. Write ONLY from the structured facts given (label, technology, path, and its ' +
  'imports / importers); do not invent APIs, behaviour, or dependencies not implied by those facts. ' +
  'Respond with ONLY a single JSON object and nothing else: ' +
  '{"summary": "<one terse line, <=90 chars, no trailing period, for the node face>", ' +
  '"description": "<short Markdown body, 2-5 sentences (optionally a short bullet list), explaining the ' +
  "module's role and how it relates to what it imports / is imported by>\"}. No code fences, no prose outside the JSON."

function renderRequest(req: RefineRequest): string {
  const lines = [
    `label: ${req.label}`,
    `kind: ${req.kind}`,
    req.technology ? `technology: ${req.technology}` : '',
    req.path ? `path: ${req.path}` : '',
    `imports (${req.imports.length}): ${req.imports.slice(0, 30).join(', ') || '(none)'}`,
    `imported by (${req.importedBy.length}): ${req.importedBy.slice(0, 30).join(', ') || '(none)'}`,
  ].filter(Boolean)
  return `Document this module as JSON.\n${lines.join('\n')}`
}

function runClaude(prompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', model, '--append-system-prompt', SYSTEM], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('claude timed out'))
    }, timeoutMs)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`claude exited ${code}: ${err.slice(0, 200)}`))
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

/** Parse {summary, description} out of model text that may include fences/prose. */
function extractJson(text: string): { summary?: string; description?: string } {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as { summary?: string; description?: string }
    } catch {
      return null
    }
  }
  return tryParse(text.trim()) ?? tryParse(text.match(/\{[\s\S]*\}/)?.[0] ?? '') ?? {}
}

export function cliRefiner(opts: { model?: string; timeoutMs?: number } = {}): Refiner {
  return async (req: RefineRequest) => {
    const stdout = await runClaude(renderRequest(req), opts.model ?? MODEL, opts.timeoutMs ?? 120_000)
    // `-p --output-format json` wraps the answer: { type:'result', result:'<text>', ... }.
    let resultText = stdout
    try {
      const env = JSON.parse(stdout) as { result?: unknown }
      if (typeof env.result === 'string') resultText = env.result
    } catch {
      /* not the envelope — treat stdout as the text */
    }
    const { summary, description } = extractJson(resultText)
    return { nodeId: req.nodeId, summary: String(summary ?? ''), description: String(description ?? '') }
  }
}

/** True if the `claude` CLI is invocable (quick availability probe for --refine). */
export function claudeCliAvailable(): boolean {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 10_000 })
    return true
  } catch {
    return false
  }
}
