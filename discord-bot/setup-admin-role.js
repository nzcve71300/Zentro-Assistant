const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const ALLOWED_GUILD_ID = '1385691441967267953';
const ADMIN_ROLE_NAME = '[ZENTRO]Assistant';

client.on('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    console.log(`🏠 Connected to guild: ${ALLOWED_GUILD_ID}`);
    
    try {
        const guild = client.guilds.cache.get(ALLOWED_GUILD_ID);
        if (!guild) {
            console.error('❌ Guild not found!');
            process.exit(1);
        }

        console.log(`✅ Found guild: ${guild.name} (${guild.id})`);

        // Check if role already exists
        let adminRole = guild.roles.cache.find(role => role.name === ADMIN_ROLE_NAME);
        
        if (adminRole) {
            console.log(`✅ Role "${ADMIN_ROLE_NAME}" already exists!`);
            console.log(`🆔 Role ID: ${adminRole.id}`);
        } else {
            // Create the admin role
            console.log(`🔨 Creating role: ${ADMIN_ROLE_NAME}`);
            
            adminRole = await guild.roles.create({
                name: ADMIN_ROLE_NAME,
                color: 0x00FF00, // Green color
                permissions: [
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageRoles,
                    PermissionFlagsBits.Administrator
                ],
                mentionable: true,
                reason: 'Created for Zentro Bot admin commands'
            });

            console.log(`✅ Successfully created role: ${adminRole.name}`);
            console.log(`🆔 Role ID: ${adminRole.id}`);
        }

        console.log(`🎨 Role Color: #${adminRole.color.toString(16).padStart(6, '0')}`);
        console.log(`🔐 Role Permissions: ${adminRole.permissions.toArray().join(', ')}`);
        console.log(`👥 Members with this role: ${adminRole.members.size}`);
        
        console.log('\n📋 Setup Complete! Next steps:');
        console.log('1. 📝 Update the deployment script with the role ID:');
        console.log(`   Replace 'YOUR_ROLE_ID_HERE' with: ${adminRole.id}`);
        console.log('2. 🚀 Deploy the updated commands:');
        console.log('   node deploy-commands-guild-updated.js');
        console.log('3. 👤 Assign the role to users who should have bot access:');
        console.log(`   /role ${ADMIN_ROLE_NAME} @username`);
        console.log('4. 🧪 Test commands with users who have/don\'t have the role');

        // Create a simple script to update the deployment file
        const fs = require('fs');
        const path = require('path');
        
        try {
            const deployScriptPath = path.join(__dirname, 'deploy-commands-guild-updated.js');
            let deployScript = fs.readFileSync(deployScriptPath, 'utf8');
            deployScript = deployScript.replace('YOUR_ROLE_ID_HERE', adminRole.id);
            fs.writeFileSync(deployScriptPath, deployScript);
            console.log('\n✅ Automatically updated deploy-commands-guild-updated.js with the role ID!');
        } catch (error) {
            console.log('\n⚠️  Could not auto-update deployment script. Please manually update it.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.destroy();
    }
});

client.on('error', error => {
    console.error('❌ Client error:', error);
});

client.login(process.env.TOKEN);
