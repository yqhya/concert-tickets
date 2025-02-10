const sqlite = require('sqlite3');
const db = new sqlite.Database('concert_tickets.db');

const festivals = [
    {
        artist: "Rolling Loud 2025",
        venue: "Hard Rock Stadium, Miami Gardens, FL",
        date: "2025-07-23",
        availableTickets: 55000,
        ticketPrice: 429.99
    },
    {
        artist: "Coachella 2025",
        venue: "Empire Polo Club, Indio, CA",
        date: "2025-04-11",
        availableTickets: 125000,
        ticketPrice: 549.99
    },
    {
        artist: "Lollapalooza 2025",
        venue: "Grant Park, Chicago, IL",
        date: "2025-08-01",
        availableTickets: 100000,
        ticketPrice: 379.99
    }
];

db.serialize(() => {
    // First, clear existing concerts
    db.run('DELETE FROM CONCERT', (err) => {
        if (err) {
            console.error('Error clearing existing concerts:', err);
            return;
        }
        console.log('Cleared existing concerts');

        // Now add the new concerts
        const stmt = db.prepare(`
            INSERT INTO CONCERT (ARTIST, VENUE, DATE, AVAILABLE_TICKETS, TICKET_PRICE)
            VALUES (?, ?, ?, ?, ?)
        `);

        festivals.forEach(festival => {
            stmt.run(
                festival.artist,
                festival.venue,
                festival.date,
                festival.availableTickets,
                festival.ticketPrice,
                (err) => {
                    if (err) {
                        console.error(`Error adding ${festival.artist}:`, err.message);
                    } else {
                        console.log(`Added ${festival.artist} successfully`);
                    }
                }
            );
        });

        stmt.finalize();
        console.log('All festivals have been added');
    });
});
