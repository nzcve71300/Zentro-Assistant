const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildChannels, GatewayIntentBits.GuildRoles]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    const guildId = '1420879668248182840'; // Your second guild
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
        console.log('❌ Guild not found! Make sure the bot is in the server.');
        process.exit(1);
    }
    
    console.log(`\n=== Configuring Guild: ${guild.name} (${guildId}) ===\n`);
    
    // List all channels
    console.log('📋 Available Channels:');
    guild.channels.cache.forEach(channel => {
        console.log(`  ${channel.type === 15 ? '📁' : '💬'} ${channel.name} (${channel.id}) - ${channel.type === 15 ? 'Forum' : 'Text'}`);
    });
    
    console.log('\n🎭 Available Roles:');
    guild.roles.cache.sort((a, b) => b.position - a.position).forEach(role => {
        console.log(`  ${role.name} (${role.id})`);
    });
    
    console.log('\n📝 Configuration needed:');
    console.log('1. Find your welcome channel ID from the list above');
    console.log('2. Find your promotion/forum channel ID from the list above');
    console.log('3. Find your member role ID from the list above');
    console.log('4. Update the GUILD_CONFIGS in index.js with these IDs');
    
    console.log('\nExample configuration:');
    console.log(`'1420879668248182840': {
    promotionChannelId: 'YOUR_PROMOTION_CHANNEL_ID',
    welcomeChannelId: 'YOUR_WELCOME_CHANNEL_ID',
    memberRoleId: 'YOUR_MEMBER_ROLE_ID'
}`);
    
    process.exit(0);
});

client.login(process.env.TOKEN);
