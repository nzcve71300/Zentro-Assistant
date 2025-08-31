const { REST, Routes } = require('discord.js');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started cleaning up global application (/) commands.');

        // Remove all global commands by setting an empty array
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] }
        );

        console.log('Successfully removed all global application (/) commands.');
        console.log('Now run deploy-commands-guild.js to register guild-specific commands only.');
    } catch (error) {
        console.error('Error cleaning up global commands:', error);
    }
})();
