const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, SlashCommandBuilder, ChannelType } = require('discord.js');
require('dotenv').config();
const Database = require('./database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
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

const ALLOWED_GUILD_ID = '1385691441967267953';

client.on('guildCreate', guild => {
    if (guild.id !== ALLOWED_GUILD_ID) {
        guild.leave();
    }
});

client.on('ready', async () => {
    // If the bot is in any other guild, leave them
    client.guilds.cache.forEach(guild => {
        if (guild.id !== ALLOWED_GUILD_ID) {
            guild.leave();
        }
    });
    
    try {
        // Load all data from database
        await loadDataFromDatabase();
        
        // Restore existing ticket categories
        const guild = client.guilds.cache.get(ALLOWED_GUILD_ID);
        if (guild) {
            await restoreTicketCategories(guild);
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
    if (member.guild.id !== ALLOWED_GUILD_ID) return;
    
    try {
        // Find the [ZENTRO]MEMBERS role using the specific role ID
        const memberRole = member.guild.roles.cache.get('1410772028876787794');
        
        if (memberRole) {
            await member.roles.add(memberRole);
            console.log(`✅ Assigned [ZENTRO]MEMBERS role to ${member.user.tag}`);
        } else {
            console.log('⚠️ [ZENTRO]MEMBERS role not found. Please create it manually.');
        }
    } catch (error) {
        console.error('Error assigning role to new member:', error);
        if (error.code === 50013) {
            console.error('❌ Bot lacks permission to assign this role');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!isAllowedGuild(interaction)) {
        await interaction.reply({ content: 'This bot is only allowed in the official Zentro server.', ephemeral: true });
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
        }
    } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
});

// Handle reaction add for role assignment
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    // Fetch the full reaction if it's partial
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }
    
    // Check if this is the role assignment message
    if (reaction.emoji.name === '⚙️') {
        const guild = reaction.message.guild;
        if (guild.id !== ALLOWED_GUILD_ID) return;
        
        try {
            const member = await guild.members.fetch(user.id);
            const memberRole = guild.roles.cache.get('1410772028876787794'); // Use the specific role ID
            
            if (!memberRole) {
                console.error('❌ [ZENTRO]MEMBERS role not found!');
                return;
            }
            
            if (member.roles.cache.has(memberRole.id)) {
                console.log(`ℹ️ ${user.tag} already has the [ZENTRO]MEMBERS role`);
                return;
            }
            
            // Check if bot can manage this role
            const botMember = guild.members.cache.get(client.user.id);
            if (!botMember.permissions.has('ManageRoles')) {
                console.error('❌ Bot does not have Manage Roles permission');
                return;
            }
            
            // Check role hierarchy
            if (memberRole.position >= botMember.roles.highest.position) {
                console.error('❌ Bot cannot assign role higher than its own role');
                return;
            }
            
            await member.roles.add(memberRole);
            console.log(`✅ Assigned [ZENTRO]MEMBERS role to ${user.tag} via reaction`);
            
            // Send a DM to confirm (optional)
            try {
                await user.send('✅ You have been assigned the **[ZENTRO]MEMBERS** role! Welcome to the community!');
            } catch (dmError) {
                // User might have DMs disabled, that's okay
            }
            
        } catch (error) {
            console.error('Error assigning role via reaction:', error);
            if (error.code === 50013) {
                console.error('❌ Bot lacks permission to assign this role');
            } else if (error.code === 50001) {
                console.error('❌ Bot cannot access this user');
            }
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

    // Store initial embed data
    embedData.set(interaction.user.id, {
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
        // Get embed data for this user
        const data = embedData.get(userId) || {
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
        // Get embed data for this user
        const data = embedData.get(userId) || {
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
        // Get embed data for this user
        const data = embedData.get(userId) || {
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
    }
}

async function handleModalSubmit(interaction) {
    const userId = interaction.user.id;
    let data = await db.getEmbedData(userId);
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
        await db.saveEmbedData(userId, data);
        // Also update the local Map for immediate use
        embedData.set(userId, data);

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
        await db.saveEmbedData(userId, data);
        // Also update the local Map for immediate use
        embedData.set(userId, data);

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
    return interaction.guildId === ALLOWED_GUILD_ID;
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

client.login(process.env.TOKEN); 
