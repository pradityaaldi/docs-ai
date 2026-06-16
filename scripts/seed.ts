import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';
import { TEMPLATE_SEEDS } from '../src/lib/server/templates-seed';

const url = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/paperio';
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

async function seedTemplates() {
	for (const t of TEMPLATE_SEEDS) {
		const [existing] = await db
			.select({ id: schema.templates.id })
			.from(schema.templates)
			.where(eq(schema.templates.slug, t.slug));

		const values = {
			name: t.name,
			slug: t.slug,
			category: t.category,
			kampus: t.kampus ?? null,
			org: t.org ?? null,
			description: t.description,
			struktur: t.struktur as object,
			format: t.format as object,
			formFields: t.formFields as object,
			isActive: true
		};

		if (existing) {
			await db.update(schema.templates).set(values).where(eq(schema.templates.id, existing.id));
			console.log(`updated template: ${t.slug}`);
		} else {
			await db.insert(schema.templates).values(values);
			console.log(`inserted template: ${t.slug}`);
		}
	}
}

async function seedPlans() {
	const plans = [
		{ name: 'Free Trial', quota: 1, maxProjects: 1, price: 0, durationDays: 7 },
		{ name: 'Basic', quota: 10, maxProjects: 5, price: 25000, durationDays: 30 },
		{ name: 'Pro', quota: 50, maxProjects: 30, price: 75000, durationDays: 30 }
	];
	for (const p of plans) {
		const [existing] = await db
			.select({ id: schema.plans.id })
			.from(schema.plans)
			.where(eq(schema.plans.name, p.name));
		if (existing) {
			await db.update(schema.plans).set(p).where(eq(schema.plans.id, existing.id));
			console.log(`updated plan: ${p.name}`);
		} else {
			await db.insert(schema.plans).values(p);
			console.log(`inserted plan: ${p.name}`);
		}
	}
}

async function seedAiLimits() {
	const [existing] = await db.select({ id: schema.aiLimits.id }).from(schema.aiLimits).limit(1);
	if (!existing) {
		await db.insert(schema.aiLimits).values({
			enabled: true,
			dailyTokenCap: 2_000_000,
			monthlyCostCap: 50,
			perUserDailyCap: 200_000,
			ratePerMin: 5,
			maxTokensPerReq: 100_000,
			warnThresholdPct: 80
		});
		console.log('inserted ai_limits singleton');
	} else {
		console.log('ai_limits already exists');
	}
}

async function main() {
	await seedTemplates();
	await seedPlans();
	await seedAiLimits();
	await client.end();
	console.log('seed done.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
