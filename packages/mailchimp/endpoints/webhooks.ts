import { logEventFromContext } from 'corsair/core';

import { getMailchimpAccountId, makeMailchimpRequest } from '../client';
import type { MailchimpEndpoints } from '../index';
import type { MailchimpEndpointOutputs } from './types';

export const list: MailchimpEndpoints['webhooksList'] = async (ctx, input) => {
	const response = await makeMailchimpRequest<
		MailchimpEndpointOutputs['webhooksList']
	>(`/lists/${input.list_id}/webhooks`, ctx.key, { method: 'GET' });

	await logEventFromContext(
		ctx,
		'mailchimp.webhooks.list',
		{ ...input },
		'completed',
	);
	return response;
};

export const get: MailchimpEndpoints['webhooksGet'] = async (ctx, input) => {
	const response = await makeMailchimpRequest<
		MailchimpEndpointOutputs['webhooksGet']
	>(`/lists/${input.list_id}/webhooks/${input.webhook_id}`, ctx.key, {
		method: 'GET',
	});

	await logEventFromContext(
		ctx,
		'mailchimp.webhooks.get',
		{ ...input },
		'completed',
	);
	return response;
};

export const create: MailchimpEndpoints['webhooksCreate'] = async (
	ctx,
	input,
) => {
	const { list_id, ...body } = input;

	// Embed the Mailchimp account_id in the webhook URL so inbound events can
	// be routed back to this account. The matcher reads `aid` from the query
	// string and matches it against the account-level tenant_external_id that
	// resolveMailchimpOAuthWebhookTenantLink stores at OAuth time. Without this
	// hint the matcher only sees the body's list_id, which is never stored as a
	// routing key, and the webhook silently fails to route.
	if (typeof body.url === 'string') {
		try {
			const url = new URL(body.url);
			if (!url.searchParams.has('aid')) {
				const accountId = await getMailchimpAccountId(ctx.key);
				if (accountId) {
					url.searchParams.set('aid', accountId);
					body.url = url.toString();
				}
			}
		} catch {
			// Malformed URL — forward as-is; Mailchimp will reject if invalid.
		}
	}

	const response = await makeMailchimpRequest<
		MailchimpEndpointOutputs['webhooksCreate']
	>(`/lists/${list_id}/webhooks`, ctx.key, { method: 'POST', body });

	await logEventFromContext(
		ctx,
		'mailchimp.webhooks.create',
		{ ...input },
		'completed',
	);
	return response;
};

export const update: MailchimpEndpoints['webhooksUpdate'] = async (
	ctx,
	input,
) => {
	const { list_id, webhook_id, ...body } = input;
	const response = await makeMailchimpRequest<
		MailchimpEndpointOutputs['webhooksUpdate']
	>(`/lists/${list_id}/webhooks/${webhook_id}`, ctx.key, {
		method: 'PATCH',
		body,
	});

	await logEventFromContext(
		ctx,
		'mailchimp.webhooks.update',
		{ ...input },
		'completed',
	);
	return response;
};

export const remove: MailchimpEndpoints['webhooksRemove'] = async (
	ctx,
	input,
) => {
	const response = await makeMailchimpRequest<
		MailchimpEndpointOutputs['webhooksRemove']
	>(`/lists/${input.list_id}/webhooks/${input.webhook_id}`, ctx.key, {
		method: 'DELETE',
	});

	await logEventFromContext(
		ctx,
		'mailchimp.webhooks.remove',
		{ ...input },
		'completed',
	);
	return response;
};
