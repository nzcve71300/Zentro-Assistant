const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'embed',
        description: 'Create a rich embed message with customization options',
        defaultMemberPermissions: '0'
    },
    {
        name: 'setup-ticket',
        description: 'Setup the ticket system in a channel with a staff role',
        options: [
            {
                name: 'channel',
                description: 'The channel to send the ticket panel to',
                type: 7, // CHANNEL
                required: true,
                channel_types: [0] // GUILD_TEXT
            },
            {
                name: 'role',
                description: 'The staff role allowed to help with tickets',
                type: 8, // ROLE
                required: true
            }
        ],
        defaultMemberPermissions: '0'
    },
    {
        name: 'support-ticket-setup',
        description: 'Setup the support ticket system in a channel with a staff role',
        options: [
            {
                name: 'channel',
                description: 'The channel to send the support ticket panel to',
                type: 7, // CHANNEL
                required: true,
                channel_types: [0] // GUILD_TEXT
            },
            {
                name: 'role',
                description: 'The staff role allowed to help with support tickets',
                type: 8, // ROLE
                required: true
            }
        ],
        defaultMemberPermissions: '0'
    },
    {
        name: 'ticket-close',
        description: 'Close the current ticket',
        defaultMemberPermissions: '0'
    },
    {
        name: 'send-role',
        description: 'Send a role assignment message with reaction',
        defaultMemberPermissions: '0'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing guild (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log('Successfully reloaded guild (/) commands.');
        console.log('Commands will be available immediately in your guild!');
    } catch (error) {
        console.error(error);
    }
})(); 