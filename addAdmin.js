const sqlite = require('sqlite3');
const bcrypt = require('bcrypt');
const db = new sqlite.Database('concert_tickets.db');

const adminPassword = 'admin123';

bcrypt.hash(adminPassword, 10, (err, hashedPassword) => {
    if (err) {
        console.log('Error hashing password:', err);
        return;
    }

    db.run(
        `INSERT INTO USER (name, email, password, isadmin) VALUES (?, ?, ?, ?)`,
        ['admin', 'admin@concerts.com', hashedPassword, 1],
        (err) => {
            if (err) {
                console.log('Error adding admin:', err.message);
            } else {
                console.log('Admin account created successfully');
            }
            db.close();
        }
    );
});