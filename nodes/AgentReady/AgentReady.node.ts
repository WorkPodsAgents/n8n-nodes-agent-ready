import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { CheckRefused, McpSession } from './McpSession';

const VERSION = '0.1.0';

/** Each operation and the Agent Ready Website Audit tool it runs. */
const TOOLS: Record<string, string> = {
	auditPage: 'seo_audit_page',
	checkAiCrawlerAccess: 'check_ai_crawler_access',
	checkSiteFiles: 'check_robots_sitemap_llms_txt',
	checkAgentReadiness: 'check_agent_readiness',
	compareWithCompetitor: 'compare_with_competitor_page',
	draftLlmsTxt: 'draft_llms_txt',
	startSiteCrawl: 'start_site_crawl',
	getSiteCrawl: 'get_site_crawl',
};

const URL_OPERATIONS = Object.keys(TOOLS).filter((operation) => operation !== 'getSiteCrawl');

const show = (...operation: string[]) => ({ show: { operation } });

const properties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Check AI Agent Readiness',
				value: 'checkAgentReadiness',
				description:
					'Check whether AI agents can use a page: labelled forms, WebMCP tools, a Markdown version and an MCP Registry listing',
				action: 'Check AI agent readiness',
			},
			{
				name: 'Check AI Crawler Access',
				value: 'checkAiCrawlerAccess',
				description:
					'Check whether AI crawlers such as GPTBot, ClaudeBot and PerplexityBot may read a page',
				action: 'Check AI crawler access',
			},
			{
				name: 'Check Robots.txt, Sitemaps and Llms.txt',
				value: 'checkSiteFiles',
				description:
					"Read a site's robots.txt, sitemaps, llms.txt and agent files under /.well-known",
				action: 'Check robots txt sitemaps and llms txt',
			},
			{
				name: "Compare With a Competitor's Page",
				value: 'compareWithCompetitor',
				description: "Run the SEO audit on your page and a competitor's page and list where they differ",
				action: 'Compare with a competitor page',
			},
			{
				name: 'Draft an Llms.txt File',
				value: 'draftLlmsTxt',
				description: "Draft a starter llms.txt from the site's home page and sitemap",
				action: 'Draft an llms txt file',
			},
			{
				name: 'Get Site Crawl Results',
				value: 'getSiteCrawl',
				description: 'Read a crawl started by Start a Site Crawl, ten pages at a time',
				action: 'Get site crawl results',
			},
			{
				name: 'SEO Audit of a Page',
				value: 'auditPage',
				description:
					'Audit one page for SEO and AI search: indexing, title and description, headings, schema markup, links, alt text and AI readiness',
				action: 'Run an SEO audit of a page',
			},
			{
				name: 'Start a Site Crawl',
				value: 'startSiteCrawl',
				description:
					'Start a background crawl of up to 50 pages for broken links, duplicate titles, orphan pages and sitemap gaps',
				action: 'Start a site crawl',
			},
		],
		default: 'auditPage',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/pricing',
		description: 'The public page to check, as a full http or https URL',
		displayOptions: show(...URL_OPERATIONS),
	},
	{
		displayName: 'Competitor URL',
		name: 'competitorUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://competitor.com/pricing',
		description: "The competitor's page for the same search or task",
		displayOptions: show('compareWithCompetitor'),
	},
	{
		displayName: 'Brand Name',
		name: 'brandName',
		type: 'string',
		default: '',
		placeholder: 'Acme Running',
		description:
			"The brand name as people search for it. When set, the audit compares the page's organization schema with it.",
		displayOptions: show('auditPage'),
	},
	{
		displayName: 'Crawler',
		name: 'bot',
		type: 'string',
		default: '',
		placeholder: 'GPTBot',
		description:
			'One robots.txt token, such as GPTBot, ClaudeBot or PerplexityBot. Leave empty to check every AI crawler Agent Ready tracks.',
		displayOptions: show('checkAiCrawlerAccess'),
	},
	{
		displayName: 'Max Links',
		name: 'maxLinks',
		type: 'number',
		typeOptions: { minValue: 5, maxValue: 50 },
		default: 25,
		description: 'The most page links to include in the llms.txt, 5 to 50',
		displayOptions: show('draftLlmsTxt'),
	},
	{
		displayName: 'Page Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: show('startSiteCrawl'),
	},
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		description:
			'The jobId returned by Start a Site Crawl. Results are kept for 24 hours; call again every 20 to 30 seconds until status is done.',
		displayOptions: show('getSiteCrawl'),
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Where the page list starts: pass the nextCursor from the previous result',
		displayOptions: show('getSiteCrawl'),
	},
];

export class AgentReady implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agent Ready Website Audit',
		name: 'agentReady',
		icon: { light: 'file:agentReady.svg', dark: 'file:agentReady.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"]}}',
		description:
			'SEO and AI search audit of any web page, AI crawler access, robots.txt, sitemaps, llms.txt and site crawls. No account needed.',
		defaults: {
			name: 'Agent Ready Website Audit',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const session = new McpSession(this, VERSION);

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const found = await session.call(TOOLS[operation], argumentsFor(this, operation, i));
				returnData.push({ json: found, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// A refusal is the server's own sentence about this input, such as a private address.
				if (error instanceof CheckRefused) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), { message: (error as Error).message }, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

function argumentsFor(context: IExecuteFunctions, operation: string, i: number): IDataObject {
	const text = (name: string) => (context.getNodeParameter(name, i, '') as string).trim();
	if (operation === 'getSiteCrawl') {
		return { jobId: text('jobId'), cursor: context.getNodeParameter('cursor', i, 0) as number };
	}
	const args: IDataObject = { url: text('url') };
	if (operation === 'compareWithCompetitor') args.competitorUrl = text('competitorUrl');
	if (operation === 'auditPage' && text('brandName') !== '') args.brandName = text('brandName');
	if (operation === 'checkAiCrawlerAccess' && text('bot') !== '') args.bot = text('bot');
	if (operation === 'draftLlmsTxt') args.maxLinks = context.getNodeParameter('maxLinks', i, 25) as number;
	if (operation === 'startSiteCrawl') args.limit = context.getNodeParameter('limit', i, 50) as number;
	return args;
}
