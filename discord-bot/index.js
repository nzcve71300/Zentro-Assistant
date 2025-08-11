const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, SlashCommandBuilder, ChannelType } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Store embed data temporarily (in production, use a database)
const embedData = new Map();

// Ticket system state
const ticketConfig = new Map(); // guildId -> { channelId, roleId }
const supportTicketConfig = new Map(); // guildId -> { channelId, roleId }
const openTickets = new Map(); // userId -> { channelId, ticketNumber, randomNumber, type }
let ticketCounter = 1;

const ALLOWED_GUILD_ID = '1385691441967267953';

client.on('guildCreate', guild => {
    if (guild.id !== ALLOWED_GUILD_ID) {
        guild.leave();
    }
});

client.on('ready', () => {
    // If the bot is in any other guild, leave them
    client.guilds.cache.forEach(guild => {
        if (guild.id !== ALLOWED_GUILD_ID) {
            guild.leave();
        }
    });
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Bot is ready! Use /embed to create rich embeds.');
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
        }
    } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
});

async function handleEmbedCommand(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 **Embed Creator**')
        .setDescription('Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes\n• 📤 Send professional embeds\n• 🎯 Rich formatting support')
        .setColor('#5865F2')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
            { name: '📋 **Current Settings**', value: 'Title: `Embed Preview`\nDescription: `This is a test`\nColor: `#5865F2`', inline: true },
            { name: '⚙️ **Quick Actions**', value: 'Click the buttons below to customize your embed and make it look professional!', inline: true }
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
        description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
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
    const config = ticketConfig.get(guildId);
    const supportConfig = supportTicketConfig.get(guildId);
    const orange = 0xFFA500;
    
    if (interaction.customId === 'zentro_setup') {
        if (!config) {
            await interaction.reply({ content: 'Ticket system is not configured. Please ask an admin to run /setup-ticket.', ephemeral: true });
            return;
        }
        // Create private ticket channel
        const guild = interaction.guild;
        const staffRole = config.roleId;
        const ticketNumber = ticketCounter++;
        const randomNumber = Math.floor(Math.random() * 1000000);
        const channelName = `🟢| ${userId}${randomNumber}`;
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: 0, // GUILD_TEXT
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ['ViewChannel'] },
                { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                { id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
            ]
        });
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
    } else if (interaction.customId === 'support_ticket') {
        if (!supportConfig) {
            await interaction.reply({ content: 'Support ticket system is not configured. Please ask an admin to run /support-ticket-setup.', ephemeral: true });
            return;
        }
        // Create private support ticket channel
        const guild = interaction.guild;
        const staffRole = supportConfig.roleId;
        const ticketNumber = ticketCounter++;
        const randomNumber = Math.floor(Math.random() * 1000000);
        const channelName = `🟢| ${userId}${randomNumber}`;
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: 0, // GUILD_TEXT
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ['ViewChannel'] },
                { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                { id: staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
            ]
        });
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
                    .setURL('https://zentrostore.netlify.app/')
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
    }
}

async function handleModalSubmit(interaction) {
    const userId = interaction.user.id;
    const data = embedData.get(userId) || {
        title: '🎯 **Embed Creator**',
        description: 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes\n• 📤 Send professional embeds\n• 🎯 Rich formatting support',
        color: '#5865F2',
        timestamp: true,
        thumbnail: true
    };

    if (interaction.customId === 'embed_text_modal') {
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');

        data.title = title || '🎯 **Embed Creator**';
        data.description = description || 'Create beautiful, rich embeds with this powerful tool!\n\n**Features:**\n• ✏️ Customize title and description\n• 🎨 Change colors with hex codes\n• 📤 Send professional embeds\n• 🎯 Rich formatting support';

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
        const color = interaction.fields.getTextInputValue('embed_color');
        
        // Validate hex color
        const hexRegex = /^#[0-9A-F]{6}$/i;
        if (!hexRegex.test(color)) {
            await interaction.reply({ content: 'Please enter a valid hex color code (e.g., #0099ff)', ephemeral: true });
            return;
        }

        data.color = color;
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
    // Save config for this guild
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
    // Save config for this guild
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
    const userId = [...openTickets.entries()].find(([_, v]) => v.channelId === interaction.channel.id)?.[0];
    if (!userId) {
        await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
        return;
    }
    const ticket = openTickets.get(userId);
    const orange = 0xFFA500;
    
    // Update channel name to closed format
    try {
        await interaction.channel.setName(`🏁| ${userId}${ticket.randomNumber}`);
    } catch (error) {
        console.error('Failed to rename channel:', error);
    }
    
    // Send finish message in channel
    const finishEmbed = new EmbedBuilder()
        .setTitle('🏁 Ticket Closed')
        .setDescription(`🏁 ticket number:${ticket.ticketNumber}`)
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
    openTickets.delete(userId);
}

function isAllowedGuild(interaction) {
    return interaction.guildId === ALLOWED_GUILD_ID;
}

client.login(process.env.TOKEN); 
