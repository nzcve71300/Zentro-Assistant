# 🔐 Admin Role Setup Guide

This guide will help you set up the `[ZENTRO]Assistant` role system for your Discord bot.

## 📋 Overview

The bot now requires users to have the `[ZENTRO]Assistant` role to use any slash commands. This provides better security and control over who can access bot features.

## 🚀 Quick Setup

### Step 1: Create the Admin Role
```bash
node setup-admin-role.js
```

This script will:
- ✅ Create the `[ZENTRO]Assistant` role if it doesn't exist
- ✅ Set appropriate permissions (Manage Messages, Manage Channels, Manage Roles, Administrator)
- ✅ Auto-update the deployment script with the role ID
- ✅ Show you the role details and next steps

### Step 2: Deploy Updated Commands
```bash
node deploy-commands-guild-updated.js
```

This will deploy all commands with the new role restrictions.

### Step 3: Assign the Role
In Discord, assign the `[ZENTRO]Assistant` role to users who should have bot access:
```
/role [ZENTRO]Assistant @username
```

## 🔧 Manual Setup (Alternative)

If you prefer to do it manually:

### 1. Create Role Script
```bash
node create-admin-role.js
```

### 2. Get Role ID
```bash
node get-role-id.js
```

### 3. Update Deployment Script
Edit `deploy-commands-guild-updated.js` and replace `YOUR_ROLE_ID_HERE` with the actual role ID.

### 4. Deploy Commands
```bash
node deploy-commands-guild-updated.js
```

## 🧪 Testing

### Test with Admin Role
1. Assign the `[ZENTRO]Assistant` role to a test user
2. Try using any slash command (e.g., `/embed`)
3. ✅ Should work normally

### Test without Admin Role
1. Remove the `[ZENTRO]Assistant` role from a test user
2. Try using any slash command
3. ❌ Should show: "You need the **[ZENTRO]Assistant** role to use bot commands."

## 📁 Files Created/Modified

### New Files:
- `setup-admin-role.js` - Complete setup script
- `create-admin-role.js` - Role creation only
- `get-role-id.js` - Get role ID
- `deploy-commands-guild-updated.js` - Updated deployment script
- `ADMIN_ROLE_SETUP.md` - This guide

### Modified Files:
- `index.js` - Added role checking logic
- `deploy-commands-guild.js` - Added role ID placeholder

## 🔐 Security Features

- ✅ All slash commands require the admin role
- ✅ Button interactions still work for all users (for ticket system)
- ✅ Modal submissions still work for all users (for ticket system)
- ✅ Reaction role system still works for all users
- ✅ Guild restriction still applies (only works in specified guild)

## 🎯 Role Permissions

The `[ZENTRO]Assistant` role includes:
- **Manage Messages** - For message management commands
- **Manage Channels** - For channel operations
- **Manage Roles** - For role management
- **Administrator** - For full administrative access

## 🆘 Troubleshooting

### Role Not Found
- Make sure you're running the script in the correct guild
- Check that the guild ID in the script matches your server

### Commands Not Working
- Verify the role ID is correctly set in the deployment script
- Redeploy commands after updating the role ID
- Check that users have the role assigned

### Permission Errors
- Ensure the bot has the necessary permissions in the server
- Check that the bot role is above the `[ZENTRO]Assistant` role in the hierarchy

## 📞 Support

If you encounter any issues:
1. Check the console output for error messages
2. Verify all environment variables are set correctly
3. Ensure the bot has proper permissions in the Discord server
