// Fixed public endpoints only: no model routes, API keys, or arbitrary URL fetching.
const TIMEOUT_MS = 8_000
const MAX_BYTES = 1_048_576
const USER_AGENT = 'SuperAgentHarnessSearch/1.1 (https://github.com/AgentsLabs/SuperAgent-Harness-Plugins)'

export function validate(query, maxResults = 5) {
  if (typeof query !== 'string' || !query.trim() || query.length > 1000) {
    throw new Error('query must contain 1–1000 characters')
  }
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) {
    throw new Error('max_results must be an integer from 1 to 20')
  }
  return { query: query.trim(), limit: maxResults }
}

export function decodeHtml(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (original, code) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()] ?? original
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : '\ufffd'
  })
}

function plain(value, limit) {
  return decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, limit)
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match ? (match[1] ?? match[2] ?? match[3]) : ''
}

function safeUrl(raw) {
  try {
    let url = new URL(decodeHtml(raw), 'https://html.duckduckgo.com')
    if ((url.hostname === 'duckduckgo.com' || url.hostname.endsWith('.duckduckgo.com')) && url.pathname === '/l/') {
      const target = url.searchParams.get('uddg')
      if (!target) return undefined
      url = new URL(target)
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined
    if (url.hostname === 'duckduckgo.com' || url.hostname.endsWith('.duckduckgo.com')) return undefined
    return url.href
  } catch { return undefined }
}

export function parseDuckDuckGo(html, limit) {
  if (/anomaly\.js|anomaly-modal|challenge-form|bots use DuckDuckGo/i.test(html)) {
    throw new Error('DuckDuckGo returned an anti-bot challenge; no challenge bypass was attempted')
  }
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter(match => attribute(match[1], 'class').split(/\s+/).includes('result__a'))
  const sources = []
  const seen = new Set()
  for (let i = 0; i < links.length; i++) {
    const match = links[i]
    const url = safeUrl(attribute(match[1], 'href'))
    if (!url || seen.has(url)) continue
    seen.add(url)
    const block = html.slice(match.index + match[0].length, links[i + 1]?.index ?? html.length)
    const snippet = block.match(/<(?:a|div|span)\b[^>]*class\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i)
    sources.push({ title: plain(match[2], 300), url, snippet: plain(snippet?.[1], 1000) })
    if (sources.length >= limit) break
  }
  if (!sources.length && !/no-results|No results found|No more results/i.test(html)) {
    throw new Error('DuckDuckGo returned an unrecognized results page')
  }
  return { sources, truncated: links.length > sources.length }
}

async function getBody(url, signal, fetchImpl) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  const response = await fetchImpl(url, {
    signal: combined,
    redirect: 'error',
    headers: { 'user-agent': USER_AGENT, accept: 'application/json,text/html;q=0.9' },
  })
  if (!response.ok || response.status === 202) {
    await response.body?.cancel()
    throw new Error(`Search endpoint returned HTTP ${response.status}`)
  }
  if (!response.body) throw new Error('Search endpoint returned an empty body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let body = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) throw new Error('Search response exceeded 1 MiB')
      body += decoder.decode(value, { stream: true })
    }
    return body + decoder.decode()
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function duckduckgo(query, limit, signal, fetchImpl) {
  const url = new URL('https://html.duckduckgo.com/html/')
  url.searchParams.set('q', query)
  return { engine: 'duckduckgo', ...parseDuckDuckGo(await getBody(url, signal, fetchImpl), limit) }
}

async function wikipedia(query, limit, signal, fetchImpl) {
  const url = new URL('https://en.wikipedia.org/w/api.php')
  url.search = new URLSearchParams({ action: 'opensearch', search: query, limit: String(limit), namespace: '0', format: 'json' })
  const data = JSON.parse(await getBody(url, signal, fetchImpl))
  if (!Array.isArray(data) || !Array.isArray(data[1]) || !Array.isArray(data[2]) || !Array.isArray(data[3])) {
    throw new Error('Wikipedia returned an invalid OpenSearch response')
  }
  const sources = []
  const seen = new Set()
  for (let i = 0; i < data[1].length && sources.length < limit; i++) {
    const url = safeUrl(data[3][i])
    if (!url || seen.has(url) || typeof data[1][i] !== 'string') continue
    seen.add(url)
    sources.push({ title: plain(data[1][i], 300), url, snippet: plain(data[2][i], 1000) })
  }
  return { engine: 'wikipedia', sources, truncated: data[1].length > limit }
}

/** Auto is an explicit, reported encyclopedia fallback, not a claim of general-web equivalence. */
export async function search({ query, engine = 'auto', maxResults = 5 }, signal, fetchImpl = globalThis.fetch) {
  const { query: clean, limit } = validate(query, maxResults)
  if (!['auto', 'duckduckgo', 'wikipedia'].includes(engine)) throw new Error('engine must be auto, duckduckgo, or wikipedia')
  signal?.throwIfAborted()
  if (engine === 'wikipedia') return { query: clean, ...await wikipedia(clean, limit, signal, fetchImpl) }
  try {
    return { query: clean, ...await duckduckgo(clean, limit, signal, fetchImpl) }
  } catch (error) {
    signal?.throwIfAborted()
    if (engine !== 'auto') throw new Error(`DuckDuckGo search unavailable: ${error.message}`)
    try {
      const result = await wikipedia(clean, limit, signal, fetchImpl)
      return { query: clean, ...result, notice: 'DuckDuckGo was unavailable. Returned Wikipedia encyclopedia matches instead; these are not general web results.' }
    } catch (fallbackError) {
      signal?.throwIfAborted()
      throw new Error(`Free search unavailable: DuckDuckGo: ${error.message}; Wikipedia: ${fallbackError.message}`)
    }
  }
}
