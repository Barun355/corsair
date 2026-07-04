import {
	fetchMailchimpOAuthMetadata,
	MAILCHIMP_OAUTH_METADATA_URL,
	MailchimpAPIError,
} from '../client';

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
