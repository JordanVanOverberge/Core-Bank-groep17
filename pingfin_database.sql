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
-- Only for regular banks (not clearing bank)
-- ============================================================
CREATE TABLE accounts (
    id          VARCHAR(34)     NOT NULL PRIMARY KEY,   -- IBAN (no spaces)
    balance     DECIMAL(10,2)   NOT NULL DEFAULT 0.00
);

-- ============================================================
-- TRANSACTIONS
-- Only for regular banks (not clearing bank)
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
-- For both regular banks and clearing bank
-- N = nullable (may be empty depending on the step)
-- ============================================================
CREATE TABLE log (
    id          INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    datetime    DATETIME        NOT NULL,
    message     TEXT            NULL,
    type        VARCHAR(50)     NULL,
    po_id       VARCHAR(50)     NULL,        -- N
    po_amount   DECIMAL(10,2)   NULL,        -- N
    po_message  VARCHAR(255)    NULL,        -- N
    po_datetime DATETIME        NULL,        -- N
    ob_id       VARCHAR(11)     NULL,        -- N
    oa_id       VARCHAR(34)     NULL,        -- N
    ob_code     VARCHAR(10)     NULL,        -- N
    ob_datetime DATETIME        NULL,        -- N
    cb_code     VARCHAR(10)     NULL,        -- N
    cb_datetime DATETIME        NULL,        -- N
    bb_id       VARCHAR(11)     NULL,        -- N
    ba_id       VARCHAR(34)     NULL,        -- N
    bb_code     VARCHAR(10)     NULL,        -- N
    bb_datetime DATETIME        NULL         -- N
);

-- ============================================================
-- PO_NEW
-- Outgoing POs created by this bank as OB
-- ob_code and ob_datetime filled in after OB validation
-- ============================================================
CREATE TABLE po_new (
    po_id       VARCHAR(50)     NOT NULL PRIMARY KEY,   -- format: BSCHBEBB_xxxxx (max 50 chars)
    po_amount   DECIMAL(10,2)   NOT NULL,
    po_message  VARCHAR(255)    NOT NULL,
    po_datetime DATETIME        NOT NULL,
    ob_id       VARCHAR(11)     NOT NULL,               -- BSCHBEBB
    oa_id       VARCHAR(34)     NOT NULL,               -- IBAN sender
    ob_code     VARCHAR(10)     NULL,                   -- N filled after OB validation
    ob_datetime DATETIME        NULL,                   -- N filled after OB validation
    cb_code     VARCHAR(10)     NULL,                   -- N
    cb_datetime DATETIME        NULL,                   -- N
    bb_id       VARCHAR(11)     NOT NULL,               -- BIC receiving bank
    ba_id       VARCHAR(34)     NOT NULL,               -- IBAN receiver
    bb_code     VARCHAR(10)     NULL,                   -- N
    bb_datetime DATETIME        NULL                    -- N
);

-- ============================================================
-- PO_OUT
-- POs sent to the clearing bank (after OB validation passed)
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
    cb_code     VARCHAR(10)     NULL,                   -- N
    cb_datetime DATETIME        NULL,                   -- N
    bb_id       VARCHAR(11)     NOT NULL,
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,                   -- N
    bb_datetime DATETIME        NULL                    -- N
);

-- ============================================================
-- PO_IN
-- Incoming POs received from the clearing bank (this bank = BB)
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
    bb_id       VARCHAR(11)     NOT NULL,               -- BSCHBEBB
    ba_id       VARCHAR(34)     NOT NULL,               -- IBAN receiver (must exist in accounts)
    bb_code     VARCHAR(10)     NULL,                   -- N filled after BB validation
    bb_datetime DATETIME        NULL                    -- N filled after BB validation
);

-- ============================================================
-- ACK_IN
-- Acknowledgements received from CB (this bank = OB)
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
-- ACK_OUT
-- Acknowledgements sent to CB (this bank = BB)
-- bb_code and bb_datetime must be filled before sending
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
    bb_id       VARCHAR(11)     NOT NULL,               -- BSCHBEBB
    ba_id       VARCHAR(34)     NOT NULL,
    bb_code     VARCHAR(10)     NULL,
    bb_datetime DATETIME        NULL
);

-- ============================================================
-- SEED DATA
-- 20 accounts for bank BSCHBEBB
-- Each starts with 5000.00 euro
-- Belgian IBAN format (no spaces)
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

-- ============================================================
-- VERIFY
-- Expected: 20 accounts, 100000.00 total
-- ============================================================
SELECT COUNT(*) AS total_accounts, SUM(balance) AS total_balance FROM accounts;
