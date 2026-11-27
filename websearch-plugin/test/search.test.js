import test from 'node:test'
import assert from 'node:assert/strict'
import { search, parseDuckDuckGo, decodeHtml, validate } from '../search.js'
import { apply, parameters, renderResult } from '../index.js'

const html = `<div class="result"><a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fone&amp;rut=x" class="result__a">First &amp; best</a><div class="result__body"><a class="result__snippet">A <b>useful</b> snippet.</a></div></div>
<div class="result"><a class="result__a" href="https://example.org/two">Second</a><div class="result__snippet">Another result.</div></div>`
const wiki = JSON.stringify(['DeepSeek', ['DeepSeek'], [''], ['https://en.wikipedia.org/wiki/DeepSeek']])
const ok = body => new Response(body, { status: 200 })

test('standard object JSON schema exposes the query to every tool-capable model', () => {
  assert.equal(parameters.type, 'object')
  assert.deepEqual(parameters.required, ['query'])
  assert.equal(parameters.properties.query.type, 'string')
  assert.equal(parameters.properties.query.required, undefined)
})
test('DuckDuckGo parsing supports href-before-class, nested containers, entities and redirect URLs', () => {
  const parsed = parseDuckDuckGo(html, 1)
  assert.deepEqual(parsed.sources, [{ title: 'First & best', url: 'https://example.com/one', snippet: 'A useful snippet.' }])
  assert.equal(parsed.truncated, true)
})
test('rejects challenges and unrecognized pages instead of claiming no matches', () => {
  assert.throws(() => parseDuckDuckGo('<form id="challenge-form">', 3), /challenge/)
  assert.throws(() => parseDuckDuckGo('<html>broken markup</html>', 3), /unrecognized/)
  assert.equal(parseDuckDuckGo('No results found', 3).sources.length, 0)
})
test('ignores dangerous URLs and duplicate sources', () => {
  const dangerous = html + '<a class="result__a" href="javascript:alert(1)">bad</a><a class="result__a" href="https://example.com/one">duplicate</a>'
  assert.equal(parseDuckDuckGo(dangerous, 20).sources.length, 2)
  assert.equal(decodeHtml('&#99999999; &#xD800; &#x1f30e;'), '\ufffd \ufffd 🌎')
})
test('input ranges reject empty queries, long queries, coerced strings and unknown engines', async () => {
  for (const query of ['', ' ', 'q'.repeat(1001), null]) assert.throws(() => validate(query, 5))
  for (const limit of [0, 21, 1.5, '5', NaN]) assert.throws(() => validate('query', limit))
  await assert.rejects(search({ query: 'q', engine: 'bogus' }), /engine/)
})
test('auto reports Wikipedia fallback without chat-provider credentials', async () => {
  const calls = []
  const result = await search({ query: 'DeepSeek' }, undefined, async (url, options) => {
    calls.push(url.href)
    assert.equal(options.headers.authorization, undefined)
    if (url.hostname.includes('duckduckgo')) throw new Error('unreachable')
    return ok(wiki)
  })
  assert.equal(result.engine, 'wikipedia')
  assert.match(result.notice, /not general web/)
  assert.equal(result.sources[0].url, 'https://en.wikipedia.org/wiki/DeepSeek')
  assert.equal(calls.length, 2)
  assert.match(renderResult({}, result)[0].text, /untrusted data/)
})
test('explicit engine never silently falls back', async () => {
  let calls = 0
  await assert.rejects(search({ query: 'q', engine: 'duckduckgo' }, undefined, async () => {
    calls++
    return new Response('blocked', { status: 403 })
  }), /HTTP 403/)
  assert.equal(calls, 1)
})
test('pre-aborted requests do not send queries or fall back', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(search({ query: 'q' }, controller.signal, async () => assert.fail('network must not run')), { name: 'AbortError' })
})
test('response bound, malformed JSON and both-upstream failures surface as errors', async () => {
  await assert.rejects(search({ query: 'q', engine: 'wikipedia' }, undefined, async () => ok('x'.repeat(1048577))), /1 MiB/)
  await assert.rejects(search({ query: 'q', engine: 'wikipedia' }, undefined, async () => ok('{}')), /invalid OpenSearch/)
  await assert.rejects(search({ query: 'q' }, undefined, async () => { throw new Error('offline') }), /DuckDuckGo:.*Wikipedia:/)
})
test('registers model-neutral providers and disposes all resources', async () => {
  const providers = [], tools = [], cleanup = []
  apply({
    effect: callback => cleanup.push(callback()),
    web: { registerSearchProvider: p => { providers.push(p); return () => providers.splice(providers.indexOf(p), 1) } },
    tools: { register: t => { tools.push(t); return () => tools.splice(tools.indexOf(t), 1) } },
  })
  assert.deepEqual(providers.map(p => p.id), ['superagent-free', 'duckduckgo-free', 'wikipedia-opensearch'])
  for (const p of providers) {
    for (const route of ['openai', 'anthropic', 'ollama', 'deepseek-official', undefined]) assert.equal(await p.ready(route), true)
  }
  assert.deepEqual(tools[0].parameters, parameters)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => ok(wiki)
    const result = await tools[0].execute({ query: 'DeepSeek', engine: 'wikipedia' }, { signal: new AbortController().signal })
    assert.equal(result.sources.length, 1)
    const providerResult = await providers[2].search({ query: 'DeepSeek', llmProvider: 'any-custom-provider' })
    assert.deepEqual(providerResult.sources, result.sources)
  } finally { globalThis.fetch = original }
  for (const dispose of cleanup.reverse()) dispose()
  assert.equal(providers.length, 0)
  assert.equal(tools.length, 0)
})
