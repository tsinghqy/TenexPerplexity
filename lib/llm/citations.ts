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
    title: title?.trim() || hostnameAsTitle(normalizedUrl),
    snippet: snippet?.trim() || undefined,
  })
}

function hostnameAsTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function collectUrlCitationsFromUnknown(value: unknown, citations: Citation[], seenUrls: Set<string>) {
  if (!value) {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrlCitationsFromUnknown(item, citations, seenUrls)
    }
    return
  }

  if (typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  const type = record.type

  if (type === 'url_citation' || type === 'citation' || type === 'source' || type === 'url') {
    const nested =
      record.url_citation && typeof record.url_citation === 'object'
        ? (record.url_citation as Record<string, unknown>)
        : null
    const url =
      (typeof record.url === 'string' && record.url) ||
      (typeof nested?.url === 'string' && nested.url) ||
      ''
    const title =
      (typeof record.title === 'string' && record.title) ||
      (typeof nested?.title === 'string' && nested.title) ||
      undefined
    if (url) {
      addCitation(citations, seenUrls, url, title)
    }
  }

  for (const nestedValue of Object.values(record)) {
    if (nestedValue && typeof nestedValue === 'object') {
      collectUrlCitationsFromUnknown(nestedValue, citations, seenUrls)
    }
  }
}

/**
 * Extract structured url_citation annotations and web_search sources from Responses API output.
 */
export function extractCitationsFromResponsesOutput(output: unknown): Citation[] {
  const citations: Citation[] = []
  const seenUrls = new Set<string>()
  collectUrlCitationsFromUnknown(output, citations, seenUrls)
  return citations
}

/**
 * Fallback: pull markdown links and bare URLs from model text.
 */
export function extractCitationsFromMarkdown(content: string): Citation[] {
  const citations: Citation[] = []
  const seenUrls = new Set<string>()
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g

  for (const match of content.matchAll(markdownLinkPattern)) {
    addCitation(citations, seenUrls, match[2], match[1])
  }

  const bareUrlPattern = /(?<!\]\()(https?:\/\/[^\s)<>"']+)/g
  for (const match of content.matchAll(bareUrlPattern)) {
    addCitation(citations, seenUrls, match[1])
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
