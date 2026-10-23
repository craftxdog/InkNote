const path = require('node:path');

const Database = require(
  path.join(
    __dirname,
    '..',
    'release',
    'app',
    'node_modules',
    'better-sqlite3',
  ),
);

const database = new Database(':memory:');

try {
  database.exec('CREATE TABLE verification (value TEXT NOT NULL)');
  database
    .prepare('INSERT INTO verification (value) VALUES (?)')
    .run('native-module-ready');

  const row = database.prepare('SELECT value FROM verification').get();

  if (row.value !== 'native-module-ready') {
    throw new Error('SQLite did not return the expected verification value.');
  }

  console.log('Native SQLite loads and executes under Electron.');
} finally {
  database.close();
}
