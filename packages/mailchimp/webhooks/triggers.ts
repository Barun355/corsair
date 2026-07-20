import type { WebhookRequest } from 'corsair/core';
import { logEventFromContext } from 'corsair/core';
import type { z } from 'zod';
import type { MailchimpContext, MailchimpWebhooks } from '../index';
import { parseMailchimpKey } from '../utils';
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
			// Phase 1 limitation: Mailchimp webhook bodies only carry list_id,
			// but OAuth stores account_id as the routing key. Reconciliation
			// (URL-embedded hints or a list→account cache) is Phase 2 work;
			// until then, fail loudly instead of silently dropping events.
			// Auth mode is recovered from the packed ctx.key (MailchimpContext
			// does not expose authType directly).
			const { authType } = parseMailchimpKey(ctx.key);
			if (authType === 'oauth_2') {
				return {
					success: false,
					statusCode: 501,
					error: `Mailchimp ${type} webhooks require API-key auth in Phase 1 (OAuth routing is Phase 2)`,
				};
			}

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

			// Type assertion is required because createTrigger is generic over
			// four schemas; the parsed data is guaranteed to match the trigger's
			// event shape but TypeScript cannot narrow across the union.
			const event = parsed.data as z.infer<typeof schema>;
			await logEventFromContext(
				ctx,
				`mailchimp.webhook.${type}`,
				{ ...event },
				'completed',
			);
			return { success: true, data: event };
		},
		// Cast is required because MailchimpWebhooks[K] is a strict per-key
		// type and createTrigger builds the handler generically; runtime
		// behavior matches the schema-validated shape for each K.
	} as MailchimpWebhooks[K];
}

export const MailchimpTriggerWebhooks = {
	subscribe: createTrigger('subscribe', SubscribeEventSchema),
	unsubscribe: createTrigger('unsubscribe', UnsubscribeEventSchema),
	profile: createTrigger('profile', ProfileEventSchema),
	campaign: createTrigger('campaign', CampaignEventSchema),
};
