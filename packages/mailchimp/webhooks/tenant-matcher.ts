import type { RawWebhookRequest, WebhookTenantMatch } from 'corsair/core';
import { asRecord, firstString } from 'corsair/core';

import { parseMailchimpWebhookBody } from './types';

// Mailchimp webhooks are list-scoped and form-encoded. There is no account id in
// the payload, so we route by list_id (`data[list_id]`); an explicit
// tenant_external_id is preferred when present.
export function matchMailchimpTenantWebhook(
	request: RawWebhookRequest,
): WebhookTenantMatch | null {
	const body = parseMailchimpWebhookBody(request.body);
	if (!body) return null;

	const data = asRecord(body.data);
	const externalId = firstString([
		body.tenant_external_id,
		data?.list_id,
		data?.tenant_external_id,
	]);

	if (!externalId) return null;

	return { linkType: 'tenant_external_id', externalId };
}
