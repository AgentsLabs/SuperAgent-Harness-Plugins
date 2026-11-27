# SuperAgent free search · 1.1.0

A model-independent DSH tool and three native search providers. No model route, model API key, or paid search API is used for searches. Any model that can call Harness tools can use it; model inference itself may still cost money.

## Use

Call `model_websearch` with `query`, optional `engine` (`auto`, `duckduckgo`, or `wikipedia`), and optional `max_results` (1–20). The default `auto` tries DuckDuckGo; when it is blocked or unavailable, it returns Wikipedia matches with a prominent encyclopedia-only fallback notice. Explicit engines never silently change engines.

To use the built-in `web_search` tool with any chat provider, open **Settings → Web search** and select **SuperAgent free search**. Installing the bundle alone does not replace your existing search selection. Native provider ids:

- `superagent-free`: automatic search with labelled fallback.
- `duckduckgo-free`: general-web HTML search only; fails clearly if blocked.
- `wikipedia-opensearch`: English encyclopedia title search only. OpenSearch snippets can be empty.

Each provider ignores the model's provider route and is credential-free. Changing your chat model does not change the selected search provider. Uninstalling a selected provider requires choosing a different search provider afterward.

## Installation

Use the copyable, commit-pinned Git source at https://agentslabs.github.io/SuperAgent-Harness-Plugins/ in **Plugins → Add plugin**. Alternatively clone https://github.com/AgentsLabs/SuperAgent-Harness-Plugins and add the absolute path to its `websearch-plugin` directory. Keep linked source directories in place. With the optional Custom plugin indexes feature enabled, open **Plugins → Discover → Add index source** (or **Manage index sources…**), add https://agentslabs.github.io/SuperAgent-Harness-Plugins/plugins.json, and install from the catalog.

## Limitations and privacy

DuckDuckGo is a free-to-access third-party service, not an open-source engine. Wikipedia supplies open encyclopedia content, not general-web coverage. Public endpoints may change, block automated traffic, rate-limit, or be unreachable in your region. The plugin does not bypass CAPTCHAs. Queries go to DuckDuckGo and, on automatic fallback, Wikipedia. Replies are bounded to 1 MiB; requests have deadlines and propagate cancellation. Results include source URLs but are untrusted external data, not instructions; fetch and check sources before relying on linked content. The plugin fetches no arbitrary result URLs.
