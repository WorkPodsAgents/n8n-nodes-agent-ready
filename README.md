# Agent Ready: n8n SEO audit node

Agent Ready is a free n8n community node that runs SEO and AI search audits of any public web page, so you can build SEO automation in n8n: scheduled site checks, crawl reports and SEO alerts. It checks how Google, ChatGPT, Perplexity and AI agents read the page, and needs no account, credentials or API key.

## Installation

In n8n, open **Settings > Community Nodes**, choose **Install** and enter `@workpods/n8n-nodes-agent-ready`. See n8n's [community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Operations

| Operation | What it returns |
| --- | --- |
| SEO Audit of a Page | Indexing, title and meta description, headings, schema markup (JSON-LD), links, image alt text and AI readiness, with each problem and its evidence |
| Check AI Crawler Access | Whether GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and more may read the page |
| Check Robots.txt, Sitemaps and Llms.txt | The site's robots.txt verdicts, sitemaps, llms.txt and agent files under /.well-known |
| Check AI Agent Readiness | Labelled forms, WebMCP tools, a Markdown version and any MCP Registry listing |
| Compare With a Competitor's Page | The checks where your page and a competitor's page differ |
| Draft an Llms.txt File | A starter llms.txt built from the home page and sitemap |
| Start a Site Crawl | A background crawl of up to 50 pages; returns a `jobId` |
| Get Site Crawl Results | The crawl's status, then site-wide findings and pages with problems, ten at a time (`nextCursor` pages through) |

Every result has `summary` (one sentence), `reportUrl` (a shareable report page kept for 30 days, or `null`) and `result` (the details). The node also works as a tool for n8n's AI Agent.

A crawl takes a minute or two: start it, wait 20 to 30 seconds (a Wait node), then call Get Site Crawl Results until `result.status` is `done`.

## Privacy and limits

The checks run on the hosted [Agent Ready Website Audit](https://workpods.ai/tools/agent-ready) server at `mcp.workpods.ai`, which fetches only the public pages you enter. It records the domain and path it checked, never the query string, your IP address or the page text. See the [privacy policy](https://workpods.ai/privacy#agent-ready-mcp). Rate limits apply per caller; when one is reached the node says so in one sentence. It never signs in, submits forms or changes a site, and it does not cover rankings, keyword volumes or backlinks.

## Questions

**Do I need an API key or credentials?**
No. The node has no credentials to set up. It calls the hosted Agent Ready server at `mcp.workpods.ai`, which fetches the public page you enter and returns the findings. Rate limits apply per caller, and when one is reached the node says so in one sentence.

**Can I run a weekly SEO audit in n8n?**
Yes. Put a Schedule Trigger before the node, choose SEO Audit of a Page or Start a Site Crawl, and send the `summary` and `reportUrl` to Slack, email or a sheet. For a crawl, add a Wait node and loop on Get Site Crawl Results until `result.status` is `done`.

**Can n8n's AI Agent use it?**
Yes. The node works as a tool for n8n's AI Agent, so the agent can decide when to audit a page, check AI crawler access or draft an llms.txt while it answers a request. Each result starts with a one-sentence `summary` the agent can quote, followed by the details.

**What does it not check?**
It reads public pages only. It does not track rankings, keyword volumes or backlinks, and it never signs in, submits forms or changes a site. A site crawl covers up to 50 pages. For larger crawls, rendered-page checks and keyword data, use the Agent Ready Chrome extension.

## Compatibility

Built and tested with `@n8n/node-cli` 0.55 and n8n nodes API version 1.

## License

MIT

## By WorkPods.ai

Agent Ready is built by [WorkPods.ai](https://workpods.ai), an AI SEO agency. The same checks run in the [Agent Ready Chrome extension and CLI](https://github.com/WorkPodsAgents/agent-ready), in [VS Code](https://github.com/WorkPodsAgents/agent-ready-vscode) and in [JetBrains IDEs](https://github.com/WorkPodsAgents/agent-ready-jetbrains). Read more on the [Agent Ready website audit](https://workpods.ai/tools/agent-ready) page, or see [all free WorkPods.ai SEO tools](https://workpods.ai/tools).
