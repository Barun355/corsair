import {
	fetchMailchimpOAuthMetadata,
	MAILCHIMP_OAUTH_METADATA_URL,
	MailchimpAPIError,
	makeMailchimpRequest,
} from '../client';
import { packMailchimpOAuthKey, parseMailchimpKey } from '../utils';

jest.mock('corsair/http', () => ({
	request: jest.fn().mockResolvedValue({ ok: true }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { request: mockedRequest } = require('corsair/http') as {
	request: jest.Mock;
};

describe('fetchMailchimpOAuthMetadata', () => {
	it('exposes the Mailchimp OAuth metadata endpoint', () => {
		expect(MAILCHIMP_OAUTH_METADATA_URL).toBe(
			'https://login.mailchimp.com/oauth2/metadata',
		);
	});

	it('rejects an empty access token before any network call', async () => {
		await expect(fetchMailchimpOAuthMetadata('')).rejects.toBeInstanceOf(
			MailchimpAPIError,
		);
	});
});

describe('parseMailchimpKey / packMailchimpOAuthKey', () => {
	it('parses a JSON-packed OAuth key into token + dataCenter', () => {
		const packed = packMailchimpOAuthKey('token-123', 'us19');
		const parsed = parseMailchimpKey(packed);
		expect(parsed).toEqual({
			token: 'token-123',
			authType: 'oauth_2',
			dataCenter: 'us19',
		});
	});

	it('treats a bare string as an API key without a packed data center', () => {
		const parsed = parseMailchimpKey('abc-us19');
		expect(parsed).toEqual({ token: 'abc-us19', authType: 'api_key' });
	});

	it('rejects an empty key', () => {
		expect(() => parseMailchimpKey('')).toThrow();
	});

	it('rejects malformed packed JSON', () => {
		expect(() => parseMailchimpKey('{not-json}')).toThrow();
	});

	it('rejects packed JSON missing token or dc', () => {
		expect(() => parseMailchimpKey(JSON.stringify({ token: 'x' }))).toThrow();
		expect(() => parseMailchimpKey(JSON.stringify({ dc: 'us1' }))).toThrow();
	});
});

describe('makeMailchimpRequest auth-mode resolution', () => {
	beforeEach(() => {
		mockedRequest.mockClear();
	});

	it('uses Bearer auth + packed data center for OAuth keys', async () => {
		const packed = packMailchimpOAuthKey('oauth-token', 'us19');

		await makeMailchimpRequest('/lists', packed, { method: 'GET' });

		expect(mockedRequest).toHaveBeenCalledTimes(1);
		const [config] = mockedRequest.mock.calls[0]!;
		expect(config.BASE).toBe('https://us19.api.mailchimp.com/3.0');
		expect(config.HEADERS.Authorization).toBe('Bearer oauth-token');
	});

	it('uses Basic auth + derives data center from the key suffix for API keys', async () => {
		await makeMailchimpRequest('/lists', 'abc-us19', { method: 'GET' });

		expect(mockedRequest).toHaveBeenCalledTimes(1);
		const [config] = mockedRequest.mock.calls[0]!;
		expect(config.BASE).toBe('https://us19.api.mailchimp.com/3.0');
		expect(config.HEADERS.Authorization).toBe(
			`Basic ${Buffer.from('anystring:abc-us19').toString('base64')}`,
		);
	});
});
