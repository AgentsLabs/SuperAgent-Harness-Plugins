# SuperAgent Harness Plugins

A community catalog of practical, open plugins for DeepSeek Harness.

## Plugins

### Model web search

Adds a `model_websearch` tool and registers two free, key-free web-search providers:

- **DuckDuckGo** for general web results.
- **Wikipedia OpenSearch** for encyclopedia articles.

**Install:** In DeepSeek Harness, open **Plugins → Add plugin** and select the local `websearch-plugin` directory. For example, clone this repository with `git clone https://github.com/AgentsLabs/SuperAgent-Harness-Plugins.git`, then select its `websearch-plugin` folder. The GitHub Pages site is a catalog and documentation front end; DSH installs the actual source bundle, not the webpage. The tool accepts a search query, an optional engine (`duckduckgo` or `wikipedia`), and an optional result limit (1–20). Network access is required; upstream services may rate-limit requests.

[Plugin details](websearch-plugin/docs/DETAIL.md) · [Source](websearch-plugin/)

## Plugin catalog website

The GitHub Pages site is configured to publish from the repository's `main` branch, root folder. Once Pages is enabled in the repository settings, it will be available at:

<https://AgentsLabs.github.io/SuperAgent-Harness-Plugins/>

The site is a static HTML/CSS catalog in [`index.html`](index.html) and [`styles.css`](styles.css).

## Contributing

Contributions are welcome. Open an issue or pull request with your plugin, a short description, and installation instructions.
