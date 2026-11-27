import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'model-websearch'
export const inject = ['tools', 'web']

const MAX_LIMIT = 20
const TIMEOUT_MS = 12_000
const USER_AGENT = 'DeepSeekHarnessModelWebSearch/1.0 (free web search plugin)'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
}

function stripTags(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim()
}

function normalizeUrl(raw) {
  const url = new URL(decodeHtml(raw), 'https://html.duckduckgo.com')
  if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') {
    const target = url.searchParams.get('uddg')
    if (target) return target
  }
  return url.href
}

async function request(url, signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  const response = await fetch(url, {
    signal: combined,
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
  })
  if (!response.ok) throw new Error(`Search endpoint returned HTTP ${response.status}`)
  return response
}

async function searchDuckDuckGo(query, maxResults, signal) {
  const endpoint = new URL('https://html.duckduckgo.com/html/')
  endpoint.searchParams.set('q', query)
  const html = await (await request(endpoint, signal)).text()
  const results = []
  const resultPattern = /<div\b(?=[^>]*\bclass=["'][^"']*\bresult\b)[^>]*>([\s\S]*?)(?=<div\b(?=[^>]*\bclass=["'][^"']*\bresult\b)|$)/gi
  for (const match of html.matchAll(resultPattern)) {
    const block = match[1]
    const link = block.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b)[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!link) continue
    let url
    try { url = normalizeUrl(link[1]) } catch { continue }
    if (!/^https?:\/\//i.test(url)) continue
    const snippet = block.match(/<a\b(?=[^>]*\bclass=["'][^"']*\bresult__snippet\b)[^>]*>([\s\S]*?)<\/a>|<div\b(?=[^>]*\bclass=["'][^"']*\bresult__snippet\b)[^>]*>([\s\S]*?)<\/div>/i)
    results.push({
      title: stripTags(link[2]),
      url,
      snippet: stripTags(snippet?.[1] ?? snippet?.[2] ?? ''),
    })
    if (results.length >= maxResults) break
  }
  return results
}

async function searchWikipedia(query, maxResults, signal) {
  const endpoint = new URL('https://en.wikipedia.org/w/api.php')
  endpoint.searchParams.set('action', 'opensearch')
  endpoint.searchParams.set('search', query)
  endpoint.searchParams.set('limit', String(maxResults))
  endpoint.searchParams.set('namespace', '0')
  endpoint.searchParams.set('format', 'json')
  const data = await (await request(endpoint, signal)).json()
  if (!Array.isArray(data) || !Array.isArray(data[1]) || !Array.isArray(data[3])) {
    throw new Error('Wikipedia returned an unexpected OpenSearch response')
  }
  return data[1].slice(0, maxResults).flatMap((title, index) => {
    const url = data[3][index]
    if (typeof url !== 'string' || !url.startsWith('https://')) return []
    return [{ title, url, snippet: data[2]?.[index] ?? '' }]
  })
}

function validate(query, maxResults) {
  const clean = text(query)
  if (!clean) throw new Error('query must not be empty')
  const limit = Number(maxResults ?? 5)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`max_results must be an integer from 1 to ${MAX_LIMIT}`)
  }
  return { query: clean, limit }
}

export function apply(ctx) {
  ctx.web.registerSearchProvider({
    id: 'duckduckgo-free',
    title: 'DuckDuckGo (free HTML search)',
    description: { en: 'Searches DuckDuckGo HTML results without an API key.' },
    available: () => true,
    async search(request, signal) {
      const { query, limit } = validate(request.query, request.maxResults)
      try {
        return { sources: await searchDuckDuckGo(query, limit, signal), truncated: false }
      } catch (error) {
        if (signal?.aborted) throw error
        throw new Error(`DuckDuckGo search failed: ${error.message}`)
      }
    },
  })

  ctx.web.registerSearchProvider({
    id: 'wikipedia-opensearch',
    title: 'Wikipedia OpenSearch',
    description: { en: 'Searches Wikipedia article titles and summaries using its open, key-free API.' },
    available: () => true,
    async search(request, signal) {
      const { query, limit } = validate(request.query, request.maxResults)
      try {
        return { sources: await searchWikipedia(query, limit, signal), truncated: false }
      } catch (error) {
        if (signal?.aborted) throw error
        throw new Error(`Wikipedia search failed: ${error.message}`)
      }
    },
  })

  ctx.tools.register(defineTool({
    name: 'model_websearch',
    description: 'Search the public web with a free, no-API-key search engine. Choose DuckDuckGo for general web results or Wikipedia for encyclopedia articles. Returns source URLs and snippets; results can be untrusted. Does not fetch or verify the linked pages.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search terms or a natural-language question.' },
      engine: { type: 'string', enum: ['duckduckgo', 'wikipedia'], description: 'Search engine to use. Default: duckduckgo.' },
      max_results: { type: 'integer', description: `Maximum sources to return, from 1 to ${MAX_LIMIT}. Default: 5.` },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          engine: { type: 'string', required: true },
          query: { type: 'string', required: true },
          sources: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                title: { type: 'string' },
                url: { type: 'string', required: true },
                snippet: { type: 'string' },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.sources.length
          ? `${value.sources.length} ${value.engine} sources for “${value.query}”:\n${value.sources.map((source, i) => `${i + 1}. ${source.title || source.url}\n   ${source.url}${source.snippet ? `\n   ${source.snippet}` : ''}`).join('\n')}`
          : `No results found using ${value.engine} for “${value.query}”.`,
      }],
    },
    async execute(args, exec) {
      const { query, limit } = validate(args.query, args.max_results)
      const engine = args.engine ?? 'duckduckgo'
      const sources = engine === 'wikipedia'
        ? await searchWikipedia(query, limit, exec.signal)
        : engine === 'duckduckgo'
          ? await searchDuckDuckGo(query, limit, exec.signal)
          : (() => { throw new Error('engine must be duckduckgo or wikipedia') })()
      return { engine, query, sources, truncated: false }
    },
  }))
}
