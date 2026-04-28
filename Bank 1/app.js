const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const faker = require('faker');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- IN-MEMORY DATABASE ---
let db = {
    accounts: [
        { id: 'BE12345678901234', balance: 10000.00, owner: 'Alice' },
        { id: 'BE09876543210987', balance: 5000.00, owner: 'Bob' }
    ],
    po_new: [],        // staged POs waiting to be sent to CB
    po_sent: [],       // POs successfully sent to CB
    po_incoming: [],   // POs received from CB (we are beneficiary bank)
    acks_received: [], // ACKs received for our sent POs
    logs: []
};

// --- CONFIGURATION ---
const CB_URL = process.env.CB_URL || 'https://stevenop.be/pingfin/api/v2';
const MY_BIC = process.env.MY_BIC || 'PFINBEA1';
const MY_BANK_NAME = process.env.BANK_NAME || 'PingFin Bank 1';

const cbHeaders = () => ({
    'Authorization': `Bearer ${process.env.BANK_TOKEN}`,
    'Content-Type': 'application/json'
});

// --- HELPERS ---
const log = (message, type = 'INFO', po_id = null) => {
    const entry = { id: uuidv4(), datetime: new Date().toISOString(), message, type, po_id };
    db.logs.push(entry);
    console.log(`[${type}] ${message}`);
    return entry;
};

const generateRandomPO = () => {
    const chaos = Math.random() > 0.9; // 10% invalid amount
    const account = db.accounts[Math.floor(Math.random() * db.accounts.length)];
    return {
        po_id: uuidv4(),
        po_amount: chaos ? -parseFloat((Math.random() * 100).toFixed(2)) : parseFloat(faker.finance.amount(10, 500)),
        po_message: faker.finance.transactionDescription(),
        po_datetime: new Date().toISOString(),
        oa_id: account.id,
        ob_id: MY_BIC,
        bb_id: 'PFINBEBB',
        ba_id: faker.finance.iban()
    };
};

// ─────────────────────────────────────────────
// GET /  → redirect to /api/help
// ─────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/api/help'));

// ─────────────────────────────────────────────
// GET /api/help
// ─────────────────────────────────────────────
app.get('/api/help', (req, res) => {
    res.json({
        bank: MY_BANK_NAME,
        bic: MY_BIC,
        endpoints: [
            {
                method: 'GET', url: '/api/help',
                description: 'This help page'
            },
            {
                method: 'GET', url: '/api/info',
                description: 'Bank info and live stats'
            },
            {
                method: 'GET', url: '/api/accounts',
                description: 'List all accounts with balances'
            },
            {
                method: 'POST', url: '/api/po_new_add',
                description: 'Add PO(s) to the staging queue',
                body_options: [
                    '{ "random": true, "count": 5 }  — generate N random POs',
                    '{ "po_amount": 100, "oa_id": "BE12345678901234", "bb_id": "PFINBEBB", "ba_id": "BE98...", "po_message": "..." }  — single manual PO',
                    '[{ ... }, { ... }]  — array of POs'
                ]
            },
            {
                method: 'GET', url: '/api/po_new_process',
                description: 'Validate staged POs and send them to CB (OB flow)'
            },
            {
                method: 'GET', url: '/api/po_out',
                description: 'Fetch incoming POs from CB, credit accounts, send ACKs (BB flow)'
            },
            {
                method: 'POST', url: '/api/ack_in',
                description: 'Receive ACKs pushed by CB',
                body: '[{ "po_id": "...", "bb_code": "OK", "bb_datetime": "..." }]'
            },
            {
                method: 'GET', url: '/api/ack_out',
                description: 'Fetch ACKs from CB for POs we sent'
            }
        ]
    });
});

// ─────────────────────────────────────────────
// GET /api/info
// ─────────────────────────────────────────────
app.get('/api/info', (req, res) => {
    res.json({
        bank_name: MY_BANK_NAME,
        bic: MY_BIC,
        cb_url: CB_URL,
        accounts_count: db.accounts.length,
        po_staged: db.po_new.length,
        po_sent: db.po_sent.length,
        po_incoming: db.po_incoming.length,
        acks_received: db.acks_received.length,
        log_entries: db.logs.length,
        uptime_seconds: Math.floor(process.uptime())
    });
});

// ─────────────────────────────────────────────
// GET /api/accounts
// ─────────────────────────────────────────────
app.get('/api/accounts', (req, res) => {
    res.json(db.accounts);
});

// ─────────────────────────────────────────────
// POST /api/po_new_add
// Adds POs to the staging queue. Supports:
//   - { random: true, count: N }   → generate N random POs
//   - Single PO object             → one manual PO
//   - Array of PO objects          → multiple manual POs
// ─────────────────────────────────────────────
app.post('/api/po_new_add', (req, res) => {
    const body = req.body;
    const added = [];

    if (body.random === true) {
        const count = Math.max(1, parseInt(body.count) || 1);
        for (let i = 0; i < count; i++) {
            const po = generateRandomPO();
            db.po_new.push(po);
            added.push(po);
        }
    } else if (Array.isArray(body)) {
        for (const raw of body) {
            const po = { po_id: uuidv4(), po_datetime: new Date().toISOString(), ob_id: MY_BIC, ...raw };
            db.po_new.push(po);
            added.push(po);
        }
    } else {
        const po = { po_id: uuidv4(), po_datetime: new Date().toISOString(), ob_id: MY_BIC, ...body };
        db.po_new.push(po);
        added.push(po);
    }

    log(`Added ${added.length} PO(s) to staging queue`);
    res.status(201).json({ added: added.length, pos: added });
});

// ─────────────────────────────────────────────
// GET /api/po_new_process
// Validate staged POs and forward to CB (OB flow)
// ─────────────────────────────────────────────
app.get('/api/po_new_process', async (req, res) => {
    const pending = [...db.po_new];
    db.po_new = [];
    const results = { sent: [], failed: [] };

    for (const po of pending) {
        const account = db.accounts.find(a => a.id === po.oa_id);

        // Validation
        if (po.po_amount <= 0) {
            log(`PO ${po.po_id} rejected: invalid amount`, 'ERROR', po.po_id);
            results.failed.push({ ...po, reason: 'INVALID_AMOUNT' });
            continue;
        }
        if (!account) {
            log(`PO ${po.po_id} rejected: unknown account ${po.oa_id}`, 'ERROR', po.po_id);
            results.failed.push({ ...po, reason: 'UNKNOWN_ACCOUNT' });
            continue;
        }
        if (account.balance < po.po_amount) {
            log(`PO ${po.po_id} rejected: insufficient funds`, 'ERROR', po.po_id);
            results.failed.push({ ...po, reason: 'INSUFFICIENT_FUNDS' });
            continue;
        }

        try {
            account.balance -= po.po_amount; // lock funds
            await axios.post(`${CB_URL}/po_in/`, [po], { headers: cbHeaders() });
            db.po_sent.push({ ...po, sent_at: new Date().toISOString() });
            results.sent.push(po);
            log(`PO ${po.po_id} sent to CB`, 'INFO', po.po_id);
        } catch (err) {
            account.balance += po.po_amount; // refund
            log(`CB unavailable — PO ${po.po_id} refunded`, 'CRITICAL', po.po_id);
            results.failed.push({ ...po, reason: 'CB_UNAVAILABLE' });
        }
    }

    res.json(results);
});

// ─────────────────────────────────────────────
// GET /api/po_out
// Fetch incoming POs from CB, credit accounts, send ACKs (BB flow)
// ─────────────────────────────────────────────
app.get('/api/po_out', async (req, res) => {
    try {
        const response = await axios.get(`${CB_URL}/po_out/`, { headers: cbHeaders() });
        const incoming = response.data?.data ?? response.data ?? [];
        const acks = [];

        for (const po of incoming) {
            const account = db.accounts.find(a => a.id === po.ba_id);
            let code = 'OK';

            if (account) {
                account.balance += parseFloat(po.po_amount);
                db.po_incoming.push({ ...po, received_at: new Date().toISOString() });
                log(`Credited ${po.po_amount} to ${po.ba_id} for PO ${po.po_id}`, 'INFO', po.po_id);
            } else {
                code = 'ERR_INVALID_ACCOUNT';
                log(`Unknown account ${po.ba_id} for PO ${po.po_id}`, 'ERROR', po.po_id);
            }

            acks.push({ po_id: po.po_id, bb_code: code, bb_datetime: new Date().toISOString() });
        }

        if (acks.length > 0) {
            await axios.post(`${CB_URL}/ack_in/`, acks, { headers: cbHeaders() });
            log(`Sent ${acks.length} ACK(s) to CB`);
        }

        res.json({ processed: incoming.length, acks_sent: acks.length, details: acks });
    } catch (err) {
        log(`Failed to fetch POs from CB: ${err.message}`, 'ERROR');
        res.status(500).json({ error: 'Failed to fetch from CB', details: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/ack_in
// Receive ACKs pushed by CB for POs we sent
// Body: [{ po_id, bb_code, bb_datetime }]
// ─────────────────────────────────────────────
app.post('/api/ack_in', (req, res) => {
    const acks = Array.isArray(req.body) ? req.body : [req.body];

    for (const ack of acks) {
        db.acks_received.push({ ...ack, received_at: new Date().toISOString() });
        const po = db.po_sent.find(p => p.po_id === ack.po_id);
        if (po) po.ack = ack;
        log(`ACK received for PO ${ack.po_id}: ${ack.bb_code}`, 'INFO', ack.po_id);
    }

    res.json({ received: acks.length, acks });
});

// ─────────────────────────────────────────────
// GET /api/ack_out
// Fetch ACKs from CB for POs we sent (OB checking status)
// ─────────────────────────────────────────────
app.get('/api/ack_out', async (req, res) => {
    try {
        const response = await axios.get(`${CB_URL}/ack_out/`, { headers: cbHeaders() });
        const acks = response.data?.data ?? response.data ?? [];

        for (const ack of acks) {
            db.acks_received.push({ ...ack, fetched_at: new Date().toISOString() });
            const po = db.po_sent.find(p => p.po_id === ack.po_id);
            if (po) po.ack = ack;
        }

        log(`Fetched ${acks.length} ACK(s) from CB`);
        res.json({ fetched: acks.length, acks });
    } catch (err) {
        log(`Failed to fetch ACKs from CB: ${err.message}`, 'ERROR');
        res.status(500).json({ error: 'Failed to fetch ACKs from CB', details: err.message });
    }
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[${MY_BIC}] ${MY_BANK_NAME} running on http://localhost:${PORT}`);
    console.log(`CB: ${CB_URL}`);
    console.log(`Token loaded: ${process.env.BANK_TOKEN ? 'YES' : 'NO — set BANK_TOKEN in .env'}`);
});
