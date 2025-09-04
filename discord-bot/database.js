const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'bot_data.db'));
        this.init();
    }

    init() {
        this.db.serialize(() => {
            // Create ticket configuration table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS ticket_config (
                    guild_id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    role_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create support ticket configuration table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS support_ticket_config (
                    guild_id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    role_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create ticket categories table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS ticket_categories (
                    guild_id TEXT PRIMARY KEY,
                    setup_category_id TEXT,
                    support_category_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create open tickets table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS open_tickets (
                    user_id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    ticket_number INTEGER NOT NULL,
                    random_number INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create embed data table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS embed_data (
                    user_id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    color TEXT,
                    timestamp BOOLEAN DEFAULT 1,
                    thumbnail BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create reaction roles table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS reaction_roles (
                    guild_id    TEXT NOT NULL,
                    channel_id  TEXT NOT NULL,
                    message_id  TEXT NOT NULL,
                    role_id     TEXT NOT NULL,
                    emoji_id    TEXT,         -- for custom emojis
                    emoji_name  TEXT,         -- for unicode or custom name
                    is_unicode  INTEGER NOT NULL DEFAULT 0
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Error creating reaction_roles table:', err);
                } else {
                    console.log('✅ reaction_roles table created/verified successfully');
                }
            });

            // Create ticket counter table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS ticket_counter (
                    id INTEGER PRIMARY KEY,
                    counter INTEGER DEFAULT 1
                )
            `);

            // Initialize ticket counter if it doesn't exist
            this.db.run(`
                INSERT OR IGNORE INTO ticket_counter (id, counter) VALUES (1, 1)
            `);
        });
    }

    // Ticket configuration methods
    async saveTicketConfig(guildId, channelId, roleId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO ticket_config (guild_id, channel_id, role_id) VALUES (?, ?, ?)',
                [guildId, channelId, roleId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getTicketConfig(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM ticket_config WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Support ticket configuration methods
    async saveSupportTicketConfig(guildId, channelId, roleId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO support_ticket_config (guild_id, channel_id, role_id) VALUES (?, ?, ?)',
                [guildId, channelId, roleId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getSupportTicketConfig(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM support_ticket_config WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Ticket categories methods
    async saveTicketCategories(guildId, setupCategoryId, supportCategoryId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO ticket_categories (guild_id, setup_category_id, support_category_id) VALUES (?, ?, ?)',
                [guildId, setupCategoryId, supportCategoryId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getTicketCategories(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM ticket_categories WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Open tickets methods
    async saveOpenTicket(userId, channelId, ticketNumber, randomNumber, type) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO open_tickets (user_id, channel_id, ticket_number, random_number, type) VALUES (?, ?, ?, ?, ?)',
                [userId, channelId, ticketNumber, randomNumber, type],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getOpenTicket(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM open_tickets WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async deleteOpenTicket(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM open_tickets WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async getOpenTicketByChannel(channelId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM open_tickets WHERE channel_id = ?',
                [channelId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Embed data methods
    async saveEmbedData(userId, data) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO embed_data (user_id, title, description, color, timestamp, thumbnail, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [userId, data.title, data.description, data.color, data.timestamp ? 1 : 0, data.thumbnail ? 1 : 0],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getEmbedData(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM embed_data WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else if (row) {
                        // Convert boolean values back
                        resolve({
                            title: row.title,
                            description: row.description,
                            color: row.color,
                            timestamp: row.timestamp === 1,
                            thumbnail: row.thumbnail === 1
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async deleteEmbedData(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM embed_data WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Ticket counter methods
    async getTicketCounter() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT counter FROM ticket_counter WHERE id = 1',
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.counter : 1);
                }
            );
        });
    }

    async incrementTicketCounter() {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE ticket_counter SET counter = counter + 1 WHERE id = 1',
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Load all data methods for startup
    async loadAllTicketConfigs() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM ticket_config',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async loadAllSupportTicketConfigs() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM support_ticket_config',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async loadAllTicketCategories() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM ticket_categories',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async loadAllOpenTickets() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM open_tickets',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async loadAllEmbedData() {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare('SELECT * FROM embed_data');
                const rows = stmt.all();
                resolve(rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Reaction Role Methods
    async insertReactionRole(guildId, channelId, messageId, roleId, emojiId, emojiName, isUnicode) {
        return new Promise((resolve, reject) => {
            try {
                // First check if this combination already exists
                const checkStmt = this.db.prepare(`
                    SELECT * FROM reaction_roles 
                    WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                `);
                const existing = checkStmt.get(messageId, emojiId || '', emojiName || '');
                
                if (existing) {
                    // Update existing record
                    const updateStmt = this.db.prepare(`
                        UPDATE reaction_roles 
                        SET guild_id = ?, channel_id = ?, role_id = ?, is_unicode = ?
                        WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                    `);
                    const result = updateStmt.run(guildId, channelId, roleId, isUnicode ? 1 : 0, messageId, emojiId || '', emojiName || '');
                    resolve(result);
                } else {
                    // Insert new record
                    const insertStmt = this.db.prepare(`
                        INSERT INTO reaction_roles
                        (guild_id, channel_id, message_id, role_id, emoji_id, emoji_name, is_unicode)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    const result = insertStmt.run(guildId, channelId, messageId, roleId, emojiId, emojiName, isUnicode ? 1 : 0);
                    resolve(result);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async findReactionRoleByMessageAndEmoji(messageId, isUnicode, emojiKey) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🔍 Database query: messageId=${messageId}, isUnicode=${isUnicode}, emojiKey=${emojiKey}`);
                
                let stmt;
                if (isUnicode) {
                    stmt = this.db.prepare(`
                        SELECT * FROM reaction_roles
                        WHERE message_id = ? AND is_unicode = 1 AND emoji_name = ?
                        LIMIT 1
                    `);
                } else {
                    stmt = this.db.prepare(`
                        SELECT * FROM reaction_roles
                        WHERE message_id = ? AND is_unicode = 0 AND emoji_id = ?
                        LIMIT 1
                    `);
                }
                const row = stmt.get(messageId, emojiKey);
                console.log(`🔍 Database result:`, row);
                resolve(row);
            } catch (error) {
                console.error(`❌ Database error in findReactionRoleByMessageAndEmoji:`, error);
                reject(error);
            }
        });
    }

    async getAllReactionRoles(guildId) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?');
                const rows = stmt.all(guildId);
                resolve(rows);
            } catch (error) {
                reject(error);
            }
        });
    }

    async deleteReactionRole(messageId, emojiId, emojiName) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(`
                    DELETE FROM reaction_roles 
                    WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                `);
                const result = stmt.run(messageId, emojiId || '', emojiName || '');
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    async updateReactionRole(messageId, emojiId, emojiName, newRoleId, newText, newColor) {
        return new Promise((resolve, reject) => {
            try {
                // First get the current mapping
                const stmt = this.db.prepare(`
                    SELECT * FROM reaction_roles 
                    WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                `);
                const current = stmt.get(messageId, emojiId || '', emojiName || '');
                
                if (current) {
                    // Update the role
                    const updateStmt = this.db.prepare(`
                        UPDATE reaction_roles 
                        SET role_id = ? 
                        WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                    `);
                    const result = updateStmt.run(newRoleId, messageId, emojiId || '', emojiName || '');
                    resolve({ ...current, role_id: newRoleId, newText, newColor });
                } else {
                    resolve(null);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;
