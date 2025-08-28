const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const GUILD_ID = '1385691441967267953';
const ROLE_NAME = '[ZENTRO]MEMBERS';
const ROLE_COLOR = '#FFA500'; // Orange color

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.error('❌ Bot is not in the specified guild!');
            process.exit(1);
        }

        // Check if role already exists
        const existingRole = guild.roles.cache.find(role => role.name === ROLE_NAME);
        if (existingRole) {
            console.log(`✅ Role "${ROLE_NAME}" already exists!`);
            console.log(`Role ID: ${existingRole.id}`);
            console.log(`Role Color: ${existingRole.hexColor}`);
            process.exit(0);
        }

        // Create the role
        const newRole = await guild.roles.create({
            name: ROLE_NAME,
            color: ROLE_COLOR,
            reason: 'Auto-created [ZENTRO]MEMBERS role for bot functionality',
            permissions: []
        });

        console.log(`✅ Successfully created role "${ROLE_NAME}"!`);
        console.log(`Role ID: ${newRole.id}`);
        console.log(`Role Color: ${newRole.hexColor}`);
        console.log(`Role Position: ${newRole.position}`);

    } catch (error) {
        console.error('❌ Error creating role:', error);
        if (error.code === 50013) {
            console.error('The bot needs "Manage Roles" permission to create roles.');
        }
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.TOKEN);
