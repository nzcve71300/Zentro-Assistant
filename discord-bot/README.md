# Discord Embed Bot

A Discord bot that creates rich embed messages with interactive customization options.

## Features

- **`/embed` command**: Creates a preview embed with three interactive buttons
- **Edit Text Field**: Modal popup to customize title and description
- **Edit Style**: Change embed color using hex codes
- **Send Button**: Publishes the final embed to the channel
- **Rich UI**: Beautiful buttons with emojis and proper styling
- **Footer**: "Powered by Zentro" footer on all embeds

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create a `.env` file** in the project root:
   ```
   TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   ```

3. **Get your bot credentials**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section and copy the token
   - Go to "General Information" and copy the Application ID (Client ID)
   - Paste both in your `.env` file

4. **Invite the bot to your server**:
   - Go to OAuth2 > URL Generator
   - Select "bot" scope
   - Select permissions: Send Messages, Use Slash Commands
   - Use the generated URL to invite the bot

5. **Deploy slash commands**:
   ```bash
   node deploy-commands.js
   ```

6. **Run the bot**:
   ```bash
   node index.js
   ```

## Usage

1. Type `/embed` in any channel
2. A preview embed will appear with three buttons:
   - **Edit Text Field** (✏️): Opens a modal to edit title and description
   - **Edit Style** (🎨): Opens a modal to change the embed color
   - **Send Embed** (📤): Sends the final embed to the channel

## Features in Detail

### Edit Text Field
- Modal with title and description inputs
- Placeholder text: "Enter embed title" and "Enter embed description"
- Default values: "Embed Preview" and "This is a test"
- Character limits: 256 for title, 4000 for description

### Edit Style
- Modal with color input field
- Accepts hex color codes (e.g., #0099ff)
- Validates hex format
- Shows error message for invalid colors

### Send Button
- Publishes the embed to the channel
- Includes "Powered by Zentro" footer
- Clears temporary data after sending

## Technical Details

- Built with Discord.js v14
- Uses ephemeral messages for previews
- Temporary data storage (use database for production)
- Proper error handling and validation
- Modern Discord API features (buttons, modals, embeds)

## Requirements

- Node.js 16.9.0 or higher
- Discord.js 14.x
- A Discord bot token 