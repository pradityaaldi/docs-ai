/// <reference types="@sveltejs/kit" />

import type { User } from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Locals {
			user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerified'> | null;
			sessionId: string | null;
		}
	}
}

export {};
