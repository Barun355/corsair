import type { WebhookRequest } from 'corsair/core';
import { logEventFromContext } from 'corsair/core';
import type { z } from 'zod';

import type { MailchimpContext, MailchimpWebhooks } from '../index';
import {
	CampaignEventSchema,
	createMailchimpMatch,
	ProfileEventSchema,
	parseMailchimpWebhookBody,
	SubscribeEventSchema,
	UnsubscribeEventSchema,
	verifyMailchimpWebhookSecret,
} from './types';

/**
 * Builds a Mailchimp trigger webhook: secret validation (unsigned webhooks),
 * defensive form-encoded parsing, schema validation, and event logging.
 */
function createTrigger<K extends keyof MailchimpWebhooks>(
	type: K,
	schema:
		| typeof SubscribeEventSchema
		| typeof UnsubscribeEventSchema
		| typeof ProfileEventSchema
		| typeof CampaignEventSchema,
): MailchimpWebhooks[K] {
	return {
		match: createMailchimpMatch(type),
		handler: async (
			ctx: MailchimpContext,
			request: WebhookRequest<unknown>,
		) => {
			const verification = verifyMailchimpWebhookSecret(request, ctx.key);
			if (!verification.valid) {
				return {
					success: false,
					statusCode: 401,
					error: verification.error ?? 'Webhook secret verification failed',
				};
			}

			const body =
				parseMailchimpWebhookBody(request.rawBody) ?? request.payload;
			const parsed = schema.safeParse(body);
			if (!parsed.success) {
				return {
					success: false,
					statusCode: 400,
					error: `Invalid Mailchimp ${type} payload`,
				};
			}

			const event = parsed.data as z.infer<typeof schema>;
			await logEventFromContext(
				ctx,
				`mailchimp.webhook.${type}`,
				{ ...event },
				'completed',
			);
			return { success: true, data: event };
		},
	} as MailchimpWebhooks[K];
}

export const MailchimpTriggerWebhooks = {
	subscribe: createTrigger('subscribe', SubscribeEventSchema),
	unsubscribe: createTrigger('unsubscribe', UnsubscribeEventSchema),
	profile: createTrigger('profile', ProfileEventSchema),
	campaign: createTrigger('campaign', CampaignEventSchema),
};
