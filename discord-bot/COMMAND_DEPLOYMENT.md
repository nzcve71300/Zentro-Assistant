# Command Deployment Guide

## Problem: Duplicate Commands
If you're experiencing duplicate commands (e.g., opening 2 tickets when clicking once), it means commands are registered both globally and guild-specifically.

## Solution: Use Guild-Specific Commands Only

Since this bot is designed for a specific guild only, we use guild-specific commands for:
- Faster command updates (no 1-hour global cache delay)
- Easier management
- Avoiding duplicate registrations

## Deployment Steps

### 1. Clean Up Global Commands (One-time fix)
If you have duplicate commands, first clean up the global commands:

```bash
node cleanup-commands.js
```

### 2. Deploy Guild-Specific Commands
Always use the guild-specific deployment:

```bash
node deploy-commands-guild.js
```

### 3. Verify Commands
- Commands will be available immediately in your guild
- Check that each command appears only once in Discord

## Files Explained

- `deploy-commands-guild.js` - ✅ **USE THIS** for guild-specific commands
- `deploy-commands.js` - ❌ **DON'T USE** (global commands, kept for reference)
- `cleanup-commands.js` - 🧹 **USE ONCE** to remove global commands

## Environment Variables Required

Make sure your `.env` file has:
```
TOKEN=your_bot_token
CLIENT_ID=your_bot_client_id
GUILD_ID=your_guild_id
```

## Troubleshooting

If you still see duplicate commands:
1. Run `cleanup-commands.js` again
2. Wait a few minutes for Discord to update
3. Run `deploy-commands-guild.js`
4. Restart your bot

## Why Guild-Specific Commands?

- **Faster Updates**: No 1-hour global cache delay
- **Easier Testing**: Commands update immediately
- **Better Control**: Only available in your specific guild
- **No Duplicates**: Prevents accidental global registration
