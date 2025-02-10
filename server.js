const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');
const db_access = require('./Db.js')
const db = db_access.db
const cookieParser = require('cookie-parser');
const server = express()
const port = 555
const secret_key = 'DdsdsdKKFDDFDdvfddvxvcvc4dsdvdsvdb'

server.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}))
server.use(express.json())
server.use(cookieParser())

const generateToken = (id, isAdmin) => {
    return jwt.sign({ id, isAdmin }, secret_key, { expiresIn: '1h' })
}

const verifyToken = (req, res, next) => {
    const token = req.cookies.authToken
    if (!token)
        return res.status(401).send('unauthorized')
    jwt.verify(token, secret_key, (err, details) => {
        if (err)
            return res.status(403).send('invalid or expired token')
        req.userDetails = details
        next()
    })
}

server.post('/user/login', (req, res) => {
    const email = req.body.email
    const password = req.body.password
    db.get(`SELECT * FROM USER WHERE EMAIL=?`, [email], (err, row) => {
        if (err || !row) {
            return res.status(401).send('invalid credentials')
        }
        bcrypt.compare(password, row.PASSWORD, (err, isMatch) => {
            if (err) {
                return res.status(500).send('error comparing password.')
            }
            if (!isMatch) {
                return res.status(401).send('invalid credentials')
            }
            else {
                let userID = row.ID
                let isAdmin = row.ISADMIN
                const token = generateToken(userID, isAdmin)

                res.cookie('authToken', token, {
                    httpOnly: true,
                    sameSite: 'none',
                    secure: true,
                    expiresIn: '1h'
                })
                return res.status(200).json({ id: userID, admin: isAdmin })
            }
        })
    })
})

server.post(`/user/register`, (req, res) => {
    const name = req.body.name
    const email = req.body.email
    const password = req.body.password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).send('error hashing password')
        }
        db.run(`INSERT INTO USER (name,email,password,isadmin) VALUES (?,?,?,?)`, [name, email, hashedPassword, 0], (err) => {
            if (err) {
                return res.status(401).send(err)
            }
            else
                return res.status(200).send(`registration successful`)
        })
    })
})

// Concert-related endpoints
server.post(`/concerts/addconcert`, verifyToken, (req, res) => {
    const isAdmin = req.userDetails.isAdmin;
    if (isAdmin !== 1)
        return res.status(403).send("you are not an admin")
    
    const { artist, venue, date, availableTickets, ticketPrice } = req.body
    let query = `INSERT INTO CONCERT (ARTIST, VENUE, DATE, AVAILABLE_TICKETS, TICKET_PRICE) 
                 VALUES (?, ?, ?, ?, ?)`
    
    db.run(query, [artist, venue, date, availableTickets, ticketPrice], (err) => {
        if (err) {
            console.log(err)
            return res.status(500).send(err)
        }
        return res.status(200).send(`concert added successfully`)
    })
})

server.get('/concerts', (req, res) => {
    db.all(`SELECT DISTINCT * FROM CONCERT WHERE AVAILABLE_TICKETS > 0 ORDER BY DATE`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching concerts:', err);
            return res.status(500).send('Error fetching concerts');
        }
        res.json(rows);
    });
})

server.post('/concerts/:id/purchase', verifyToken, (req, res) => {
    const concertId = req.params.id;
    const userId = req.userDetails.id;

    console.log(`Attempting ticket purchase - User ID: ${userId}, Concert ID: ${concertId}`);

    db.serialize(() => {
        // First check if concert exists and has available tickets
        db.get('SELECT AVAILABLE_TICKETS, TICKET_PRICE FROM CONCERT WHERE ID = ?', [concertId], (err, concert) => {
            if (err) {
                console.error('Error checking concert availability:', err);
                return res.status(500).json({ error: 'Error checking ticket availability' });
            }

            if (!concert) {
                console.error(`Concert not found - ID: ${concertId}`);
                return res.status(404).json({ error: 'Concert not found' });
            }

            if (concert.AVAILABLE_TICKETS <= 0) {
                console.error(`No tickets available for concert - ID: ${concertId}`);
                return res.status(400).json({ error: 'No tickets available' });
            }

            // Begin transaction
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('Error beginning transaction:', err);
                    return res.status(500).json({ error: 'Error processing purchase' });
                }

                // Update ticket count
                db.run(
                    'UPDATE CONCERT SET AVAILABLE_TICKETS = AVAILABLE_TICKETS - 1 WHERE ID = ? AND AVAILABLE_TICKETS > 0',
                    [concertId],
                    function(err) {
                        if (err) {
                            console.error('Error updating ticket count:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Error updating ticket count' });
                        }

                        if (this.changes === 0) {
                            console.error('No tickets were updated - possible race condition');
                            db.run('ROLLBACK');
                            return res.status(400).json({ error: 'Ticket no longer available' });
                        }

                        // Record the purchase
                        const purchaseDate = new Date().toISOString();
                        db.run(
                            'INSERT INTO TICKET_PURCHASE (USER_ID, CONCERT_ID, PURCHASE_DATE, PRICE) VALUES (?, ?, ?, ?)',
                            [userId, concertId, purchaseDate, concert.TICKET_PRICE],
                            (err) => {
                                if (err) {
                                    console.error('Error recording purchase:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Error recording purchase' });
                                }

                                // Commit transaction
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        console.error('Error committing transaction:', err);
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Error finalizing purchase' });
                                    }

                                    console.log(`Ticket purchase successful - User ID: ${userId}, Concert ID: ${concertId}`);
                                    res.status(200).json({ message: 'Ticket purchased successfully' });
                                });
                            }
                        );
                    }
                );
            });
        });
    });
});

server.get('/user/purchases', verifyToken, (req, res) => {
    const userId = req.userDetails.id
    const query = `
        SELECT tp.*, c.ARTIST, c.VENUE, c.DATE
        FROM TICKET_PURCHASE tp
        JOIN CONCERT c ON tp.CONCERT_ID = c.ID
        WHERE tp.USER_ID = ?
        ORDER BY tp.PURCHASE_DATE DESC
    `
    db.all(query, [userId], (err, rows) => {
        if (err) {
            return res.status(500).send('Error fetching purchase history')
        }
        res.json(rows)
    })
})

server.listen(port, () => {
    console.log(`Server is running on port ${port}`)
    db.serialize(() => {
        db.run(db_access.createUserTable, (err) => {
            if (err)
                console.log("error creating user table " + err)
        });
        db.run(db_access.createConcertTable, (err) => {
            if (err)
                console.log("error creating concert table " + err)
        });
        db.run(db_access.createTicketPurchaseTable, (err) => {
            if (err)
                console.log("error creating ticket purchase table " + err)
        });
    })
})
