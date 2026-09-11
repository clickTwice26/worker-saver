import { config } from './config.ts';
import { getDb } from './db/index.ts';
import { migrate } from './db/migrate.ts';
import { createApp } from './app.ts';
import { computeRulesVersion, ENGINE_VERSION } from './engine/index.ts';

const db = getDb();

// Migrations run on boot so a fresh checkout needs one command, not two.
const applied = migrate(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

const app = createApp(db);

app.listen(config.port, () => {
  console.log(`ALE Insight API  ->  http://localhost:${config.port}/api`);
  console.log(`engine ${ENGINE_VERSION}  rules ${computeRulesVersion(db)}`);
  console.log(`database ${config.databasePath}`);
});
