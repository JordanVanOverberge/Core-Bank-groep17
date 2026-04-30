-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Gegenereerd op: 28 apr 2026 om 09:04
-- Serverversie: 10.4.32-MariaDB
-- PHP-versie: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pingfin_gkcc`
--

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `accounts`
--

CREATE TABLE `accounts` (
  `id` varchar(34) NOT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Gegevens worden geëxporteerd voor tabel `accounts`
--

INSERT INTO `accounts` (`id`, `balance`) VALUES
('BE10000124700010', 5000.00),
('BE11001747590001', 5000.00),
('BE12539007541111', 5000.00),
('BE21370099880011', 5000.00),
('BE22370012340002', 5000.00),
('BE23068999992222', 5000.00),
('BE33930000010003', 5000.00),
('BE34435411163333', 5000.00),
('BE44068999990004', 5000.00),
('BE45774455664444', 5000.00),
('BE55510007540005', 5000.00),
('BE56510007545555', 5000.00),
('BE66001234560006', 5000.00),
('BE67138811336666', 5000.00),
('BE77138800220007', 5000.00),
('BE78000124707777', 5000.00),
('BE88740012340008', 5000.00),
('BE89740345618888', 5000.00),
('BE90305177639999', 5000.00),
('BE99305177680009', 5000.00);

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `ack_in`
--

CREATE TABLE `ack_in` (
  `po_id` varchar(50) NOT NULL,
  `po_amount` decimal(10,2) NOT NULL,
  `po_message` varchar(255) NOT NULL,
  `po_datetime` datetime NOT NULL,
  `ob_id` varchar(11) NOT NULL,
  `oa_id` varchar(34) NOT NULL,
  `ob_code` varchar(10) DEFAULT NULL,
  `ob_datetime` datetime DEFAULT NULL,
  `cb_code` varchar(10) DEFAULT NULL,
  `cb_datetime` datetime DEFAULT NULL,
  `bb_id` varchar(11) NOT NULL,
  `ba_id` varchar(34) NOT NULL,
  `bb_code` varchar(10) DEFAULT NULL,
  `bb_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `ack_out`
--

CREATE TABLE `ack_out` (
  `po_id` varchar(50) NOT NULL,
  `po_amount` decimal(10,2) NOT NULL,
  `po_message` varchar(255) NOT NULL,
  `po_datetime` datetime NOT NULL,
  `ob_id` varchar(11) NOT NULL,
  `oa_id` varchar(34) NOT NULL,
  `ob_code` varchar(10) DEFAULT NULL,
  `ob_datetime` datetime DEFAULT NULL,
  `cb_code` varchar(10) DEFAULT NULL,
  `cb_datetime` datetime DEFAULT NULL,
  `bb_id` varchar(11) NOT NULL,
  `ba_id` varchar(34) NOT NULL,
  `bb_code` varchar(10) DEFAULT NULL,
  `bb_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `log`
--

CREATE TABLE `log` (
  `id` int(11) NOT NULL,
  `datetime` datetime NOT NULL,
  `message` text DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `po_id` varchar(50) DEFAULT NULL,
  `po_amount` decimal(10,2) DEFAULT NULL,
  `po_message` varchar(255) DEFAULT NULL,
  `po_datetime` datetime DEFAULT NULL,
  `ob_id` varchar(11) DEFAULT NULL,
  `oa_id` varchar(34) DEFAULT NULL,
  `ob_code` varchar(10) DEFAULT NULL,
  `ob_datetime` datetime DEFAULT NULL,
  `cb_code` varchar(10) DEFAULT NULL,
  `cb_datetime` datetime DEFAULT NULL,
  `bb_id` varchar(11) DEFAULT NULL,
  `ba_id` varchar(34) DEFAULT NULL,
  `bb_code` varchar(10) DEFAULT NULL,
  `bb_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `po_in`
--

CREATE TABLE `po_in` (
  `po_id` varchar(50) NOT NULL,
  `po_amount` decimal(10,2) NOT NULL,
  `po_message` varchar(255) NOT NULL,
  `po_datetime` datetime NOT NULL,
  `ob_id` varchar(11) NOT NULL,
  `oa_id` varchar(34) NOT NULL,
  `ob_code` varchar(10) DEFAULT NULL,
  `ob_datetime` datetime DEFAULT NULL,
  `cb_code` varchar(10) DEFAULT NULL,
  `cb_datetime` datetime DEFAULT NULL,
  `bb_id` varchar(11) NOT NULL,
  `ba_id` varchar(34) NOT NULL,
  `bb_code` varchar(10) DEFAULT NULL,
  `bb_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `po_new`
--

CREATE TABLE `po_new` (
  `po_id` varchar(50) NOT NULL,
  `po_amount` decimal(10,2) NOT NULL,
  `po_message` varchar(255) NOT NULL,
  `po_datetime` datetime NOT NULL,
  `ob_id` varchar(11) NOT NULL,
  `oa_id` varchar(34) NOT NULL,
  `ob_code` varchar(10) DEFAULT NULL,
  `ob_datetime` datetime DEFAULT NULL,
  `cb_code` varchar(10) DEFAULT NULL,
  `cb_datetime` datetime DEFAULT NULL,
  `bb_id` varchar(11) NOT NULL,
  `ba_id` varchar(34) NOT NULL,
  `bb_code` varchar(10) DEFAULT NULL,
  `bb_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `po_out`
--

CREATE TABLE `po_out` (
  `po_id` varchar(50) NOT NULL,
  `po_amount` decimal(10,2) NOT NULL,
  `po_message` varchar(255) NOT NULL,
  `po_datetime` datetime NOT NULL,
  `ob_id` varchar(11) NOT NULL,
  `oa_id` varchar(34) NOT NULL,
  `ob_code` varchar(10) DEFAULT NULL,
  `ob_datetime` datetime DEFAULT NULL,
  `cb_code` varchar(10) DEFAULT NULL,
  `cb_datetime` datetime DEFAULT NULL,
  `bb_id` varchar(11) NOT NULL,
  `ba_id` varchar(34) NOT NULL,
  `bb_code` varchar(10) DEFAULT NULL,
  `bb_datetime` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `transactions`
--

CREATE TABLE `transactions` (
  `id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `datetime` datetime NOT NULL,
  `po_id` varchar(50) DEFAULT NULL,
  `account_id` varchar(34) NOT NULL,
  `isvalid` tinyint(1) NOT NULL DEFAULT 0,
  `iscomplete` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexen voor geëxporteerde tabellen
--

--
-- Indexen voor tabel `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`);

--
-- Indexen voor tabel `ack_in`
--
ALTER TABLE `ack_in`
  ADD PRIMARY KEY (`po_id`);

--
-- Indexen voor tabel `ack_out`
--
ALTER TABLE `ack_out`
  ADD PRIMARY KEY (`po_id`);

--
-- Indexen voor tabel `log`
--
ALTER TABLE `log`
  ADD PRIMARY KEY (`id`);

--
-- Indexen voor tabel `po_in`
--
ALTER TABLE `po_in`
  ADD PRIMARY KEY (`po_id`);

--
-- Indexen voor tabel `po_new`
--
ALTER TABLE `po_new`
  ADD PRIMARY KEY (`po_id`);

--
-- Indexen voor tabel `po_out`
--
ALTER TABLE `po_out`
  ADD PRIMARY KEY (`po_id`);

--
-- Indexen voor tabel `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`);

--
-- AUTO_INCREMENT voor geëxporteerde tabellen
--

--
-- AUTO_INCREMENT voor een tabel `log`
--
ALTER TABLE `log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Beperkingen voor geëxporteerde tabellen
--

--
-- Beperkingen voor tabel `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
