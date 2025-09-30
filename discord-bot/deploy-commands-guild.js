const { REST, Routes } = require('discord.js');
require('dotenv').config();

// Role ID for [ZENTRO]Assistant - UPDATE THIS AFTER CREATING THE ROLE
const ADMIN_ROLE_ID = 'YOUR_ROLE_ID_HERE'; // Run get-role-id.js to get this

const commands = [
    {
        name: 'embed',
        description: 'Create a rich embed message with customization options',
        defaultMemberPermissions: '0',
        dmPermission: false
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
        defaultMemberPermissions: '0',
        dmPermission: false
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
    },
    {
        name: 'cleanup-tickets',
        description: 'Clean up orphaned tickets (Admin only)',
        defaultMemberPermissions: '0'
    },
    {
        name: 'setup-rr',
        description: 'Create a reaction-role message that assigns a role when users react',
        options: [
            {
                name: 'role',
                description: 'Role to give/remove on reaction',
                type: 8, // ROLE
                required: true
            },
            {
                name: 'channel',
                description: 'Channel where the embed will be posted',
                type: 7, // CHANNEL
                required: true,
                channel_types: [0] // GUILD_TEXT
            },
            {
                name: 'text',
                description: 'Embed description text',
                type: 3, // STRING
                required: true
            },
            {
                name: 'color',
                description: 'Embed color (hex, e.g. #00ffff)',
                type: 3, // STRING
                required: true
            },
            {
                name: 'emoji',
                description: 'Emoji to react with (unicode 😎 or custom <:name:id>)',
                type: 3, // STRING
                required: true
            }
        ],
        defaultMemberPermissions: '0'
    },
    {
        name: 'remove-rr',
        description: 'Remove a reaction role from a message',
        options: [
            {
                name: 'message_id',
                description: 'ID of the message with the reaction role',
                type: 3, // STRING
                required: true
            },
            {
                name: 'emoji',
                description: 'Emoji to remove (unicode 😎 or custom <:name:id>)',
                type: 3, // STRING
                required: true
            }
        ],
        defaultMemberPermissions: '0'
    },
    {
        name: 'edit-rr',
        description: 'Edit an existing reaction role',
        options: [
            {
                name: 'message_id',
                description: 'ID of the message with the reaction role',
                type: 3, // STRING
                required: true
            },
            {
                name: 'emoji',
                description: 'Emoji to edit (unicode 😎 or custom <:name:id>)',
                type: 3, // STRING
                required: true
            },
            {
                name: 'new_role',
                description: 'New role to assign',
                type: 8, // ROLE
                required: true
            },
            {
                name: 'new_text',
                description: 'New embed description text',
                type: 3, // STRING
                required: true
            },
            {
                name: 'new_color',
                description: 'New embed color (hex, e.g. #00ffff)',
                type: 3, // STRING
                required: true
            }
        ],
        defaultMemberPermissions: '0'
    },
    {
        name: 'link-thread',
        description: 'Post a button that opens a specific thread',
        options: [
            {
                name: 'thread_url',
                description: 'Paste the thread link (Right-click thread → Copy Link)',
                type: 3, // STRING
                required: true
            },
            {
                name: 'channel',
                description: 'Where to post the button',
                type: 7, // CHANNEL
                required: true,
                channel_types: [0, 5] // GUILD_TEXT, GUILD_ANNOUNCEMENT
            },
            {
                name: 'label',
                description: 'Button text (default: Click for info)',
                type: 3, // STRING
                required: false
            },
            {
                name: 'text',
                description: 'Optional embed text above the button',
                type: 3, // STRING
                required: false
            },
            {
                name: 'color',
                description: 'Embed color hex (e.g. #00ffff)',
                type: 3, // STRING
                required: false
            }
        ],
        defaultMemberPermissions: '8192' // MANAGE_MESSAGES
    },
    {
        name: 'g-create',
        description: 'Create a new giveaway (Admin only)',
        defaultMemberPermissions: '0'
    },
    {
        name: 'g-close',
        description: 'Close an active giveaway (Admin only)',
        options: [
            {
                name: 'message_id',
                description: 'ID of the giveaway message to close',
                type: 3, // STRING
                required: true
            }
        ],
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