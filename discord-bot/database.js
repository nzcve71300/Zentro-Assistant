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

            // Create Zentro ticket configuration table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS zentro_ticket_config (
                    guild_id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    role_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create Zentro open tickets table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS zentro_open_tickets (
                    user_id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    ticket_number INTEGER NOT NULL,
                    random_number INTEGER NOT NULL,
                    ticket_type TEXT NOT NULL,
                    ticket_data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create Zentro ticket counter table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS zentro_ticket_counter (
                    id INTEGER PRIMARY KEY,
                    counter INTEGER DEFAULT 1
                )
            `);

            // Initialize Zentro ticket counter if it doesn't exist
            this.db.run(`
                INSERT OR IGNORE INTO zentro_ticket_counter (id, counter) VALUES (1, 1)
            `);

            // Create giveaways table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS giveaways (
                    message_id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    creator_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    max_winners INTEGER NOT NULL,
                    end_time INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'active'
                )
            `);

            // Create giveaway entries table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS giveaway_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    giveaway_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(giveaway_id, user_id)
                )
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
            this.db.all('SELECT * FROM embed_data', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Reaction Role Methods
    async insertReactionRole(guildId, channelId, messageId, roleId, emojiId, emojiName, isUnicode) {
        return new Promise((resolve, reject) => {
            try {
                // First check if this combination already exists
                this.db.get(`
                    SELECT * FROM reaction_roles 
                    WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                `, [messageId, emojiId || '', emojiName || ''], (err, existing) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (existing) {
                        // Update existing record
                        this.db.run(`
                            UPDATE reaction_roles 
                            SET guild_id = ?, channel_id = ?, role_id = ?, is_unicode = ?
                            WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                        `, [guildId, channelId, roleId, isUnicode ? 1 : 0, messageId, emojiId || '', emojiName || ''], function(err) {
                            if (err) reject(err);
                            else resolve(this);
                        });
                    } else {
                        // Insert new record
                        this.db.run(`
                            INSERT INTO reaction_roles
                            (guild_id, channel_id, message_id, role_id, emoji_id, emoji_name, is_unicode)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [guildId, channelId, messageId, roleId, emojiId, emojiName, isUnicode ? 1 : 0], function(err) {
                            if (err) reject(err);
                            else resolve(this);
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async findReactionRoleByMessageAndEmoji(messageId, isUnicode, emojiKey) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🔍 Database query: messageId=${messageId}, isUnicode=${isUnicode}, emojiKey=${emojiKey}`);
                
                if (isUnicode) {
                    this.db.get(`
                        SELECT * FROM reaction_roles
                        WHERE message_id = ? AND is_unicode = 1 AND emoji_name = ?
                        LIMIT 1
                    `, [messageId, emojiKey], (err, row) => {
                        if (err) {
                            console.error(`❌ Database error:`, err);
                            reject(err);
                        } else {
                            console.log(`🔍 Database result:`, row);
                            resolve(row);
                        }
                    });
                } else {
                    this.db.get(`
                        SELECT * FROM reaction_roles
                        WHERE message_id = ? AND is_unicode = 0 AND emoji_id = ?
                        LIMIT 1
                    `, [messageId, emojiKey], (err, row) => {
                        if (err) {
                            console.error(`❌ Database error:`, err);
                            reject(err);
                        } else {
                            console.log(`🔍 Database result:`, row);
                            resolve(row);
                        }
                    });
                }
            } catch (error) {
                console.error(`❌ Database error in findReactionRoleByMessageAndEmoji:`, error);
                reject(error);
            }
        });
    }

    async getAllReactionRoles(guildId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM reaction_roles WHERE guild_id = ?', [guildId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async deleteReactionRole(messageId, emojiId, emojiName) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                DELETE FROM reaction_roles 
                WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
            `, [messageId, emojiId || '', emojiName || ''], function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async updateReactionRole(messageId, emojiId, emojiName, newRoleId, newText, newColor) {
        return new Promise((resolve, reject) => {
            // First get the current mapping
            this.db.get(`
                SELECT * FROM reaction_roles 
                WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
            `, [messageId, emojiId || '', emojiName || ''], (err, current) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (current) {
                    // Update the role
                    this.db.run(`
                        UPDATE reaction_roles 
                        SET role_id = ? 
                        WHERE message_id = ? AND emoji_id = ? AND emoji_name = ?
                    `, [newRoleId, messageId, emojiId || '', emojiName || ''], function(err) {
                        if (err) reject(err);
                        else resolve({ ...current, role_id: newRoleId, newText, newColor });
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    // Zentro Ticket Configuration Methods
    async saveZentoTicketConfig(guildId, channelId, roleId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO zentro_ticket_config (guild_id, channel_id, role_id) VALUES (?, ?, ?)',
                [guildId, channelId, roleId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getZentoTicketConfig(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM zentro_ticket_config WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Zentro Open Tickets Methods
    async saveOpenZentoTicket(userId, channelId, ticketNumber, randomNumber, ticketType, ticketData) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO zentro_open_tickets (user_id, channel_id, ticket_number, random_number, ticket_type, ticket_data) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, channelId, ticketNumber, randomNumber, ticketType, ticketData],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getOpenZentoTicket(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM zentro_open_tickets WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getOpenZentoTicketByChannel(channelId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM zentro_open_tickets WHERE channel_id = ?',
                [channelId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async deleteOpenZentoTicket(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM zentro_open_tickets WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Zentro Ticket Counter Methods
    async getZentoTicketCounter() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT counter FROM zentro_ticket_counter WHERE id = 1',
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.counter : 1);
                }
            );
        });
    }

    async incrementZentoTicketCounter() {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE zentro_ticket_counter SET counter = counter + 1 WHERE id = 1',
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    // Load all Zentro ticket data methods for startup
    async loadAllZentoTicketConfigs() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM zentro_ticket_config',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async loadAllZentoTickets() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM zentro_open_tickets',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Giveaway Methods
    async saveGiveaway(messageId, guildId, channelId, creatorId, name, description, maxWinners, endTime) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO giveaways (message_id, guild_id, channel_id, creator_id, name, description, max_winners, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [messageId, guildId, channelId, creatorId, name, description, maxWinners, endTime],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getGiveaway(messageId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM giveaways WHERE message_id = ?',
                [messageId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getAllActiveGiveaways() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM giveaways WHERE status = "active"',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async updateGiveawayStatus(messageId, status) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE giveaways SET status = ? WHERE message_id = ?',
                [status, messageId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async addGiveawayEntry(giveawayId, userId, guildId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, guild_id) VALUES (?, ?, ?)',
                [giveawayId, userId, guildId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async removeGiveawayEntry(giveawayId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?',
                [giveawayId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async getGiveawayEntries(giveawayId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM giveaway_entries WHERE giveaway_id = ?',
                [giveawayId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async deleteGiveaway(messageId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM giveaways WHERE message_id = ?',
                [messageId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async deleteGiveawayEntries(giveawayId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM giveaway_entries WHERE giveaway_id = ?',
                [giveawayId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;
