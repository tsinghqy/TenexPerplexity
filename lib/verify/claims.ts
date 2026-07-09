/**
 * Deterministic claim segmentation.
 *
 * Splits an assistant answer into sentence-level claims with exact character
 * offsets into the persisted content. Offsets are computed here (not by an
 * LLM) so highlight spans always line up with the stored text.
 */

export interface ClaimSpan {
  text: string
  startOffset: number
  endOffset: number
}

/** Claims shorter than this are ignored (fragments, list markers, etc.). */
export const CLAIM_MIN_LENGTH = 25

/** Upper bound on claims per message to keep verification prompts bounded. */
export const CLAIM_MAX_COUNT = 30

const SENTENCE_BOUNDARY = /[.!?]+["')\]”’]*(?:\s+|$)/g

/**
 * Locate the appended "Sources:" footer (added at persist time) so claims are
 * only extracted from the answer body.
 */
export function findSourcesFooterStart(content: string): number {
  const match = /(?:^|\n)\s*Sources:\s*(?:\n|$)/i.exec(content)
  return match ? match.index : content.length
}

function isSkippableLine(trimmed: string): boolean {
  if (!trimmed) {
    return true
  }
  // Markdown headers, horizontal rules, table rows, code fences.
  if (/^(#{1,6}\s|---+\s*$|\|.*\||```)/.test(trimmed)) {
    return true
  }
  // Lines that are only a link or a numbered/bulleted link (source lists).
  if (/^(?:[-*+]|\d+[.)])?\s*\[[^\]]+\]\(https?:\/\/[^)]+\)\s*$/.test(trimmed)) {
    return true
  }
  if (/^https?:\/\/\S+$/.test(trimmed)) {
    return true
  }
  return false
}

function stripListMarker(line: string): { text: string; offsetDelta: number } {
  const match = /^(\s*(?:[-*+]|\d+[.)])\s+)/.exec(line)
  if (!match) {
    return { text: line, offsetDelta: 0 }
  }
  return { text: line.slice(match[1].length), offsetDelta: match[1].length }
}

function pushTrimmedSpan(
  spans: ClaimSpan[],
  raw: string,
  rawStart: number
): void {
  const leading = raw.length - raw.trimStart().length
  const text = raw.trim()
  if (text.length < CLAIM_MIN_LENGTH || !/[a-zA-Z]/.test(text)) {
    return
  }
  const startOffset = rawStart + leading
  spans.push({ text, startOffset, endOffset: startOffset + text.length })
}

function splitLineIntoSentences(line: string, lineStart: number, spans: ClaimSpan[]): void {
  SENTENCE_BOUNDARY.lastIndex = 0
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = SENTENCE_BOUNDARY.exec(line))) {
    const end = match.index + match[0].length
    pushTrimmedSpan(spans, line.slice(cursor, end), lineStart + cursor)
    cursor = end
  }

  if (cursor < line.length) {
    pushTrimmedSpan(spans, line.slice(cursor), lineStart + cursor)
  }
}

/**
 * Extract verifiable claim spans from answer content.
 * Skips the Sources footer, headers, code fences, and link-only lines.
 */
export function segmentClaims(content: string): ClaimSpan[] {
  const bodyEnd = findSourcesFooterStart(content)
  const body = content.slice(0, bodyEnd)
  const spans: ClaimSpan[] = []

  let lineStart = 0
  let insideCodeFence = false

  for (const line of body.split('\n')) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      insideCodeFence = !insideCodeFence
    } else if (!insideCodeFence && !isSkippableLine(trimmed)) {
      const { text, offsetDelta } = stripListMarker(line)
      splitLineIntoSentences(text, lineStart + offsetDelta, spans)
    }

    lineStart += line.length + 1
    if (spans.length >= CLAIM_MAX_COUNT) {
      break
    }
  }

  return spans.slice(0, CLAIM_MAX_COUNT)
}
