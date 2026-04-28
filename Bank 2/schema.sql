-- ============================================================
-- PingFin 2026 – Bank Database Schema
-- Bank: GKCCBEBB
-- ============================================================

DROP TABLE IF EXISTS ack_out;
DROP TABLE IF EXISTS ack_in;
DROP TABLE IF EXISTS po_out;
DROP TABLE IF EXISTS po_in;
DROP TABLE IF EXISTS po_new;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS log;
DROP TABLE IF EXISTS accounts;

CREATE TABLE accounts (
    id          VARCHAR(34)     NOT NULL PRIMARY KEY,
    balance     DECIMAL(10,2)   NOT NULL DEFAULT 0.00
);

CREATE TABLE transactions (
    id          VARCHAR(50)     NOT NULL PRIMARY KEY,
    amount      DECIMAL(10,2)   NOT NULL,
    datetime    DATETIME        NOT NULL,
    po_id       VARCHAR(50)     NULL,
    account_id  VARCHAR(34)     NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE log (
    id          INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    datetime    DATETIME        NOT NULL,
    message     TEXT            NULL,
    type        VARCHAR(50)     NULL,
    po_id       VARCHAR(50)     NULL
);

CREATE TABLE po_new (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NULL,
    po_datetime DATETIME        NOT NULL,
    ob_id       VARCHAR(11)     NOT NULL,
    oa_id       VARCHAR(34)     NOT NULL,
    ob_code     VARCHAR(10)     NULL,
    ob_datetime DATETIME        NULL,
    cb_code     VARCHAR(10)     NULL,
    cb_datetime DATETIME        NULL,
    bb_id       VARCHAR(11)     NOT NULL,
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

CREATE TABLE po_out (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NULL,
    po_datetime DATETIME        NOT NULL,
    ob_id       VARCHAR(11)     NOT NULL,
    oa_id       VARCHAR(34)     NOT NULL,
    ob_code     VARCHAR(10)     NULL,
    ob_datetime DATETIME        NULL,
    cb_code     VARCHAR(10)     NULL,
    cb_datetime DATETIME        NULL,
    bb_id       VARCHAR(11)     NOT NULL,
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

CREATE TABLE po_in (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NULL,
    po_datetime DATETIME        NOT NULL,
    ob_id       VARCHAR(11)     NOT NULL,
    oa_id       VARCHAR(34)     NOT NULL,
    ob_code     VARCHAR(10)     NULL,
    ob_datetime DATETIME        NULL,
    cb_code     VARCHAR(10)     NULL,
    cb_datetime DATETIME        NULL,
    bb_id       VARCHAR(11)     NOT NULL,
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

CREATE TABLE ack_in (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NULL,
    po_datetime DATETIME        NOT NULL,
    ob_id       VARCHAR(11)     NOT NULL,
    oa_id       VARCHAR(34)     NOT NULL,
    ob_code     VARCHAR(10)     NULL,
    ob_datetime DATETIME        NULL,
    cb_code     VARCHAR(10)     NULL,
    cb_datetime DATETIME        NULL,
    bb_id       VARCHAR(11)     NOT NULL,
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

CREATE TABLE ack_out (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NULL,
    po_datetime DATETIME        NOT NULL,
    ob_id       VARCHAR(11)     NOT NULL,
    oa_id       VARCHAR(34)     NOT NULL,
    ob_code     VARCHAR(10)     NULL,
    ob_datetime DATETIME        NULL,
    cb_code     VARCHAR(10)     NULL,
    cb_datetime DATETIME        NULL,
    bb_id       VARCHAR(11)     NOT NULL,
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

-- Seed: 20 accounts for GKCCBEBB, 5000.00 each
INSERT INTO accounts (id, balance) VALUES
('BE71096123456789', 5000.00),
('BE83138822446613', 5000.00),
('BE24300912345678', 5000.00),
('BE56732011223344', 5000.00),
('BE91540099887766', 5000.00),
('BE37096100001234', 5000.00),
('BE62300911112222', 5000.00),
('BE44732022334455', 5000.00),
('BE19540088776655', 5000.00),
('BE73096100009876', 5000.00),
('BE28300955443322', 5000.00),
('BE55732033445566', 5000.00),
('BE80540077665544', 5000.00),
('BE12096100007654', 5000.00),
('BE47300944332211', 5000.00),
('BE93732044556677', 5000.00),
('BE68540066554433', 5000.00),
('BE34096100005432', 5000.00),
('BE59300933221100', 5000.00),
('BE85732055667788', 5000.00);
