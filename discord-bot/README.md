# Zentro Discord Bot

A Discord bot with ticket system and embed creation capabilities.

## Features

- **Ticket System**: Create and manage support and setup tickets
- **Embed Creator**: Interactive embed creation tool
- **Database Persistence**: All configuration and ticket data is now stored in SQLite database
- **Admin Commands**: Setup and manage ticket systems

## Database Integration

The bot now uses SQLite database to persist all configuration data, including:

- Ticket system configurations
- Support ticket configurations  
- Ticket categories
- Open tickets
- Ticket counter

This ensures that all settings persist across bot restarts, solving the issue where the bot would forget `/setup-ticket` configurations.

## Commands

### Admin Commands
- `/setup-ticket <channel> <role>` - Set up the main ticket system
- `/support-ticket-setup <channel> <role>` - Set up the support ticket system
- `/ticket-close` - Close a ticket (usable in ticket channels)

### User Commands
- `/embed` - Create and customize rich embeds

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your bot token:
```
TOKEN=your_discord_bot_token_here
```

3. Deploy slash commands:
```bash
node deploy-commands.js
```

4. Run the bot:
```bash
node index.js
```

## Database

The bot automatically creates a `bot_data.db` SQLite database file in the bot directory. This file contains all persistent data and should not be deleted.

## Files

- `index.js` - Main bot file
- `database.js` - Database management module
- `deploy-commands.js` - Slash command deployment
- `deploy-commands-guild.js` - Guild-specific command deployment
- `bot_data.db` - SQLite database (created automatically)

## Recent Changes

- Added SQLite database integration
- All ticket configurations now persist across bot restarts
- Fixed issue where bot would forget `/setup-ticket` settings
- Improved data management and reliability 