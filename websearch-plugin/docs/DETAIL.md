# Model web search

Adds a `model_websearch` agent tool and registers two search providers with the Harness `web` service:

- **DuckDuckGo** for general web results via its public HTML search page.
- **Wikipedia OpenSearch** for encyclopedia article titles and summaries via its public API.

No search API key is required. The plugin sends search terms to the selected upstream service and returns up to 20 result titles, URLs, and snippets. Call the tool with `engine` set to `duckduckgo` or `wikipedia`; the default is DuckDuckGo. Internet access is required. Public endpoints can change, block automated traffic, or rate-limit requests. Search results are untrusted and linked pages are not fetched or verified by this plugin.

## Use

Ask the model to search the web, or invoke `model_websearch` with `query`, optional `engine`, and optional `max_results` (1–20). To expose an engine through other integrations using Harness's web service, select the provider ids `duckduckgo-free` or `wikipedia-opensearch`.
