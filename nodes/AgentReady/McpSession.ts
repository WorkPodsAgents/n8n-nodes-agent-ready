import type { IDataObject, IExecuteFunctions, IN8nHttpFullResponse } from 'n8n-workflow';

// The hosted Agent Ready Website Audit server speaks MCP's Streamable HTTP transport. A session is
// opened once per execution and reused for every item, so one run costs one initialize.
const ENDPOINT = 'https://mcp.workpods.ai/mcp';
const PROTOCOL_VERSION = '2025-06-18';
const TIMEOUT_MS = 90_000;

/** One check's answer: a one-sentence summary, a shareable report page and the details. */
export interface CheckResult extends IDataObject {
	summary: string;
	reportUrl: string | null;
	result: IDataObject;
}

/** A refusal or failure the server explained in one sentence, such as a private address. */
export class CheckRefused extends Error {}

interface RpcReply {
	result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
	error?: { message: string };
}

export class McpSession {
	private session: string | null = null;

	constructor(
		private readonly context: IExecuteFunctions,
		private readonly clientVersion: string,
	) {}

	async call(tool: string, args: IDataObject): Promise<CheckResult> {
		const session = await this.open();
		const reply = await this.post(
			{ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } },
			session,
		);
		if (reply?.error) throw new CheckRefused(reply.error.message);
		const text = reply?.result?.content?.find((part) => part.type === 'text')?.text;
		if (text === undefined) throw new Error('Agent Ready sent an empty answer; try again later.');
		if (reply?.result?.isError) throw new CheckRefused(text);
		return JSON.parse(text) as CheckResult;
	}

	private async open(): Promise<string> {
		if (this.session !== null) return this.session;
		const response = await this.request(
			{
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: PROTOCOL_VERSION,
					capabilities: {},
					clientInfo: { name: 'agent-ready-n8n', version: this.clientVersion },
				},
			},
			null,
		);
		const header = response.headers['mcp-session-id'];
		const session = Array.isArray(header) ? header[0] : header;
		if (typeof session !== 'string' || session === '') {
			throw new Error('Agent Ready did not open a session; try again later.');
		}
		await this.request({ jsonrpc: '2.0', method: 'notifications/initialized' }, session);
		this.session = session;
		return session;
	}

	private async post(message: IDataObject, session: string): Promise<RpcReply | null> {
		const response = await this.request(message, session);
		return parse(String(response.body ?? ''));
	}

	private async request(message: IDataObject, session: string | null): Promise<IN8nHttpFullResponse> {
		const headers: IDataObject = {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			'mcp-protocol-version': PROTOCOL_VERSION,
		};
		if (session !== null) headers['mcp-session-id'] = session;
		const response = (await this.context.helpers.httpRequest({
			method: 'POST',
			url: ENDPOINT,
			headers,
			body: JSON.stringify(message),
			json: false,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			timeout: TIMEOUT_MS,
		})) as IN8nHttpFullResponse;
		if (response.statusCode === 429) {
			throw new CheckRefused('Agent Ready is busy or the daily limit is used up; try again later.');
		}
		if (response.statusCode !== 202 && (response.statusCode < 200 || response.statusCode >= 300)) {
			throw new Error(`Agent Ready answered HTTP ${response.statusCode}; try again later.`);
		}
		return response;
	}
}

/** The answer arrives as plain JSON or as server-sent events; either way take the JSON-RPC reply. */
function parse(body: string): RpcReply | null {
	const trimmed = body.trim();
	if (trimmed === '') return null;
	if (trimmed.startsWith('{')) return JSON.parse(trimmed) as RpcReply;
	const data = trimmed
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(5).trim())
		.filter((line) => line.startsWith('{'));
	const last = data[data.length - 1];
	return last === undefined ? null : (JSON.parse(last) as RpcReply);
}
