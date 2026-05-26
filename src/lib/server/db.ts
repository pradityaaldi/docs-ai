import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/docs-ai.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (!db) {
		const dir = path.dirname(DB_PATH);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		db = new Database(DB_PATH);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
		initializeSchema(db);
	}
	return db;
}

function initializeSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS connectors (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			provider TEXT NOT NULL CHECK(provider IN ('openai', 'anthropic', 'gemini')),
			base_url TEXT NOT NULL,
			model_name TEXT NOT NULL,
			api_key TEXT NOT NULL DEFAULT '',
			is_active INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS folders (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			project_id TEXT NOT NULL,
			parent_id TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
			FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS documents (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			connector_id TEXT,
			project_id TEXT,
			folder_id TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE SET NULL,
			FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
			FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			document_id TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
			content TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
		);
	`);

	runMigrations(db);
}

function runMigrations(db: Database.Database) {
	const hasProjectsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get();

	const docCols = db.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
	const colNames = new Set(docCols.map(c => c.name));

	if (!hasProjectsTable) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS projects (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);
			CREATE TABLE IF NOT EXISTS folders (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				project_id TEXT NOT NULL,
				parent_id TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
				FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
			);
		`);
	}

	if (!colNames.has('project_id')) {
		db.exec(`ALTER TABLE documents ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`);
	}
	if (!colNames.has('folder_id')) {
		db.exec(`ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`);
	}

	const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
	const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };

	if (projectCount.count === 0 && docCount.count > 0) {
		const projectId = crypto.randomUUID();
		const folderId = crypto.randomUUID();
		db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Default Project');
		db.prepare('INSERT INTO folders (id, name, project_id) VALUES (?, ?, ?)').run(folderId, 'General', projectId);
		db.prepare('UPDATE documents SET project_id = ?, folder_id = ? WHERE project_id IS NULL').run(projectId, folderId);
	}
}

export default getDb;