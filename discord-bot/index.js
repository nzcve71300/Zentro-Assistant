const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, SlashCommandBuilder, ChannelType, Partials } = require('discord.js');
require('dotenv').config();
const Database = require('./database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
    ]
});

// Initialize database
const db = new Database();

// Store embed data temporarily (in production, use a database)
const embedData = new Map();

// Ticket system state (will be loaded from database on startup)
const ticketConfig = new Map(); // guildId -> { channelId, roleId }
const supportTicketConfig = new Map(); // guildId -> { channelId, roleId }
const openTickets = new Map(); // userId -> { channelId, ticketNumber, randomNumber, type }
const ticketCategories = new Map(); // guildId -> { setupCategoryId, supportCategoryId }
let ticketCounter = 1;

const ALLOWED_GUILD_IDS = ['1385691441967267953', '1420879668248182840'];
const ADMIN_ROLE_NAME = '[ZENTRO]Assistant';

// Guild-specific configurations
const GUILD_CONFIGS = {
    '1385691441967267953': { // Original Zentro server
        promotionChannelId: '1405989727152242718',
        welcomeChannelId: '1417118808736534601',
        memberRoleId: '1410772028876787794'
    },
    '1420879668248182840': { // New guild
        promotionChannelId: null, // No promotion channel needed
        welcomeChannelId: '1420880434266374154',   // Your welcome channel
        memberRoleId: '1421093697491177513'        // Your member role
    }
};

client.on('guildCreate', guild => {
    if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
        guild.leave();
    }
});

client.on('ready', async () => {
    // If the bot is in any other guild, leave them
    client.guilds.cache.forEach(guild => {
        if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
            guild.leave();
        }
    });
    
    try {
        // Load all data from database
        await loadDataFromDatabase();
        
        // Restore existing ticket categories for all allowed guilds
        for (const guildId of ALLOWED_GUILD_IDS) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                await restoreTicketCategories(guild);
            }
        }
        
        console.log(`Logged in as ${client.user.tag}!`);
        console.log('Bot is ready! Use /embed to create rich embeds.');
        console.log('Database loaded successfully!');
    } catch (error) {
        console.error('Error loading data from database:', error);
    }
});

// Handle new member joins - automatically assign [ZENTRO]MEMBERS role
client.on('guildMemberAdd', async member => {
    if (!ALLOWED_GUILD_IDS.includes(member.guild.id)) return;
    
    const guildConfig = GUILD_CONFIGS[member.guild.id];
    if (!guildConfig || !guildConfig.memberRoleId) {
        console.log(`⚠️ No member role configured for guild ${member.guild.id}`);
        return;
    }
    
    try {
        // Find the [ZENTRO]MEMBERS role using the guild-specific role ID
        const memberRole = member.guild.roles.cache.get(guildConfig.memberRoleId);
        
        if (memberRole) {
            await member.roles.add(memberRole);
            console.log(`✅ Assigned [ZENTRO]MEMBERS role to ${member.user.tag} in ${member.guild.name}`);
        } else {
            console.log(`⚠️ [ZENTRO]MEMBERS role not found in ${member.guild.name}. Please create it manually.`);
        }
    } catch (error) {
        console.error('Error assigning role to new member:', error);
        if (error.code === 50013) {
            console.error('❌ Bot lacks permission to assign this role');
        }
    }
    
    // Send welcome message
    await sendWelcomeMessage(member);
});

// Handle member leaves - for tracking rejoins
client.on('guildMemberRemove', async member => {
    if (!ALLOWED_GUILD_IDS.includes(member.guild.id)) return;
    console.log(`👋 ${member.user.tag} left the server`);
});

// Welcome message function
async function sendWelcomeMessage(member) {
    try {
        const guildConfig = GUILD_CONFIGS[member.guild.id];
        if (!guildConfig || !guildConfig.welcomeChannelId) {
            console.log(`⚠️ No welcome channel configured for guild ${member.guild.id}`);
            return;
        }
        
        const welcomeChannel = member.guild.channels.cache.get(guildConfig.welcomeChannelId);
        if (!welcomeChannel) {
            console.log(`❌ Welcome channel not found in ${member.guild.name}`);
            return;
        }
        
        const memberCount = member.guild.memberCount;
        const orange = 0xFFA500;
        
        // Create a clean horizontal welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('**WELCOME TO ZENTRO**')
            .setDescription(`**Hey there, ${member.user}!**\n\n**You are our ${memberCount}${getOrdinalSuffix(memberCount)} member!**\n\nWelcome to the **ZENTRO** community! We're thrilled to have you join our amazing server. Get ready for an incredible experience with our premium Discord bot!`)
            .setColor(orange)
            .setThumbnail('https://i.imgur.com/Wl2DxPD.png')
            .setImage('https://i.imgur.com/Wl2DxPD.png')
            .addFields(
                {
                    name: '**Get Started**',
                    value: `[Buy or Setup Zentro](https://discord.com/channels/1385691441967267953/1385758548276809748) • [Read Terms of Service](https://discord.com/channels/1385691441967267953/1385760938220716172)`,
                    inline: false
                },
                {
                    name: '**Support & Help**',
                    value: `[Get Support](https://discord.com/channels/1385691441967267953/1404579611945209927) • [Helpful Information](https://discord.com/channels/1385691441967267953/1401677636085878907)`,
                    inline: false
                },
                {
                    name: '**Stay Updated**',
                    value: `[Latest Updates](https://discord.com/channels/1385691441967267953/1385692719245955254) • [Bot Updates](https://discord.com/channels/1385691441967267953/1401323995684667502)`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `Welcome to Zentro • Member #${memberCount}`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();
        
        await welcomeChannel.send({ 
            content: `**${member.user}** just joined the server! Welcome to Zentro!`,
            embeds: [welcomeEmbed]
        });
        
        // Send DM welcome message
        await sendDMWelcomeMessage(member, memberCount);
        
        console.log(`🎉 Sent welcome message for ${member.user.tag} (Member #${memberCount})`);
        
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
}

// Send DM welcome message
async function sendDMWelcomeMessage(member, memberCount) {
    try {
        const orange = 0xFFA500;
        
        const dmEmbed = new EmbedBuilder()
            .setTitle('**Welcome to Zentro!**')
            .setDescription(`**Hello ${member.user.username}!**\n\nThank you for joining the **ZENTRO** community! We are absolutely thrilled to have you become a part of our amazing server.\n\nAs our **${memberCount}${getOrdinalSuffix(memberCount)} member**, you are joining an incredible community of Discord server owners and bot enthusiasts who are passionate about creating the best possible experience for their users.\n\nWe hope you will have an absolutely wonderful time here and that you find everything you need to make your Discord server truly exceptional. Our team is always here to support you on your journey!\n\n**Welcome aboard, and enjoy your stay!**`)
            .setColor(orange)
            .setThumbnail('https://i.imgur.com/Wl2DxPD.png')
            .setImage('https://i.imgur.com/Wl2DxPD.png')
            .setFooter({ 
                text: 'Zentro • Premium Discord Bot', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();
        
        await member.send({ embeds: [dmEmbed] });
        console.log(`📩 Sent DM welcome to ${member.user.tag}`);
        
    } catch (error) {
        console.error('Error sending DM welcome message:', error);
        // Don't log if user has DMs disabled
        if (error.code !== 50007) {
            console.log(`Could not send DM to ${member.user.tag} (DMs may be disabled)`);
        }
    }
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) {
        return 'st';
    }
    if (j === 2 && k !== 12) {
        return 'nd';
    }
    if (j === 3 && k !== 13) {
        return 'rd';
    }
    return 'th';
}

client.on('interactionCreate', async interaction => {
    if (!isAllowedGuild(interaction)) {
        await interaction.reply({ content: 'This bot is only allowed in the official Zentro server.', ephemeral: true });
        return;
    }
    
    // Check for admin role on all slash commands
    if (interaction.isChatInputCommand() && !hasAdminRole(interaction)) {
        await interaction.reply({ 
            content: `❌ You need the **${ADMIN_ROLE_NAME}** role to use bot commands.`, 
            ephemeral: true 
        });
        return;
    }
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'embed') {
            await handleEmbedCommand(interaction);
        } else if (interaction.commandName === 'setup-ticket') {
            await handleSetupTicket(interaction);
        } else if (interaction.commandName === 'support-ticket-setup') {
            await handleSupportTicketSetup(interaction);
        } else if (interaction.commandName === 'ticket-close') {
            await handleTicketClose(interaction);
        } else if (interaction.commandName === 'send-role') {
            await handleSendRole(interaction);
        } else if (interaction.commandName === 'cleanup-tickets') {
            await handleCleanupTickets(interaction);
        } else if (interaction.commandName === 'setup-rr') {
            await handleSetupRR(interaction);
        } else if (interaction.commandName === 'remove-rr') {
            await handleRemoveRR(interaction);
        } else if (interaction.commandName === 'edit-rr') {
            await handleEditRR(interaction);
        } else if (interaction.commandName === 'link-thread') {
            await handleLinkThread(interaction);
        } else if (interaction.commandName === 'setup-zentro-ticket') {
            await handleSetupZentoTicket(interaction);
        }
    } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
});

// Handle reaction role events
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        if (user.bot) return;

        // Ensure full objects
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        if (!reaction.message.guild) return;

        console.log(`🔍 Reaction added: ${reaction.emoji.name || reaction.emoji.id} on message ${reaction.message.id}`);

        // Get reaction key
        const { isUnicode, key } = getReactionKey(reaction);
        if (key == null) {
            console.log(`❌ Invalid reaction key for emoji: ${reaction.emoji.name || reaction.emoji.id}`);
            return;
        }

        console.log(`🔍 Looking for reaction role mapping: messageId=${reaction.message.id}, isUnicode=${isUnicode}, key=${key}`);

        // Find the mapping
        const mapping = await db.findReactionRoleByMessageAndEmoji(
            reaction.message.id,
            isUnicode,
            key
        );
        
        if (!mapping) {
            console.log(`❌ No reaction role mapping found for message ${reaction.message.id}`);
            return;
        }

        console.log(`✅ Found mapping:`, mapping);

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        // Add role
        if (!member.roles.cache.has(mapping.role_id)) {
            await member.roles.add(mapping.role_id).catch(() => {});
            console.log(`✅ Added role ${mapping.role_id} to user ${user.id} via reaction`);
        }
    } catch (e) {
        console.error('MessageReactionAdd error:', e);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    try {
        if (user.bot) return;

        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        if (!reaction.message.guild) return;

        // Get reaction key
        const { isUnicode, key } = getReactionKey(reaction);
        if (key == null) return;

        // Find the mapping
        const mapping = await db.findReactionRoleByMessageAndEmoji(
            reaction.message.id,
            isUnicode,
            key
        );
        if (!mapping) return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        // Remove role
        if (member.roles.cache.has(mapping.role_id)) {
            await member.roles.remove(mapping.role_id).catch(() => {});
            console.log(`❌ Removed role ${mapping.role_id} from user ${user.id} via reaction`);
        }
    } catch (e) {
        console.error('MessageReactionRemove error:', e);
    }
});

// Helper function to get reaction key
function getReactionKey(reaction) {
    if (!reaction.emoji) return { isUnicode: null, key: null };
    if (reaction.emoji.id) {
        return { isUnicode: false, key: reaction.emoji.id };
    }
    return { isUnicode: true, key: reaction.emoji.name };
}

// Handle message events for link blocking
client.on('messageCreate', async message => {
    // Ignore bot messages and messages from other guilds
    if (message.author.bot || !ALLOWED_GUILD_IDS.includes(message.guildId)) return;
    
    // First check if this is a ticket channel or promotion channel - if so, allow all links
    const isAllowedChannel = await isTicketOrPromotionChannel(message.channel);
    if (isAllowedChannel) {
        return; // Allow all messages in ticket/promotion channels
    }
    
    // Check if the message contains a link
    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
    const hasLink = linkRegex.test(message.content);
    
    if (hasLink) {
        // Block the link - delete the message and send warning
        try {
            await message.delete();
            
            // Create warning embed
            const guildConfig = GUILD_CONFIGS[message.guildId];
            const promotionChannelMention = guildConfig && guildConfig.promotionChannelId 
                ? `<#${guildConfig.promotionChannelId}>` 
                : 'the promotion channel';
                
            const warningEmbed = new EmbedBuilder()
                .setTitle('🚫 Link Blocked')
                .setDescription(`Hello ${message.author}, Please don't send links in this channel. Use ${promotionChannelMention}`)
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });
            
            // Send warning message
            const warningMessage = await message.channel.send({ embeds: [warningEmbed] });
            
            // Delete the warning message after 10 seconds
            setTimeout(async () => {
                try {
                    await warningMessage.delete();
                } catch (error) {
                    // Ignore "Unknown Message" errors (message was already deleted)
                    if (error.code === 10008 || error.message === 'Unknown Message') {
                        console.log('Warning message was already deleted by user/moderator');
                    } else if (error.code === 'ChannelNotCached') {
                        console.log('Channel not cached when trying to delete warning message');
                    } else {
                        console.error('Failed to delete warning message:', error);
                    }
                }
            }, 10000);
            
            console.log(`🚫 Blocked link from ${message.author.tag} in channel ${message.channel.name} (${message.channel.id})`);
            
        } catch (error) {
            console.error('Error blocking link:', error);
        }
    }
});

// Helper function to check if a channel is a ticket channel or promotion channel
async function isTicketOrPromotionChannel(channel) {
    const guildConfig = GUILD_CONFIGS[channel.guildId];
    
    // Check if it's the promotion channel (forum channel)
    if (guildConfig && guildConfig.promotionChannelId && channel.id === guildConfig.promotionChannelId) {
        return true;
    }
    
    // Check if it's a forum post inside the promotion forum channel
    if (guildConfig && guildConfig.promotionChannelId && channel.parentId === guildConfig.promotionChannelId) {
        return true;
    }
    
    // Check if it's a ticket channel by looking for open tickets
    const ticket = await db.getOpenTicketByChannel(channel.id);
    if (ticket) {
        return true;
    }
    
    // Check if it's in a ticket category
    const guildId = channel.guildId;
    const categories = ticketCategories.get(guildId);
    if (categories && channel.parentId) {
        if (channel.parentId === categories.setupCategoryId || channel.parentId === categories.supportCategoryId) {
            return true;
        }
    }
    
    return false;
}

// Handle new forum posts - auto-react with ⬆️ emoji
client.on('threadCreate', async thread => {
    // Only handle threads in the allowed guilds
    if (!ALLOWED_GUILD_IDS.includes(thread.guildId)) return;
    
    const guildConfig = GUILD_CONFIGS[thread.guildId];
    
    // Check if this thread is in the promotion forum channel
    if (guildConfig && guildConfig.promotionChannelId && thread.parentId === guildConfig.promotionChannelId) {
        try {
            // React with ⬆️ emoji to the first message in the thread
            const firstMessage = await thread.fetchStarterMessage();
            if (firstMessage) {
                await firstMessage.react('⬆️');
                console.log(`✅ Auto-reacted to new forum post: ${thread.name} in promotion channel`);
            }
        } catch (error) {
            console.error('Error auto-reacting to forum post:', error);
        }
    }
});

async function handleEmbedCommand(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 **Embed Creator**')
        .setDescription('Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support')
        .setColor('#5865F2')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
            { name: '📋 **Current Settings**', value: 'Title: `Embed Preview`\nDescription: `This is a test`\nColor: `#5865F2`', inline: true },
            { name: '🎨 **Available Colors**', value: 'Red, Green, Blue, Pink, Purple, Yellow, Orange\nOr use hex codes like #FF0000', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Powered by Zentro • Rich Embed Creator', iconURL: client.user.displayAvatarURL() });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_text')
                .setLabel('Edit Text')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('edit_style')
                .setLabel('Customize Style')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎨'),
            new ButtonBuilder()
                .setCustomId('send_embed')
                .setLabel('Send Embed')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📤')
        );

    // Store initial embed data (guild-specific)
    const embedKey = `${interaction.user.id}_${interaction.guildId}`;
    embedData.set(embedKey, {
        title: '🎯 **Embed Creator**',
        description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
        color: '#5865F2',
        timestamp: true,
        thumbnail: true
    });

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

async function handleButtonInteraction(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Get configs from database
    const config = await db.getTicketConfig(guildId);
    const supportConfig = await db.getSupportTicketConfig(guildId);
    const orange = 0xFFA500;
    
    if (interaction.customId === 'zentro_setup') {
        if (!config) {
            await interaction.reply({ content: 'Ticket system is not configured. Please ask an admin to run /setup-ticket.', ephemeral: true });
            return;
        }
        
        // Check if user already has an open ticket
        const existingTicket = await db.getOpenTicket(userId);
        if (existingTicket) {
            await interaction.reply({ 
                content: `You already have an open ticket: <#${existingTicket.channel_id}>\nPlease close your existing ticket before opening a new one.`, 
                ephemeral: true 
            });
            return;
        }
        
        try {
            // Create private ticket channel
            const guild = interaction.guild;
            const staffRole = config.role_id;
            const ticketNumber = await db.getTicketCounter();
            await db.incrementTicketCounter();
            const randomNumber = Math.floor(Math.random() * 1000000);
            const channelName = `🟢| ${userId}${randomNumber}`;
            
            // Get or create setup category
            const categoryId = await getOrCreateTicketCategory(guild, 'setup');
            if (!categoryId) {
                await interaction.reply({ 
                    content: 'Failed to create ticket category. Please contact an administrator.', 
                    ephemeral: true 
                });
                return;
            }
            
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId, // Place channel under the category
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: ['ViewChannel'] },
                    { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                    { id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
                ]
            });
            
            // Save ticket to database
            await db.saveOpenTicket(userId, ticketChannel.id, ticketNumber, randomNumber, 'setup');
            openTickets.set(userId, { channelId: ticketChannel.id, ticketNumber, randomNumber, type: 'setup' });
            
            // Orange embed with instructions
            const embed = new EmbedBuilder()
                .setTitle('THANK YOU FOR PURCHASING ZENTRO BOT!')
                .setDescription('Zentro staff will answer your ticket as soon as possible.\n\n**Submit your setup info:**\n- An invite link to your discord server.\n- Your payment account email.\n\n**Legal Information**\nYou can view our terms of service:\n<https://discord.com/channels/1385691441967267953/1385760938220716172>')
                .setColor(orange)
                .setThumbnail('https://cdn.discordapp.com/attachments/1390084651057418352/1402975345941942344/Zentro-picture.png.png?ex=6895de1c&is=68948c9c&hm=fee1cf71e083a86406b8a90c2bf9f7035d07115c8962cf0ea2c7b9aed1455444&')
                .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('zentro_submit_info')
                        .setLabel('Submit Information')
                        .setStyle(ButtonStyle.Primary)
                );
            await ticketChannel.send({ content: `<@${userId}> <@&${staffRole}>`, embeds: [embed], components: [row] });
            
            // Ephemeral message in original channel
            await interaction.reply({
                content: `You have successfully opened a ticket here: <#${ticketChannel.id}>\n🟢 ticket number:${ticketNumber}`,
                ephemeral: true
            });
            
            console.log(`✅ Setup ticket created successfully for user ${userId}: ${ticketChannel.id}`);
            
        } catch (error) {
            console.error('❌ Error creating setup ticket:', error);
            await interaction.reply({ 
                content: 'An error occurred while creating your ticket. Please try again or contact an administrator.', 
                ephemeral: true 
            });
        }
    } else if (interaction.customId === 'support_ticket') {
        if (!supportConfig) {
            await interaction.reply({ content: 'Support ticket system is not configured. Please ask an admin to run /support-ticket-setup.', ephemeral: true });
            return;
        }
        
        // Check if user already has an open ticket
        const existingTicket = await db.getOpenTicket(userId);
        if (existingTicket) {
            await interaction.reply({ 
                content: `You already have an open ticket: <#${existingTicket.channel_id}>\nPlease close your existing ticket before opening a new one.`, 
                ephemeral: true 
            });
            return;
        }
        
        try {
            // Create private support ticket channel
            const guild = interaction.guild;
            const staffRole = supportConfig.role_id;
            const ticketNumber = await db.getTicketCounter();
            await db.incrementTicketCounter();
            const randomNumber = Math.floor(Math.random() * 1000000);
            const channelName = `🟢| ${userId}${randomNumber}`;
            
            // Get or create support category
            const categoryId = await getOrCreateTicketCategory(guild, 'support');
            if (!categoryId) {
                await interaction.reply({ 
                    content: 'Failed to create ticket category. Please contact an administrator.', 
                    ephemeral: true 
                });
                return;
            }
            
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId, // Place channel under the category
                permissionOverwrites: [
                    { id: guild.roles.everyone, deny: ['ViewChannel'] },
                    { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                    { id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
                ]
            });
            
            // Save ticket to database
            await db.saveOpenTicket(userId, ticketChannel.id, ticketNumber, randomNumber, 'support');
            openTickets.set(userId, { channelId: ticketChannel.id, ticketNumber, randomNumber, type: 'support' });
            
            // Send initial message with submit button
            const embed = new EmbedBuilder()
                .setTitle('🎫 Support Ticket Opened')
                .setDescription(`Hello <@${userId}>, please enter a detailed description of what's happening by pressing the submit button below. This will help us solve your problem much faster!`)
                .setColor(orange)
                .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('support_submit_description')
                        .setLabel('Submit Description')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                );
            
            await ticketChannel.send({ content: `<@${userId}> <@&${staffRole}>`, embeds: [embed], components: [row] });
            
            // Ephemeral message in original channel
            await interaction.reply({
                content: `You have successfully opened a support ticket here: <#${ticketChannel.id}>\n🟢 ticket number:${ticketNumber}`,
                ephemeral: true
            });
            
            console.log(`✅ Support ticket created successfully for user ${userId}: ${ticketChannel.id}`);
            
        } catch (error) {
            console.error('❌ Error creating support ticket:', error);
            await interaction.reply({ 
                content: 'An error occurred while creating your ticket. Please try again or contact an administrator.', 
                ephemeral: true 
            });
        }
    } else if (interaction.customId === 'zentro_purchase') {
        const orange = 0xFFA500;
        const embed = new EmbedBuilder()
            .setTitle('Buy ZENTRO BOT here')
            .setDescription('Click the button below to purchase ZENTRO BOT!')
            .setColor(orange)
            .setFooter({ text: 'Powered by Zentro', iconURL: interaction.client.user.displayAvatarURL() });
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('BUY ZENTRO-BOT')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://zentrobot.netlify.app/')
            );
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } else if (interaction.customId === 'zentro_submit_info') {
        // Modal for info submission
        const modal = new ModalBuilder()
            .setCustomId('zentro_info_modal')
            .setTitle('Submit Your Setup Information');
        const inviteInput = new TextInputBuilder()
            .setCustomId('zentro_invite')
            .setLabel('Discord Server Invite Link')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://discord.gg/yourserver')
            .setRequired(true);
        const emailInput = new TextInputBuilder()
            .setCustomId('zentro_email')
            .setLabel('Payment Account Email')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('your@email.com')
            .setRequired(true);
        modal.addComponents(
            new ActionRowBuilder().addComponents(inviteInput),
            new ActionRowBuilder().addComponents(emailInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'support_submit_description') {
        // Modal for support description
        const modal = new ModalBuilder()
            .setCustomId('support_description_modal')
            .setTitle('Describe Your Problem');
        const descriptionInput = new TextInputBuilder()
            .setCustomId('support_description')
            .setLabel('Describe your problem')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Please provide a detailed description of your issue...')
            .setRequired(true)
            .setMaxLength(4000);
        modal.addComponents(
            new ActionRowBuilder().addComponents(descriptionInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'edit_text') {
        // Get embed data for this user and guild
        const embedKey = `${userId}_${guildId}`;
        const data = embedData.get(embedKey) || {
            title: '🎯 **Embed Creator**',
            description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
            color: '#5865F2',
            timestamp: true,
            thumbnail: true
        };
        
        // Modal for editing embed text
        const modal = new ModalBuilder()
            .setCustomId('embed_text_modal')
            .setTitle('Edit Embed Text');
        const titleInput = new TextInputBuilder()
            .setCustomId('embed_title')
            .setLabel('Embed Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the embed title...')
            .setValue(data.title || '🎯 **Embed Creator**')
            .setRequired(false);
        const descriptionInput = new TextInputBuilder()
            .setCustomId('embed_description')
            .setLabel('Embed Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the embed description...')
            .setValue(data.description || 'Create beautiful, rich embeds with this powerful tool!')
            .setRequired(false);
        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'edit_style') {
        // Get embed data for this user and guild
        const embedKey = `${userId}_${guildId}`;
        const data = embedData.get(embedKey) || {
            title: '🎯 **Embed Creator**',
            description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
            color: '#5865F2',
            timestamp: true,
            thumbnail: true
        };
        
        // Modal for editing embed style
        const modal = new ModalBuilder()
            .setCustomId('embed_style_modal')
            .setTitle('Customize Embed Style');
        const colorInput = new TextInputBuilder()
            .setCustomId('embed_color')
            .setLabel('Embed Color (Hex Code or Color Name)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('#0099ff or Red, Green, Blue, Pink, Purple, Yellow, Orange')
            .setValue(data.color || '#5865F2')
            .setRequired(false);
        modal.addComponents(
            new ActionRowBuilder().addComponents(colorInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'send_embed') {
        // Get embed data for this user and guild
        const embedKey = `${userId}_${guildId}`;
        const data = embedData.get(embedKey) || {
            title: '🎯 **Embed Creator**',
            description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
            color: '#5865F2',
            timestamp: true,
            thumbnail: true
        };
        
        // Send the embed to the channel
        const embed = new EmbedBuilder()
            .setTitle(data.title)
            .setDescription(data.description)
            .setColor(data.color)
            .setTimestamp(data.timestamp ? new Date() : null)
            .setThumbnail(data.thumbnail ? interaction.client.user.displayAvatarURL() : null)
            .setFooter({ text: 'Powered by Zentro • Rich Embed Creator', iconURL: interaction.client.user.displayAvatarURL() });
        
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Embed sent successfully!', ephemeral: true });
    } else if (interaction.customId === 'rust_help') {
        // Modal for Rust help
        const modal = new ModalBuilder()
            .setCustomId('rust_help_modal')
            .setTitle('Rust Help Request');
        const ignInput = new TextInputBuilder()
            .setCustomId('rust_ign')
            .setLabel('What is your in-game name?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your in-game name...')
            .setRequired(true);
        const helpInput = new TextInputBuilder()
            .setCustomId('rust_help_description')
            .setLabel('How can we help?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe your issue or question...')
            .setRequired(true)
            .setMaxLength(1000);
        modal.addComponents(
            new ActionRowBuilder().addComponents(ignInput),
            new ActionRowBuilder().addComponents(helpInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'discord_help') {
        // Modal for Discord help
        const modal = new ModalBuilder()
            .setCustomId('discord_help_modal')
            .setTitle('Discord Help Request');
        const helpInput = new TextInputBuilder()
            .setCustomId('discord_help_description')
            .setLabel('How can we help?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe your Discord issue or question...')
            .setRequired(true)
            .setMaxLength(1000);
        modal.addComponents(
            new ActionRowBuilder().addComponents(helpInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'purchase_help') {
        // Modal for Purchase help
        const modal = new ModalBuilder()
            .setCustomId('purchase_help_modal')
            .setTitle('Purchase Help Request');
        const helpInput = new TextInputBuilder()
            .setCustomId('purchase_help_description')
            .setLabel('How can we help?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe your purchase issue or question...')
            .setRequired(true)
            .setMaxLength(1000);
        modal.addComponents(
            new ActionRowBuilder().addComponents(helpInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'verify_purchase') {
        // Modal for Verify Purchase
        const modal = new ModalBuilder()
            .setCustomId('verify_purchase_modal')
            .setTitle('Verify Purchase');
        const emailInput = new TextInputBuilder()
            .setCustomId('verify_email')
            .setLabel('Email used to purchase')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the email you used for purchase...')
            .setRequired(true);
        const purchaseInput = new TextInputBuilder()
            .setCustomId('verify_purchase_item')
            .setLabel('What did you purchase?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe what you purchased...')
            .setRequired(true)
            .setMaxLength(1000);
        modal.addComponents(
            new ActionRowBuilder().addComponents(emailInput),
            new ActionRowBuilder().addComponents(purchaseInput)
        );
        await interaction.showModal(modal);
    } else if (interaction.customId === 'claim_ticket') {
        // Handle claim ticket button
        await handleClaimTicket(interaction);
    } else if (interaction.customId === 'close_zentro_ticket') {
        // Handle close ticket button
        await handleCloseZentoTicket(interaction);
    }
}

async function handleModalSubmit(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const embedKey = `${userId}_${guildId}`; // Make embed data guild-specific
    
    let data = await db.getEmbedData(embedKey);
    if (!data) {
        data = {
            title: '🎯 **Embed Creator**',
            description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
            color: '#5865F2',
            timestamp: true,
            thumbnail: true
        };
    }

    if (interaction.customId === 'embed_text_modal') {
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');

        data.title = title || '🎯 **Embed Creator**';
        data.description = description || 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes or color names\n• 📤 Send professional embeds\n• 🎯 Rich formatting support';

        // Save embed data to database
        await db.saveEmbedData(embedKey, data);
        // Also update the local Map for immediate use
        embedData.set(embedKey, data);

        const embed = new EmbedBuilder()
            .setTitle(data.title)
            .setDescription(data.description)
            .setColor(data.color)
            .setTimestamp(data.timestamp ? new Date() : null)
            .setThumbnail(data.thumbnail ? interaction.client.user.displayAvatarURL() : null)
            .setFooter({ text: 'Powered by Zentro • Rich Embed Creator', iconURL: interaction.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_text')
                    .setLabel('Edit Text')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId('edit_style')
                    .setLabel('Customize Style')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎨'),
                new ButtonBuilder()
                    .setCustomId('send_embed')
                    .setLabel('Send Embed')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📤')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } else if (interaction.customId === 'embed_style_modal') {
        const colorInput = interaction.fields.getTextInputValue('embed_color');
        
        // Convert color name to hex or use as is
        const color = getColorHex(colorInput);
        
        // Validate hex color (after conversion)
        const hexRegex = /^#[0-9A-F]{6}$/i;
        if (!hexRegex.test(color)) {
            await interaction.reply({ content: 'Please enter a valid hex color code (e.g., #0099ff) or color name (Red, Green, Blue, Pink, Purple, Yellow, Orange)', ephemeral: true });
            return;
        }

        data.color = color;
        // Save embed data to database
        await db.saveEmbedData(embedKey, data);
        // Also update the local Map for immediate use
        embedData.set(embedKey, data);

        const embed = new EmbedBuilder()
            .setTitle(data.title)
            .setDescription(data.description)
            .setColor(data.color)
            .setTimestamp(data.timestamp ? new Date() : null)
            .setThumbnail(data.thumbnail ? interaction.client.user.displayAvatarURL() : null)
            .setFooter({ text: 'Powered by Zentro • Rich Embed Creator', iconURL: interaction.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_text')
                    .setLabel('Edit Text')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId('edit_style')
                    .setLabel('Customize Style')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎨'),
                new ButtonBuilder()
                    .setCustomId('send_embed')
                    .setLabel('Send Embed')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📤')
            );

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } else if (interaction.customId === 'zentro_info_modal') {
        const invite = interaction.fields.getTextInputValue('zentro_invite');
        const email = interaction.fields.getTextInputValue('zentro_email');
        const orange = 0xFFA500;
        const embed = new EmbedBuilder()
            .setTitle('Setup Information Submitted')
            .setDescription(`**Invite Link:** ${invite}\n**Payment Email:** ${email}`)
            .setColor(orange)
            .setFooter({ text: 'Powered by Zentro', iconURL: interaction.client.user.displayAvatarURL() });
        await interaction.reply({ embeds: [embed] });
    } else if (interaction.customId === 'support_description_modal') {
        const description = interaction.fields.getTextInputValue('support_description');
        const orange = 0xFFA500;
        const embed = new EmbedBuilder()
            .setTitle('📝 Problem Description Submitted')
            .setDescription(`**User:** <@${userId}>\n**Description:**\n${description}`)
            .setColor(orange)
            .setFooter({ text: 'Powered by Zentro', iconURL: interaction.client.user.displayAvatarURL() });
        await interaction.reply({ embeds: [embed] });
    } else if (interaction.customId === 'rust_help_modal') {
        const ign = interaction.fields.getTextInputValue('rust_ign');
        const helpDescription = interaction.fields.getTextInputValue('rust_help_description');
        await createZentoTicket(interaction, 'rust', { ign, helpDescription });
    } else if (interaction.customId === 'discord_help_modal') {
        const helpDescription = interaction.fields.getTextInputValue('discord_help_description');
        await createZentoTicket(interaction, 'discord', { helpDescription });
    } else if (interaction.customId === 'purchase_help_modal') {
        const helpDescription = interaction.fields.getTextInputValue('purchase_help_description');
        await createZentoTicket(interaction, 'purchase', { helpDescription });
    } else if (interaction.customId === 'verify_purchase_modal') {
        const email = interaction.fields.getTextInputValue('verify_email');
        const purchaseItem = interaction.fields.getTextInputValue('verify_purchase_item');
        await createZentoTicket(interaction, 'verify', { email, purchaseItem });
    }
}

async function handleSetupTicket(interaction) {
    // Only allow admins
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'You need to be an administrator to use this command.', ephemeral: true });
        return;
    }
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    if (!channel || !role) {
        await interaction.reply({ content: 'You must specify both a channel and a role.', ephemeral: true });
        return;
    }
    // Save config for this guild to database
    await db.saveTicketConfig(interaction.guildId, channel.id, role.id);
    ticketConfig.set(interaction.guildId, { channelId: channel.id, roleId: role.id });

    // Orange color
    const orange = 0xFFA500;
    const embed = new EmbedBuilder()
        .setTitle('Zentro Bot Ticket System')
        .setDescription('If you wish to purchase Zentro bot press the blue button below\n\nIf you already purchased Zentro bot open a setup ticket by pressing the green button below')
        .setColor(orange)
        .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('zentro_purchase')
                .setLabel('Purchase')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('zentro_setup')
                .setLabel('Setup')
                .setStyle(ButtonStyle.Success)
        );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `Ticket panel sent to ${channel}.`, ephemeral: true });
}

async function handleSupportTicketSetup(interaction) {
    // Only allow admins
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'You need to be an administrator to use this command.', ephemeral: true });
        return;
    }
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    if (!channel || !role) {
        await interaction.reply({ content: 'You must specify both a channel and a role.', ephemeral: true });
        return;
    }
    // Save config for this guild to database
    await db.saveSupportTicketConfig(interaction.guildId, channel.id, role.id);
    supportTicketConfig.set(interaction.guildId, { channelId: channel.id, roleId: role.id });

    // Orange color
    const orange = 0xFFA500;
    const embed = new EmbedBuilder()
        .setTitle('🎫 Zentro Support System')
        .setDescription('Please click the [SUPPORT] button below to open a ticket!\n\nPlease be patient and describe your problem as much as possible so staff can assist you as quickly as possible!')
        .setColor(orange)
        .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('support_ticket')
                .setLabel('SUPPORT')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🆘')
        );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `Support ticket panel sent to ${channel}.`, ephemeral: true });
}

async function handleTicketClose(interaction) {
    // Only allow in ticket channels
    const ticket = await db.getOpenTicketByChannel(interaction.channel.id);
    if (!ticket) {
        await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
        return;
    }
    const userId = ticket.user_id;
    const orange = 0xFFA500;
    
    // Update channel name to closed format
    try {
        await interaction.channel.setName(`🏁| ${userId}${ticket.random_number}`);
    } catch (error) {
        console.error('Failed to rename channel:', error);
    }
    
    // Send finish message in channel
    const finishEmbed = new EmbedBuilder()
        .setTitle('🏁 Ticket Closed')
        .setDescription(`🏁 ticket number:${ticket.ticket_number}`)
        .setColor(orange)
        .setFooter({ text: 'Powered by Zentro', iconURL: interaction.client.user.displayAvatarURL() });
    await interaction.channel.send({ embeds: [finishEmbed] });
    
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (error) {
            console.error('Failed to delete channel:', error);
        }
    }, 60000); // 1 minute
    
    // DM user based on ticket type
    const user = await interaction.client.users.fetch(userId);
    const dmEmbed = new EmbedBuilder()
        .setTitle('ZENTRO BOT')
        .setColor(orange)
        .setFooter({ text: 'Powered by Zentro', iconURL: 'https://cdn.discordapp.com/attachments/1390084651057418352/1402975345941942344/Zentro-picture.png.png?ex=6895de1c&is=68948c9c&hm=fee1cf71e083a86406b8a90c2bf9f7035d07115c8962cf0ea2c7b9aed1455444&' })
        .setImage('https://cdn.discordapp.com/attachments/1390084651057418352/1402975345941942344/Zentro-picture.png.png?ex=6895de1c&is=68948c9c&hm=fee1cf71e083a86406b8a90c2bf9f7035d07115c8962cf0ea2c7b9aed1455444&');
    
    if (ticket.type === 'support') {
        dmEmbed.setDescription('Thanks for using Zentro! We hope that you enjoyed the support experience. If you need any more help, feel free to open a ticket again!');
    } else {
        dmEmbed.setDescription('Your ticket was successfully closed thank you for using our service!\nIf you need further support feel free to open a ticket again at any time our staff will happily assist you!');
    }
    
    try {
        await user.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.error('Failed to send DM:', error);
    }
    
    await interaction.reply({ content: 'Ticket will be closed and channel deleted in 1 minute.', ephemeral: true });
    
    // Remove ticket from database and memory
    await db.deleteOpenTicket(userId);
    openTickets.delete(userId);
}

function isAllowedGuild(interaction) {
    return ALLOWED_GUILD_IDS.includes(interaction.guildId);
}

function hasAdminRole(interaction) {
    if (!interaction.member) return false;
    return interaction.member.roles.cache.some(role => role.name === ADMIN_ROLE_NAME);
}

// Function to convert color names to hex codes
function getColorHex(colorInput) {
    const colorMap = {
        'red': '#FF0000',
        'green': '#00FF00', 
        'blue': '#0000FF',
        'pink': '#FF69B4',
        'purple': '#800080',
        'yellow': '#FFFF00',
        'orange': '#FFA500'
    };
    
    // Convert to lowercase for case-insensitive matching
    const colorLower = colorInput.toLowerCase().trim();
    
    // Check if it's a color name
    if (colorMap[colorLower]) {
        return colorMap[colorLower];
    }
    
    // If it's already a hex code, return as is
    return colorInput;
}

// Function to load all data from database on startup
async function loadDataFromDatabase() {
    try {
        // Load ticket configurations
        const ticketConfigs = await db.loadAllTicketConfigs();
        ticketConfigs.forEach(config => {
            ticketConfig.set(config.guild_id, { 
                channelId: config.channel_id, 
                roleId: config.role_id 
            });
        });
        console.log(`Loaded ${ticketConfigs.length} ticket configurations`);

        // Load support ticket configurations
        const supportTicketConfigs = await db.loadAllSupportTicketConfigs();
        supportTicketConfigs.forEach(config => {
            supportTicketConfig.set(config.guild_id, { 
                channelId: config.channel_id, 
                roleId: config.role_id 
            });
        });
        console.log(`Loaded ${supportTicketConfigs.length} support ticket configurations`);

        // Load ticket categories
        const ticketCategoriesData = await db.loadAllTicketCategories();
        ticketCategoriesData.forEach(category => {
            ticketCategories.set(category.guild_id, {
                setupCategoryId: category.setup_category_id,
                supportCategoryId: category.support_category_id
            });
        });
        console.log(`Loaded ${ticketCategoriesData.length} ticket category configurations`);

        // Load open tickets
        const openTicketsData = await db.loadAllOpenTickets();
        openTicketsData.forEach(ticket => {
            openTickets.set(ticket.user_id, {
                channelId: ticket.channel_id,
                ticketNumber: ticket.ticket_number,
                randomNumber: ticket.random_number,
                type: ticket.type
            });
        });
        console.log(`Loaded ${openTicketsData.length} open tickets`);

        // Load ticket counter
        ticketCounter = await db.getTicketCounter();
        console.log(`Loaded ticket counter: ${ticketCounter}`);

        // Load embed data (handle case where table might not exist yet)
        try {
            const embedDataArray = await db.loadAllEmbedData();
            embedDataArray.forEach(embed => {
                embedData.set(embed.user_id, {
                    title: embed.title,
                    description: embed.description,
                    color: embed.color,
                    timestamp: embed.timestamp === 1,
                    thumbnail: embed.thumbnail === 1
                });
            });
            console.log(`Loaded ${embedDataArray.length} embed data entries`);
        } catch (error) {
            console.log('Embed data table not available yet, will be created on first use');
            // This is normal for existing databases that don't have the embed_data table yet
        }

    } catch (error) {
        console.error('Error loading data from database:', error);
        throw error;
    }
}

// Helper function to get or create ticket categories
async function getOrCreateTicketCategory(guild, categoryType) {
    const guildId = guild.id;
    let categories = ticketCategories.get(guildId);
    
    if (!categories) {
        categories = { setupCategoryId: null, supportCategoryId: null };
        ticketCategories.set(guildId, categories);
    }
    
    let categoryId = categories[`${categoryType}CategoryId`];
    
    // If category doesn't exist, create it
    if (!categoryId) {
        let categoryName, categoryColor;
        
        if (categoryType === 'setup') {
            categoryName = '🟢 Zentro Setup Tickets';
            categoryColor = 0x00FF00; // Green
        } else if (categoryType === 'support') {
            categoryName = '🆘 Zentro Support Tickets';
            categoryColor = 0xFF0000; // Red
        }
        
        try {
            const category = await guild.channels.create({
                name: categoryName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: ['ViewChannel']
                    }
                ]
            });
            
            categoryId = category.id;
            categories[`${categoryType}CategoryId`] = categoryId;
            ticketCategories.set(guildId, categories);
            
            // Save to database
            const dbCategories = await db.getTicketCategories(guildId);
            if (dbCategories) {
                const updateData = { ...dbCategories };
                updateData[`${categoryType}_category_id`] = categoryId;
                await db.saveTicketCategories(guildId, updateData.setup_category_id, updateData.support_category_id);
            } else {
                if (categoryType === 'setup') {
                    await db.saveTicketCategories(guildId, categoryId, null);
                } else {
                    await db.saveTicketCategories(guildId, null, categoryId);
                }
            }
            
            console.log(`Created ${categoryType} category: ${categoryName} (${categoryId})`);
        } catch (error) {
            console.error(`Failed to create ${categoryType} category:`, error);
            return null;
        }
    }
    
    return categoryId;
}

// Function to restore existing ticket categories on bot startup
async function restoreTicketCategories(guild) {
    const guildId = guild.id;
    let categories = ticketCategories.get(guildId);
    
    if (!categories) {
        categories = { setupCategoryId: null, supportCategoryId: null };
        ticketCategories.set(guildId, categories);
    }
    
    // Load categories from database
    const dbCategories = await db.getTicketCategories(guildId);
    if (dbCategories) {
        categories.setupCategoryId = dbCategories.setup_category_id;
        categories.supportCategoryId = dbCategories.support_category_id;
        console.log(`Loaded categories from database for guild ${guildId}`);
    }
    
    // Check for existing categories in Discord (fallback)
    const existingCategories = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildCategory && 
        (channel.name === '🟢 Zentro Setup Tickets' || channel.name === '🆘 Zentro Support Tickets')
    );
    
    existingCategories.forEach(category => {
        if (category.name === '🟢 Zentro Setup Tickets') {
            categories.setupCategoryId = category.id;
            console.log(`Restored setup category: ${category.name} (${category.id})`);
        } else if (category.name === '🆘 Zentro Support Tickets') {
            categories.supportCategoryId = category.id;
            console.log(`Restored support category: ${category.name} (${category.id})`);
        }
    });
    
    ticketCategories.set(guildId, categories);
}

// Handle the /send-role command
async function handleSendRole(interaction) {
    try {
        // Check if user has permission to manage roles
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({ 
                content: '❌ You need the "Manage Roles" permission to use this command.', 
                ephemeral: true 
            });
            return;
        }

        // Create the role assignment embed
        const embed = new EmbedBuilder()
            .setTitle('🎯 **Role Assignment**')
            .setDescription('**Please react to obtain the Announcement role**\n\nClick the ⚙️ emoji below to get the **[ZENTRO]MEMBERS** role and stay updated with all our announcements!')
            .setColor('#FFA500') // Orange color
            .setTimestamp()
            .setFooter({ 
                text: 'Zentro • Role Assignment', 
                iconURL: client.user.displayAvatarURL() 
            });

        // Send the embed
        const message = await interaction.channel.send({ embeds: [embed] });
        
        // Add the gear emoji reaction
        await message.react('⚙️');
        
        await interaction.reply({ 
            content: '✅ Role assignment message sent successfully!', 
            ephemeral: true 
        });
        
    } catch (error) {
        console.error('Error in handleSendRole:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while sending the role assignment message.', 
            ephemeral: true 
        });
    }
}

// Handle the /cleanup-tickets command
async function handleCleanupTickets(interaction) {
    try {
        // Only allow admins
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need to be an administrator to use this command.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Get all open tickets from database
        const openTicketsData = await db.loadAllOpenTickets();
        let cleanedCount = 0;
        let validCount = 0;

        for (const ticket of openTicketsData) {
            try {
                // Try to fetch the channel
                const channel = await interaction.client.channels.fetch(ticket.channel_id);
                if (channel) {
                    validCount++;
                    console.log(`✅ Valid ticket found: ${ticket.user_id} -> ${ticket.channel_id}`);
                } else {
                    // Channel doesn't exist, clean it up
                    await db.deleteOpenTicket(ticket.user_id);
                    openTickets.delete(ticket.user_id);
                    cleanedCount++;
                    console.log(`🧹 Cleaned up orphaned ticket: ${ticket.user_id} -> ${ticket.channel_id}`);
                }
            } catch (error) {
                // Channel fetch failed, clean it up
                await db.deleteOpenTicket(ticket.user_id);
                openTickets.delete(ticket.user_id);
                cleanedCount++;
                console.log(`🧹 Cleaned up orphaned ticket: ${ticket.user_id} -> ${ticket.channel_id} (fetch failed)`);
            }
        }

        await interaction.editReply({
            content: `🧹 **Ticket Cleanup Complete!**\n\n` +
                    `✅ **Valid Tickets:** ${validCount}\n` +
                    `🧹 **Cleaned Up:** ${cleanedCount}\n\n` +
                    `Total tickets processed: ${openTicketsData.length}`
        });

        console.log(`🎯 Ticket cleanup completed: ${validCount} valid, ${cleanedCount} cleaned up`);

    } catch (error) {
        console.error('❌ Error in handleCleanupTickets:', error);
        await interaction.editReply({
            content: '❌ An error occurred while cleaning up tickets. Check the console for details.'
        });
    }
}

// Handle the /setup-rr command
async function handleSetupRR(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const role = interaction.options.getRole('role', true);
        const channel = interaction.options.getChannel('channel', true);
        const text = interaction.options.getString('text', true);
        const color = interaction.options.getString('color', true);
        const emojiIn = interaction.options.getString('emoji', true);

        // Basic permission checks
        if (!channel || channel.type !== ChannelType.GuildText) {
            return interaction.editReply('❌ Please pick a text channel.');
        }
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.editReply('❌ I need **Manage Roles** permission.');
        }
        if (!interaction.guild.members.me.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply('❌ I can\'t send messages in that channel.');
        }

        // Parse emoji
        const parsed = parseEmoji(emojiIn);
        if (!parsed) {
            return interaction.editReply('❌ Invalid emoji format. Use unicode (😎) or custom emoji from this server (<:name:id>).');
        }

        // Parse color
        const colorInt = parseHexColor(color, 0x00ffff);

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('🎭 Reaction Role')
            .setDescription(text)
            .setColor(colorInt)
            .setFooter({ text: `React with ${parsed.isUnicode ? parsed.emojiName : `<:${parsed.emojiName}:${parsed.emojiId}>`} to get the ${role.name} role` })
            .setTimestamp();

        // Post the message
        const msg = await channel.send({ embeds: [embed] });

        // Add the reaction
        try {
            await msg.react(parsed.reactionIdentifier);
        } catch (e) {
            return interaction.editReply('❌ I couldn\'t add that emoji as a reaction. For custom emojis, use one from **this server**.');
        }

        // Save mapping
        await db.insertReactionRole(
            interaction.guild.id,
            channel.id,
            msg.id,
            role.id,
            parsed.emojiId,
            parsed.emojiName,
            parsed.isUnicode
        );

        await interaction.editReply(`✅ Reaction role set!\n• Channel: <#${channel.id}>\n• Role: <@&${role.id}>\n• Emoji: ${parsed.isUnicode ? parsed.emojiName : `<:${parsed.emojiName}:${parsed.emojiId}>`}\n\nUsers who react will get the role; removing the reaction removes the role.`);

    } catch (err) {
        console.error('/setup-rr error:', err);
        await interaction.editReply('⚠️ Something went wrong setting up the reaction role.');
    }
}

// Handle the /remove-rr command
async function handleRemoveRR(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id', true);
        const emojiIn = interaction.options.getString('emoji', true);

        // Parse emoji
        const parsed = parseEmoji(emojiIn);
        if (!parsed) {
            return interaction.editReply('❌ Invalid emoji format. Use unicode (😎) or custom emoji from this server (<:name:id>).');
        }

        // Find the mapping
        const mapping = await db.findReactionRoleByMessageAndEmoji(
            messageId,
            parsed.isUnicode,
            parsed.isUnicode ? parsed.emojiName : parsed.emojiId
        );

        if (!mapping) {
            return interaction.editReply('❌ No reaction role found with that message ID and emoji.');
        }

        // Remove from database
        await db.deleteReactionRole(messageId, parsed.emojiId, parsed.emojiName);

        // Try to remove the reaction from the message
        try {
            const channel = await interaction.client.channels.fetch(mapping.channel_id);
            if (channel) {
                const message = await channel.messages.fetch(messageId);
                if (message) {
                    await message.reactions.cache.get(parsed.reactionIdentifier)?.remove();
                }
            }
        } catch (e) {
            console.log('Could not remove reaction from message (message may have been deleted)');
        }

        await interaction.editReply(`✅ Reaction role removed!\n• Role: <@&${mapping.role_id}>\n• Emoji: ${parsed.isUnicode ? parsed.emojiName : `<:${parsed.emojiName}:${parsed.emojiId}>`}`);

    } catch (err) {
        console.error('/remove-rr error:', err);
        await interaction.editReply('⚠️ Something went wrong removing the reaction role.');
    }
}

// Handle the /edit-rr command
async function handleEditRR(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id', true);
        const emojiIn = interaction.options.getString('emoji', true);
        const newRole = interaction.options.getRole('new_role', true);
        const newText = interaction.options.getString('new_text', true);
        const newColor = interaction.options.getString('new_color', true);

        // Parse emoji
        const parsed = parseEmoji(emojiIn);
        if (!parsed) {
            return interaction.editReply('❌ Invalid emoji format. Use unicode (😎) or custom emoji from this server (<:name:id>).');
        }

        // Parse color
        const colorInt = parseHexColor(newColor, 0x00ffff);

        // Find the mapping
        const mapping = await db.findReactionRoleByMessageAndEmoji(
            messageId,
            parsed.isUnicode,
            parsed.isUnicode ? parsed.emojiName : parsed.emojiId
        );

        if (!mapping) {
            return interaction.editReply('❌ No reaction role found with that message ID and emoji.');
        }

        // Update in database
        const updated = await db.updateReactionRole(
            messageId,
            parsed.emojiId,
            parsed.emojiName,
            newRole.id,
            newText,
            newColor
        );

        if (!updated) {
            return interaction.editReply('❌ Failed to update the reaction role.');
        }

        // Try to update the message
        try {
            const channel = await interaction.client.channels.fetch(mapping.channel_id);
            if (channel) {
                const message = await channel.messages.fetch(messageId);
                if (message) {
                    const newEmbed = new EmbedBuilder()
                        .setTitle('🎭 Reaction Role')
                        .setDescription(newText)
                        .setColor(colorInt)
                        .setFooter({ text: `React with ${parsed.isUnicode ? parsed.emojiName : `<:${parsed.emojiName}:${parsed.emojiId}>`} to get the ${newRole.name} role` })
                        .setTimestamp();

                    await message.edit({ embeds: [newEmbed] });
                }
            }
        } catch (e) {
            console.log('Could not update message (message may have been deleted)');
        }

        await interaction.editReply(`✅ Reaction role updated!\n• New Role: <@&${newRole.id}>\n• New Text: ${newText}\n• New Color: ${newColor}\n• Emoji: ${parsed.isUnicode ? parsed.emojiName : `<:${parsed.emojiName}:${parsed.emojiId}>`}`);

    } catch (err) {
        console.error('/edit-rr error:', err);
        await interaction.editReply('⚠️ Something went wrong updating the reaction role.');
    }
}

// Helper function to parse emoji
function parseEmoji(input) {
    // Custom emoji like <:name:id> or <a:name:id>
    const custom = input.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
    if (custom) {
        const [, name, id] = custom;
        return {
            isUnicode: false,
            emojiId: id,
            emojiName: name,
            reactionIdentifier: input, // message.react accepts the full string for custom
        };
    }
    // Otherwise treat as unicode
    return {
        isUnicode: true,
        emojiId: null,
        emojiName: input,
        reactionIdentifier: input,
    };
}

// Handle the /link-thread command
async function handleLinkThread(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const url = interaction.options.getString("thread_url", true).trim();
        const channel = interaction.options.getChannel("channel", true);
        const label = interaction.options.getString("label") || "Click for info";
        const text = interaction.options.getString("text") || null;
        const color = parseHexColor(interaction.options.getString("color") || "#2b2d31");

        // Validate thread URL format
        const valid = /https?:\/\/(?:(?:ptb|canary)\.)?discord\.com\/channels\/\d+\/\d+/.test(url);
        if (!valid) {
            return interaction.editReply("❌ That doesn't look like a valid thread link. Right-click the thread → **Copy Link** and paste it here.");
        }

        // Check bot permissions in target channel
        const me = interaction.guild.members.me;
        if (!me.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply("❌ I can't send messages in that channel. Please adjust channel permissions.");
        }

        // Create the button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel(label)
                .setURL(url)
        );

        // Create the message payload
        const payload = text
            ? { embeds: [new EmbedBuilder().setDescription(text).setColor(color)], components: [row] }
            : { content: " ", components: [row] };

        // Send the message
        const sent = await channel.send(payload);
        await interaction.editReply(`✅ Posted in <#${channel.id}> • [Jump to message](${sent.url})`);

    } catch (err) {
        console.error('/link-thread error:', err);
        await interaction.editReply('⚠️ Something went wrong creating the thread link.');
    }
}

// Helper function to parse hex color
function parseHexColor(hex, fallback = 0x2b2d31) {
    if (!hex) return fallback;
    const cleaned = hex.replace(/^#/, '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
    return parseInt(cleaned, 16);
}

// Handle the /setup-zentro-ticket command
async function handleSetupZentoTicket(interaction) {
    try {
        // Only allow admins
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You need to be an administrator to use this command.', ephemeral: true });
            return;
        }

        const role = interaction.options.getRole('role');
        const channel = interaction.options.getChannel('channel');

        if (!role || !channel) {
            await interaction.reply({ content: 'You must specify both a role and a channel.', ephemeral: true });
            return;
        }

        // Save config for this guild to database
        await db.saveZentoTicketConfig(interaction.guildId, channel.id, role.id);

        // Orange color
        const orange = 0xFFA500;
        const embed = new EmbedBuilder()
            .setTitle('Welcome to Zentro support!')
            .setDescription('Please enter a brief description of what\'s happening so that staff can assist you As Soon As Possible!')
            .setColor(orange)
            .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rust_help')
                    .setLabel('Rust Help')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('discord_help')
                    .setLabel('Discord Help')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('purchase_help')
                    .setLabel('Purchase Help')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('verify_purchase')
                    .setLabel('Verify Purchase')
                    .setStyle(ButtonStyle.Success)
            );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `Zentro ticket panel sent to ${channel}.`, ephemeral: true });

    } catch (error) {
        console.error('Error in handleSetupZentoTicket:', error);
        await interaction.reply({ 
            content: 'An error occurred while setting up the Zentro ticket system.', 
            ephemeral: true 
        });
    }
}

// Create Zentro ticket
async function createZentoTicket(interaction, ticketType, data) {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // Check if user already has an open ticket
        const existingTicket = await db.getOpenZentoTicket(userId);
        if (existingTicket) {
            await interaction.reply({ 
                content: `You already have an open ticket: <#${existingTicket.channel_id}>\nPlease close your existing ticket before opening a new one.`, 
                ephemeral: true 
            });
            return;
        }

        // Get config
        const config = await db.getZentoTicketConfig(guildId);
        if (!config) {
            await interaction.reply({ content: 'Zentro ticket system is not configured. Please ask an admin to run /setup-zentro-ticket.', ephemeral: true });
            return;
        }

        const guild = interaction.guild;
        const staffRole = config.role_id;
        const ticketNumber = await db.getZentoTicketCounter();
        await db.incrementZentoTicketCounter();
        const randomNumber = Math.floor(Math.random() * 1000000);
        
        // Create category name based on ticket type
        let categoryName, categoryColor;
        switch (ticketType) {
            case 'rust':
                categoryName = '🦀 Rust Help Tickets';
                categoryColor = 0xFF0000; // Red
                break;
            case 'discord':
                categoryName = '💬 Discord Help Tickets';
                categoryColor = 0x0099FF; // Blue
                break;
            case 'purchase':
                categoryName = '💳 Purchase Help Tickets';
                categoryColor = 0x808080; // Grey
                break;
            case 'verify':
                categoryName = '✅ Verify Purchase Tickets';
                categoryColor = 0x00FF00; // Green
                break;
        }

        // Get or create category
        const categoryId = await getOrCreateZentoTicketCategory(guild, ticketType, categoryName, categoryColor);
        if (!categoryId) {
            await interaction.reply({ 
                content: 'Failed to create ticket category. Please contact an administrator.', 
                ephemeral: true 
            });
            return;
        }

        const channelName = `🎫| ${userId}${randomNumber}`;
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ['ViewChannel'] },
                { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                { id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
            ]
        });

        // Save ticket to database
        await db.saveOpenZentoTicket(userId, ticketChannel.id, ticketNumber, randomNumber, ticketType, JSON.stringify(data));
        
        // Create summary embed
        const orange = 0xFFA500;
        const summaryEmbed = new EmbedBuilder()
            .setTitle('Ticket Information')
            .setColor(orange)
            .setTimestamp()
            .setFooter({ text: 'Powered by Zentro', iconURL: client.user.displayAvatarURL() });

        // Add fields based on ticket type
        switch (ticketType) {
            case 'rust':
                summaryEmbed.addFields(
                    { name: 'Ticket Type', value: 'Rust Help', inline: true },
                    { name: 'In-Game Name', value: data.ign, inline: true },
                    { name: 'Description', value: data.helpDescription, inline: false }
                );
                break;
            case 'discord':
                summaryEmbed.addFields(
                    { name: 'Ticket Type', value: 'Discord Help', inline: true },
                    { name: 'Description', value: data.helpDescription, inline: false }
                );
                break;
            case 'purchase':
                summaryEmbed.addFields(
                    { name: 'Ticket Type', value: 'Purchase Help', inline: true },
                    { name: 'Description', value: data.helpDescription, inline: false }
                );
                break;
            case 'verify':
                summaryEmbed.addFields(
                    { name: 'Ticket Type', value: 'Verify Purchase', inline: true },
                    { name: 'Email', value: data.email, inline: true },
                    { name: 'Purchase Item', value: data.purchaseItem, inline: false }
                );
                break;
        }

        // Create management buttons
        const managementRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim Ticket')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('close_zentro_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send initial messages
        await ticketChannel.send({ 
            content: `Hold on, I'm calling the staff team - <@&${staffRole}>`,
            embeds: [summaryEmbed],
            components: [managementRow]
        });

        // Ephemeral reply
        await interaction.reply({
            content: `You have successfully opened a ticket here: <#${ticketChannel.id}>\nTicket number: ${ticketNumber}`,
            ephemeral: true
        });

        console.log(`✅ Zentro ticket created successfully for user ${userId}: ${ticketChannel.id}`);

    } catch (error) {
        console.error('❌ Error creating Zentro ticket:', error);
        await interaction.reply({ 
            content: 'An error occurred while creating your ticket. Please try again or contact an administrator.', 
            ephemeral: true 
        });
    }
}

// Handle claim ticket button
async function handleClaimTicket(interaction) {
    try {
        // Check if user has the required role
        const config = await db.getZentoTicketConfig(interaction.guildId);
        if (!config) {
            await interaction.reply({ content: 'Ticket system not configured.', ephemeral: true });
            return;
        }

        if (!interaction.member.roles.cache.has(config.role_id)) {
            await interaction.reply({ content: 'You do not have permission to claim tickets.', ephemeral: true });
            return;
        }

        // Update the claim button to show it's claimed
        const claimedRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claimed by ' + interaction.user.username)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('close_zentro_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({ components: [claimedRow] });
        await interaction.followUp({ 
            content: `Ticket claimed by ${interaction.user}!`, 
            ephemeral: false 
        });

    } catch (error) {
        console.error('Error in handleClaimTicket:', error);
        await interaction.reply({ 
            content: 'An error occurred while claiming the ticket.', 
            ephemeral: true 
        });
    }
}

// Handle close Zentro ticket button
async function handleCloseZentoTicket(interaction) {
    try {
        const userId = interaction.user.id;
        const ticket = await db.getOpenZentoTicketByChannel(interaction.channel.id);
        
        if (!ticket) {
            await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
            return;
        }

        // Check permissions - user who created ticket or staff role
        const config = await db.getZentoTicketConfig(interaction.guildId);
        const isTicketOwner = ticket.user_id === userId;
        const isStaff = config && interaction.member.roles.cache.has(config.role_id);

        if (!isTicketOwner && !isStaff) {
            await interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
            return;
        }

        // Update channel name to closed format
        try {
            await interaction.channel.setName(`🏁| ${ticket.user_id}${ticket.random_number}`);
        } catch (error) {
            console.error('Failed to rename channel:', error);
        }

        // Send finish message
        const orange = 0xFFA500;
        const finishEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`Ticket number: ${ticket.ticket_number}`)
            .setColor(orange)
            .setFooter({ text: 'Powered by Zentro', iconURL: interaction.client.user.displayAvatarURL() });
        
        await interaction.channel.send({ embeds: [finishEmbed] });

        // Schedule channel deletion
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Failed to delete channel:', error);
            }
        }, 60000); // 1 minute

        // Send DM to user
        const user = await interaction.client.users.fetch(ticket.user_id);
        const dmEmbed = new EmbedBuilder()
            .setTitle('ZENTRO BOT')
            .setDescription('Thank you for using Zentro support! We hope we were able to assist you with your request. If you need any more help, feel free to open a ticket again!')
            .setColor(orange)
            .setFooter({ text: 'Powered by Zentro', iconURL: 'https://cdn.discordapp.com/attachments/1390084651057418352/1402975345941942344/Zentro-picture.png.png?ex=6895de1c&is=68948c9c&hm=fee1cf71e083a86406b8a90c2bf9f7035d07115c8962cf0ea2c7b9aed1455444&' })
            .setImage('https://cdn.discordapp.com/attachments/1390084651057418352/1402975345941942344/Zentro-picture.png.png?ex=6895de1c&is=68948c9c&hm=fee1cf71e083a86406b8a90c2bf9f7035d07115c8962cf0ea2c7b9aed1455444&');

        try {
            await user.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.error('Failed to send DM:', error);
        }

        await interaction.reply({ content: 'Ticket will be closed and channel deleted in 1 minute.', ephemeral: true });

        // Remove ticket from database
        await db.deleteOpenZentoTicket(ticket.user_id);

    } catch (error) {
        console.error('Error in handleCloseZentoTicket:', error);
        await interaction.reply({ 
            content: 'An error occurred while closing the ticket.', 
            ephemeral: true 
        });
    }
}

// Helper function to get or create Zentro ticket categories
async function getOrCreateZentoTicketCategory(guild, ticketType, categoryName, categoryColor) {
    const guildId = guild.id;
    
    // Check if category already exists
    const existingCategory = guild.channels.cache.find(channel => 
        channel.type === ChannelType.GuildCategory && 
        channel.name === categoryName
    );
    
    if (existingCategory) {
        return existingCategory.id;
    }
    
    // Create new category
    try {
        const category = await guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: ['ViewChannel']
                }
            ]
        });
        
        console.log(`Created Zentro category: ${categoryName} (${category.id})`);
        return category.id;
        
    } catch (error) {
        console.error(`Failed to create Zentro category:`, error);
        return null;
    }
}

client.login(process.env.TOKEN); 
