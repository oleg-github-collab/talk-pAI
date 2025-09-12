try {
    // Create metadata table if not exists
    db.prepare(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Get current version
    let currentVersion = 0;
    try {
      const versionResult = db.prepare("SELECT value FROM metadata WHERE key = 'version'").get();
      if (versionResult) {
        currentVersion = parseInt(versionResult.value);
      }
    } catch (e) {
      console.log('No existing version found, starting from 0');
    }
    
    console.log(`Current database version: ${currentVersion}`);
    
    // Migration definitions
    const migrations = [
      {
        version: 1,
        description: 'Initial schema',
        up: () => {
          // This is handled by database.js initialize()
          console.log('✅ Initial schema already created');
        }
      },
      {
        version: 2,
        description: 'Add message reactions',
        up: () => {
          db.prepare(`
            CREATE TABLE IF NOT EXISTS reactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              message_id INTEGER NOT NULL,
              user TEXT NOT NULL,
              emoji TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
              FOREIGN KEY (user) REFERENCES users(nickname) ON DELETE CASCADE,
              UNIQUE(message_id, user, emoji)
            )
          `).run();
          
          db.prepare('CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id)').run();
          console.log('✅ Added reactions table');
        }
      },
      {
        version: 3,
        description: 'Add user preferences',
        up: () => {
          db.prepare(`
            CREATE TABLE IF NOT EXISTS user_preferences (
              user TEXT PRIMARY KEY,
              language TEXT DEFAULT 'en',
              timezone TEXT DEFAULT 'UTC',
              ai_personality TEXT DEFAULT 'friendly',
              notification_sound BOOLEAN DEFAULT 1,
              message_preview BOOLEAN DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user) REFERENCES users(nickname) ON DELETE CASCADE
            )
          `).run();
          console.log('✅ Added user preferences table');
        }
      },
      {
        version: 4,
        description: 'Add file attachments',
        up: () => {
          db.prepare(`
            CREATE TABLE IF NOT EXISTS attachments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              message_id INTEGER NOT NULL,
              type TEXT NOT NULL,
              url TEXT NOT NULL,
              filename TEXT,
              size INTEGER,
              mime_type TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            )
          `).run();
          
          db.prepare('CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id)').run();
          console.log('✅ Added attachments table');
        }
      },
      {
        version: 5,
        description: 'Add push notification tokens',
        up: () => {
          db.prepare(`
            ALTER TABLE sessions ADD COLUMN push_token TEXT
          `).run();
          console.log('✅ Added push notification support');
        }
      }
    ];
    
    // Run migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`\nRunning migration ${migration.version}: ${migration.description}`);
        try {
          db.transaction(() => {
            migration.up();
            db.prepare(`
              INSERT OR REPLACE INTO metadata (key, value) VALUES ('version', ?)
            `).run(migration.version.toString());
          })();
          currentVersion = migration.version;
        } catch (error) {
          console.error(`❌ Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
    
    // Backup database after migration
    if (currentVersion > 0) {
      const backupPath = `./backups/talkpai_backup_${Date.now()}.db`;
      await fs.mkdir('./backups', { recursive: true });
      
      console.log(`\n📦 Creating backup at ${backupPath}`);
      const backup = db.backup(backupPath);
      await backup.step(-1);
      backup.close();
      console.log('✅ Backup created successfully');
    }
    
    // Optimize database
    console.log('\n🔧 Optimizing database...');
    db.pragma('vacuum');
    db.pragma('optimize');
    db.pragma('analysis_limit = 1000');
    db.pragma('analyze');
    console.log('✅ Database optimized');
    
    // Show statistics
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM messages) as messages,
        (SELECT COUNT(*) FROM sessions) as sessions,
        (SELECT COUNT(*) FROM contacts) as contacts
    `).get();
    
    console.log('\n📊 Database Statistics:');
    console.log(`- Users: ${stats.users}`);
    console.log(`- Messages: ${stats.messages}`);
    console.log(`- Sessions: ${stats.sessions}`);
    console.log(`- Contacts: ${stats.contacts}`);
    
    console.log('\n✨ Migration completed successfully!');
    console.log(`Database