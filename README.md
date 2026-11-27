# SuperAgent Harness Plugins

A public plugin provider and index for DeepSeek Harness (DSH).

**Catalog:** <https://agentslabs.github.io/SuperAgent-Harness-Plugins/>

**Plugin index:** <https://agentslabs.github.io/SuperAgent-Harness-Plugins/plugins.json>

## SuperAgent free search · v1.1.0

Model-independent, no-key search: select **SuperAgent free search** in **Settings → Web search** and use it with any configured model that supports tools. It is not tied to DeepSeek model credentials. Model inference charges, if any, are separate from search.

- DuckDuckGo supplies general web results; it is a third-party service, not an open-source search engine.
- Wikipedia fallback is encyclopedia-only and cannot replace general web coverage.
- Public endpoints can block or rate-limit requests. No search API key does not mean guaranteed availability.
- Queries are sent to the upstream services used. Search results are untrusted; fetch and verify sources before relying on them.

[Plugin details](websearch-plugin/docs/DETAIL.md) · [Plugin source](websearch-plugin/)

## Install by pasting a source

1. Open **Plugins → Add plugin** in DSH.
2. Paste this pinned source into the **source input**, then install and enable the bundle:

```text
git+https://github.com/AgentsLabs/SuperAgent-Harness-Plugins.git#1b5a40a32faa4425812cd091ec3acc4fdfcef9a3&path:/websearch-plugin
```

3. Open **Settings → Web search** and select **SuperAgent free search** as the search provider.
4. Start a new chat with a model that supports tools and ask it to search.

The source installs the plugin subdirectory at a release commit. The catalog page is not itself an installable bundle, and its buttons only copy values or link to instructions; there is no fake one-click install protocol. Review source code before installing a plugin into your profile.

### CLI users

If you already have the `dsh` CLI available:

```sh
dsh plugin --profile desktop add 'git+https://github.com/AgentsLabs/SuperAgent-Harness-Plugins.git#1b5a40a32faa4425812cd091ec3acc4fdfcef9a3&path:/websearch-plugin'
```

The Desktop application does not necessarily install `dsh` on your PATH. Use the GUI route if the command is unavailable. Substitute your intended profile for `desktop` when necessary; installation affects that entire profile. Then select the provider in **Settings → Web search**.

### Local source checkout

```sh
git clone https://github.com/AgentsLabs/SuperAgent-Harness-Plugins.git
```

In **Plugins → Add plugin**, use the absolute path to the cloned `websearch-plugin` folder. Keep the folder in place because local installation may link to it. Then choose **SuperAgent free search** under **Settings → Web search**.

## Optional: browse in Discover

On DSH versions offering the optional **Custom plugin indexes** feature:

1. Enable **Custom plugin indexes** in **Plugins**.
2. Open **Plugins → Discover → Add index source** and paste this URL. If sources already exist, open the index menu’s **Manage index sources…** option:

```text
https://agentslabs.github.io/SuperAgent-Harness-Plugins/plugins.json
```

3. In **Discover**, find **SuperAgent free search**, inspect its details, and install it.
4. Select **SuperAgent free search** in **Settings → Web search**.

Adding an index alone does not install its plugins or change the active search provider. If your DSH version does not offer Discover, use the source input or local folder installation instead.

## Website

GitHub Pages publishes the repository root from `main`. The static catalog uses [`index.html`](index.html), [`styles.css`](styles.css), and [`site.js`](site.js). Copy buttons report success accessibly; if clipboard access is unavailable, they select the text for manual copying. The values remain selectable with JavaScript disabled.

## Contributing

Open an issue or pull request with your plugin, its source, a short description, supported DSH versions, and installation instructions.
