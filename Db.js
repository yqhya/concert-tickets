const sqlite = require('sqlite3')
const db = new sqlite.Database('concert_tickets.db')

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

const createUserTable = `CREATE TABLE IF NOT EXISTS USER (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    NAME TEXT NOT NULL,
    EMAIL TEXT UNIQUE NOT NULL,
    PASSWORD TEXT NOT NULL,
    ISADMIN INT
)`

const createConcertTable = `CREATE TABLE IF NOT EXISTS CONCERT (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    ARTIST TEXT NOT NULL,
    VENUE TEXT NOT NULL,
    DATE TEXT NOT NULL,
    AVAILABLE_TICKETS INT NOT NULL,
    TICKET_PRICE DECIMAL(10,2) NOT NULL
)`

const createTicketPurchaseTable = `CREATE TABLE IF NOT EXISTS TICKET_PURCHASE (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    USER_ID INTEGER NOT NULL,
    CONCERT_ID INTEGER NOT NULL,
    PURCHASE_DATE TEXT NOT NULL,
    PRICE DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (USER_ID) REFERENCES USER(ID),
    FOREIGN KEY (CONCERT_ID) REFERENCES CONCERT(ID)
)`

// Initialize tables in correct order
db.serialize(() => {
    db.run(createUserTable, (err) => {
        if (err) {
            console.error('Error creating USER table:', err);
        } else {
            console.log('USER table ready');
        }
    });

    db.run(createConcertTable, (err) => {
        if (err) {
            console.error('Error creating CONCERT table:', err);
        } else {
            console.log('CONCERT table ready');
        }
    });

    db.run(createTicketPurchaseTable, (err) => {
        if (err) {
            console.error('Error creating TICKET_PURCHASE table:', err);
        } else {
            console.log('TICKET_PURCHASE table ready');
        }
    });
});

module.exports = {
    db,
    createUserTable,
    createConcertTable,
    createTicketPurchaseTable
}