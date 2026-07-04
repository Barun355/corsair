import type { ApiRequestOptions, OpenAPIConfig } from 'corsair/http';
import { request } from 'corsair/http';

import {
	basicAuthHeader,
	bearerAuthHeader,
	dataCenterFromApiKey,
	mailchimpBaseUrl,
} from './utils';

export class MailchimpAPIError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = 'MailchimpAPIError';
	}
}

/**
 * Mailchimp OAuth metadata endpoint. After the OAuth token exchange, the access
 * token alone does not encode a data center — it must be resolved here.
 */
export const MAILCHIMP_OAUTH_METADATA_URL =
	'https://login.mailchimp.com/oauth2/metadata';

export type MailchimpOAuthMetadata = {
	dc: string;
	api_endpoint: string;
	login_url?: string;
	account_id?: string;
};

/**
 * Resolves the data center (and API endpoint) for an OAuth access token via the
 * Mailchimp metadata endpoint. Call this once after OAuth and persist the `dc`
 * so per-request calls can build the correct base URL without re-fetching.
 */
export async function fetchMailchimpOAuthMetadata(
	accessToken: string,
): Promise<MailchimpOAuthMetadata> {
	if (!accessToken) {
		throw new MailchimpAPIError(
			'An access token is required to resolve Mailchimp OAuth metadata.',
		);
	}

	const res = await fetch(MAILCHIMP_OAUTH_METADATA_URL, {
		headers: { Authorization: `OAuth ${accessToken}` },
	});
	if (!res.ok) {
		throw new MailchimpAPIError(
			`Failed to resolve Mailchimp data center (HTTP ${res.status}).`,
		);
	}

	const body = (await res.json()) as Partial<MailchimpOAuthMetadata>;
	if (!body.dc || !body.api_endpoint) {
		throw new MailchimpAPIError(
			'Mailchimp OAuth metadata did not include a data center.',
		);
	}
	return {
		dc: body.dc,
		api_endpoint: body.api_endpoint,
		login_url: body.login_url,
		account_id: body.account_id,
	};
}

export type MailchimpRequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	body?: Record<string, unknown>;
	query?: Record<string, string | number | boolean | undefined>;
	/**
	 * How to authenticate. `api_key` derives the data center from the key
	 * suffix; `oauth_2` uses a bearer token and requires `dataCenter`.
	 */
	authType?: 'api_key' | 'oauth_2';
	/**
	 * Data center prefix (e.g. `us19`). Required for OAuth connections (resolved
	 * from the OAuth metadata endpoint); derived from the key for API-key
	 * connections when omitted.
	 */
	dataCenter?: string;
};

/**
 * Resolves the Marketing API base URL for a connection. OAuth connections must
 * supply the data center; API-key connections derive it from the key suffix.
 */
export function resolveMailchimpBaseUrl(
	key: string,
	options: Pick<MailchimpRequestOptions, 'authType' | 'dataCenter'>,
): string {
	const dc =
		options.dataCenter ??
		(options.authType === 'oauth_2' ? undefined : dataCenterFromApiKey(key));
	if (!dc) {
		throw new Error(
			'Mailchimp OAuth connections require a data center (resolve it from the OAuth metadata endpoint).',
		);
	}
	return mailchimpBaseUrl(dc);
}

export async function makeMailchimpRequest<T>(
	endpoint: string,
	key: string,
	options: MailchimpRequestOptions = {},
): Promise<T> {
	const { method = 'GET', body, query, authType = 'api_key' } = options;

	const authorization =
		authType === 'oauth_2' ? bearerAuthHeader(key) : basicAuthHeader(key);

	const config: OpenAPIConfig = {
		BASE: resolveMailchimpBaseUrl(key, options),
		VERSION: '3.0',
		WITH_CREDENTIALS: false,
		CREDENTIALS: 'omit',
		TOKEN: key,
		HEADERS: {
			'Content-Type': 'application/json',
			Authorization: authorization,
		},
	};

	const requestOptions: ApiRequestOptions = {
		method,
		url: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
		body:
			method === 'POST' || method === 'PUT' || method === 'PATCH'
				? body
				: undefined,
		mediaType: 'application/json; charset=utf-8',
		query: method === 'GET' ? query : undefined,
	};

	try {
		return await request<T>(config, requestOptions);
	} catch (error) {
		if (error instanceof Error) {
			throw new MailchimpAPIError(error.message);
		}
		throw new MailchimpAPIError('Unknown error');
	}
}
