-- ============================================================
-- PingFin 2026 – Bank Database Schema
-- Bank: BSCHBEBB
-- Internationale week – Bank team
-- ============================================================

-- Drop tables in correct order (foreign keys first)
DROP TABLE IF EXISTS ack_out;
DROP TABLE IF EXISTS ack_in;
DROP TABLE IF EXISTS po_out;
DROP TABLE IF EXISTS po_in;
DROP TABLE IF EXISTS po_new;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS log;
DROP TABLE IF EXISTS accounts;

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
    id          VARCHAR(34)     NOT NULL PRIMARY KEY,
    balance     DECIMAL(10,2)   NOT NULL DEFAULT 0.00
);

-- ============================================================
-- TRANSACTIONS
-- amount: positive = incoming (BA), negative = outgoing (OA)
-- ============================================================
CREATE TABLE transactions (
    id          VARCHAR(50)     NOT NULL PRIMARY KEY,
    amount      DECIMAL(10,2)   NOT NULL,
    datetime    DATETIME        NOT NULL,
    po_id       VARCHAR(50)     NULL,
    account_id  VARCHAR(34)     NOT NULL,
    isvalid     TINYINT(1)      NOT NULL DEFAULT 0,
    iscomplete  TINYINT(1)      NOT NULL DEFAULT 0,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- ============================================================
-- LOG
-- ============================================================
CREATE TABLE log (
    id          INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    datetime    DATETIME        NOT NULL,
    message     TEXT            NULL,
    type        VARCHAR(50)     NULL,
    po_id       VARCHAR(50)     NULL,
    po_amount   DECIMAL(10,2)   NULL,
    po_message  VARCHAR(255)    NULL,
    po_datetime DATETIME        NULL,
    ob_id       VARCHAR(11)     NULL,
    oa_id       VARCHAR(34)     NULL,
    ob_code     VARCHAR(10)     NULL,
    ob_datetime DATETIME        NULL,
    cb_code     VARCHAR(10)     NULL,
    cb_datetime DATETIME        NULL,
    bb_id       VARCHAR(11)     NULL,
    ba_id       VARCHAR(34)     NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

-- ============================================================
-- PO_NEW — Outgoing POs created by this bank as OB
-- ============================================================
CREATE TABLE po_new (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NOT NULL,
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

-- ============================================================
-- PO_OUT — POs sent to the clearing bank
-- ============================================================
CREATE TABLE po_out (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NOT NULL,
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

-- ============================================================
-- PO_IN — Incoming POs received from the clearing bank
-- ============================================================
CREATE TABLE po_in (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NOT NULL,
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

-- ============================================================
-- ACK_IN — Acknowledgements received from CB (this bank = OB)
-- ============================================================
CREATE TABLE ack_in (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NOT NULL,
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

-- ============================================================
-- ACK_OUT — Acknowledgements sent to CB (this bank = BB)
-- ============================================================
CREATE TABLE ack_out (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NOT NULL,
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

-- ============================================================
-- SEED DATA — 20 accounts for BSCHBEBB, 5000.00 each
-- ============================================================
INSERT INTO accounts (id, balance) VALUES
('BE68539007547034', 5000.00),
('BE43068999999501', 5000.00),
('BE11435411161155', 5000.00),
('BE78774455663389', 5000.00),
('BE62510007547061', 5000.00),
('BE83138811335512', 5000.00),
('BE21000124702372', 5000.00),
('BE97740345612208', 5000.00),
('BE56305177634141', 5000.00),
('BE34001747591234', 5000.00),
('BE45370012345678', 5000.00),
('BE72930000012882', 5000.00),
('BE88068999999602', 5000.00),
('BE55510007547099', 5000.00),
('BE29001234567890', 5000.00),
('BE63138800225511', 5000.00),
('BE14740012344321', 5000.00),
('BE91305177689012', 5000.00),
('BE47000124701234', 5000.00),
('BE36370099887766', 5000.00);
