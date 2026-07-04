import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

import { corsair } from '@/server/corsair';

async function setInstagramCredentials() {
	const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, IG_ACCESS_TOKEN } = process.env;

	if (FACEBOOK_APP_ID) {
		await corsair.keys.instagram.set_client_id(FACEBOOK_APP_ID);
	}
	if (FACEBOOK_APP_SECRET) {
		await corsair.keys.instagram.set_client_secret(FACEBOOK_APP_SECRET);
	}
	if (IG_ACCESS_TOKEN) {
		await corsair.instagram.keys.set_access_token(IG_ACCESS_TOKEN);
	}
}

async function setMailchimpCredentials() {
	const { MAILCHIMP_API_KEY } = process.env;
	if (MAILCHIMP_API_KEY) {
		await corsair.mailchimp.keys.set_api_key(MAILCHIMP_API_KEY);
	}
}

const main = async () => {
	await setInstagramCredentials();
	await setMailchimpCredentials();

	if (process.env.MAILCHIMP_API_KEY) {
		const ping = await corsair.mailchimp.api.account.ping({});
		console.log('mailchimp ping:', ping);

		const lists = await corsair.mailchimp.api.lists.list({ count: 5 });
		console.log('mailchimp lists:', lists);
	}
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
