import {
	pgTable,
	uuid,
	text,
	boolean,
	integer,
	timestamp,
	jsonb,
	doublePrecision
} from 'drizzle-orm/pg-core';

// ── Auth ──

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash'), // nullable for oauth-only
	name: text('name').notNull().default(''),
	role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
	emailVerified: boolean('email_verified').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const oauthAccounts = pgTable('oauth_accounts', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	provider: text('provider').notNull(), // google
	providerAccountId: text('provider_account_id').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	used: boolean('used').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ── AI config (admin-only, replaces connectors) ──

export const aiConfig = pgTable('ai_config', {
	id: uuid('id').primaryKey().defaultRandom(),
	provider: text('provider', { enum: ['openai', 'anthropic', 'gemini', 'minimax'] }).notNull(),
	apiKey: text('api_key').notNull().default(''),
	model: text('model').notNull(),
	baseUrl: text('base_url').notNull(),
	isActive: boolean('is_active').notNull().default(false),
	updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ── Templates (gallery, Google Docs style) ──

export const templates = pgTable('templates', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	category: text('category', { enum: ['skripsi', 'makalah', 'surat'] }).notNull(),
	kampus: text('kampus'),
	org: text('org'),
	description: text('description').notNull().default(''),
	struktur: jsonb('struktur').notNull().default([]), // sections / BAB
	format: jsonb('format').notNull().default({}), // font, margin, spasi, heading, daftar pustaka, cover/kop
	formFields: jsonb('form_fields').notNull().default([]), // fields to ask before generate
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ── Billing ──

export const plans = pgTable('plans', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	quota: integer('quota').notNull().default(0), // generations per period
	maxProjects: integer('max_projects').notNull().default(0),
	price: integer('price').notNull().default(0), // IDR
	durationDays: integer('duration_days').notNull().default(30),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const subscriptions = pgTable('subscriptions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
	status: text('status', { enum: ['active', 'expired', 'cancelled'] }).notNull().default('active'),
	quotaUsed: integer('quota_used').notNull().default(0),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const payments = pgTable('payments', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
	orderId: text('order_id').notNull().unique(),
	amount: integer('amount').notNull(),
	status: text('status', {
		enum: ['pending', 'settlement', 'capture', 'expire', 'cancel', 'deny', 'failure']
	})
		.notNull()
		.default('pending'),
	midtransToken: text('midtrans_token'),
	paymentType: text('payment_type'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ── AI monitoring & safety ──

export const aiGenerations = pgTable('ai_generations', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
	projectId: uuid('project_id'),
	templateId: uuid('template_id'),
	category: text('category'),
	promptTokens: integer('prompt_tokens').notNull().default(0),
	completionTokens: integer('completion_tokens').notNull().default(0),
	totalTokens: integer('total_tokens').notNull().default(0),
	cost: doublePrecision('cost').notNull().default(0),
	status: text('status', { enum: ['ok', 'error'] }).notNull().default('ok'),
	error: text('error'),
	latencyMs: integer('latency_ms').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const aiLimits = pgTable('ai_limits', {
	id: uuid('id').primaryKey().defaultRandom(),
	enabled: boolean('enabled').notNull().default(true), // kill switch
	dailyTokenCap: integer('daily_token_cap').notNull().default(0),
	monthlyCostCap: doublePrecision('monthly_cost_cap').notNull().default(0),
	perUserDailyCap: integer('per_user_daily_cap').notNull().default(0),
	ratePerMin: integer('rate_per_min').notNull().default(0),
	maxTokensPerReq: integer('max_tokens_per_req').notNull().default(0),
	warnThresholdPct: integer('warn_threshold_pct').notNull().default(80),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const alerts = pgTable('alerts', {
	id: uuid('id').primaryKey().defaultRandom(),
	type: text('type').notNull(), // budget / error_spike / abuse / provider_down
	message: text('message').notNull(),
	sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow()
});

// ── Content (ported from SQLite) ──

export const projects = pgTable('projects', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
	templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
	input: jsonb('input'), // form answers
	bahasa: text('bahasa').notNull().default('Indonesia'),
	status: text('status', { enum: ['belum mulai', 'generated', 'siap export'] })
		.notNull()
		.default('belum mulai'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const folders = pgTable('folders', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	parentId: uuid('parent_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const documents = pgTable('documents', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	content: text('content').notNull().default(''), // DOCX JSON (string)
	userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
	projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
	folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const messages = pgTable('messages', {
	id: uuid('id').primaryKey().defaultRandom(),
	documentId: uuid('document_id')
		.notNull()
		.references(() => documents.id, { onDelete: 'cascade' }),
	role: text('role', { enum: ['user', 'assistant'] }).notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ── Inferred types ──

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AiConfig = typeof aiConfig.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AiGeneration = typeof aiGenerations.$inferSelect;
export type AiLimits = typeof aiLimits.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Message = typeof messages.$inferSelect;
