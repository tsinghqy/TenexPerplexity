export interface Citation {
  url: string
  title: string
  snippet?: string
}

function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function addCitation(
  citations: Citation[],
  seenUrls: Set<string>,
  url: string,
  title?: string,
  snippet?: string
): void {
  const normalizedUrl = normalizeUrl(url)
  if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
    return
  }

  seenUrls.add(normalizedUrl)
  citations.push({
    url: normalizedUrl,
    title: title?.trim() || normalizedUrl,
    snippet: snippet?.trim() || undefined,
  })
}

/**
 * Extract structured url_citation annotations from OpenAI Responses API output.
 */
export function extractCitationsFromResponsesOutput(output: unknown): Citation[] {
  if (!Array.isArray(output)) {
    return []
  }

  const citations: Citation[] = []
  const seenUrls = new Set<string>()

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const record = item as Record<string, unknown>
    const content = record.content
    if (!Array.isArray(content)) {
      continue
    }

    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue
      }

      const partRecord = part as Record<string, unknown>
      const annotations = partRecord.annotations
      if (!Array.isArray(annotations)) {
        continue
      }

      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== 'object') {
          continue
        }

        const annotationRecord = annotation as Record<string, unknown>
        if (annotationRecord.type !== 'url_citation') {
          continue
        }

        const nested =
          annotationRecord.url_citation && typeof annotationRecord.url_citation === 'object'
            ? (annotationRecord.url_citation as Record<string, unknown>)
            : null

        const url =
          (typeof annotationRecord.url === 'string' && annotationRecord.url) ||
          (typeof nested?.url === 'string' && nested.url) ||
          ''
        const title =
          (typeof annotationRecord.title === 'string' && annotationRecord.title) ||
          (typeof nested?.title === 'string' && nested.title) ||
          undefined

        addCitation(citations, seenUrls, url, title)
      }
    }
  }

  return citations
}

/**
 * Fallback: pull markdown links from model text when providers do not emit structured citations.
 */
export function extractCitationsFromMarkdown(content: string): Citation[] {
  const citations: Citation[] = []
  const seenUrls = new Set<string>()
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g

  for (const match of content.matchAll(markdownLinkPattern)) {
    const title = match[1]
    const url = match[2]
    addCitation(citations, seenUrls, url, title)
  }

  return citations
}

export function mergeCitations(...citationLists: Citation[][]): Citation[] {
  const merged: Citation[] = []
  const seenUrls = new Set<string>()

  for (const list of citationLists) {
    for (const citation of list) {
      addCitation(merged, seenUrls, citation.url, citation.title, citation.snippet)
    }
  }

  return merged
}
