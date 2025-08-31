const Database = require('./database');

async function checkDatabase() {
    const db = new Database();
    
    try {
        console.log('=== Database Contents ===');
        
        // Check open tickets
        const openTickets = await db.loadAllOpenTickets();
        console.log(`Open tickets: ${openTickets.length}`);
        openTickets.forEach(ticket => {
            console.log(`- User: ${ticket.user_id}, Channel: ${ticket.channel_id}, Type: ${ticket.type}`);
        });
        
        // Check ticket configs
        const ticketConfigs = await db.loadAllTicketConfigs();
        console.log(`Ticket configs: ${ticketConfigs.length}`);
        
        const supportConfigs = await db.loadAllSupportTicketConfigs();
        console.log(`Support configs: ${supportConfigs.length}`);
        
        // Check ticket counter
        const counter = await db.getTicketCounter();
        console.log(`Ticket counter: ${counter}`);
        
        // Clean up stale tickets if any exist
        if (openTickets.length > 0) {
            console.log('\n=== Cleaning up stale tickets ===');
            for (const ticket of openTickets) {
                await db.deleteOpenTicket(ticket.user_id);
                console.log(`Deleted ticket for user: ${ticket.user_id}`);
            }
            console.log('Cleanup complete!');
        }
        
    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        db.close();
    }
}

checkDatabase();
