-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: db-fde-02.sparkedhost.us:3306
-- Gegenereerd op: 09 jan 2026 om 11:50
-- Serverversie: 11.1.3-MariaDB-1:11.1.3+maria~ubu2204
-- PHP-versie: 8.1.31

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `s118444_orders_db`
--

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `bc_codes`
--

CREATE TABLE `bc_codes` (
  `id` int(11) NOT NULL,
  `bc_code` varchar(255) DEFAULT NULL,
  `breedte` int(11) DEFAULT NULL,
  `dikte` int(11) DEFAULT NULL,
  `houtsoort` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Gegevens worden geëxporteerd voor tabel `bc_codes`
--

INSERT INTO `bc_codes` (`id`, `bc_code`, `breedte`, `dikte`, `houtsoort`) VALUES
(1, '100975', 100, 16, 'SXT'),
(2, '100277', 100, 19, 'NHV'),
(20, '100984', 100, 19, 'SCH'),
(21, '101066', 100, 19, 'SXT'),
(22, '100282\r\n', 150, 19, 'NHV'),
(23, '100986', 150, 19, 'SCH'),
(24, '100271', 75, 19, 'NHV'),
(25, '101064', 75, 19, 'SXT'),
(26, '103110', 75, 22, 'NHV'),
(27, '101079', 75, 22, 'SXT'),
(28, '100327', 100, 22, 'NHV'),
(29, '101083', 100, 22, 'SXT'),
(30, '100343', 150, 22, 'NHV'),
(31, '101087\r\n', 150, 22, 'KD'),
(32, '100359', 100, 25, 'NHV'),
(33, '101093', 100, 25, 'SXT'),
(35, '100984', 100, 19, 'SCH'),
(36, '101066', 100, 19, 'SXT'),
(37, '100282\r\n', 150, 19, 'NHV'),
(38, '100986', 150, 19, 'SCH'),
(39, '100271', 75, 19, 'NHV'),
(40, '101064', 75, 19, 'SXT'),
(41, '103110', 75, 22, 'NHV'),
(42, '101079', 75, 22, 'SXT'),
(43, '100327', 100, 22, 'NHV'),
(44, '101083', 100, 22, 'SXT'),
(45, '100343', 150, 22, 'NHV'),
(46, '101087\r\n', 150, 22, 'KD'),
(47, '100359', 100, 25, 'NHV'),
(48, '101093', 100, 25, 'SXT'),
(49, NULL, NULL, NULL, NULL),
(50, '100510', 200, 75, 'NHV'),
(51, NULL, NULL, NULL, NULL),
(52, '100510', 200, 75, 'NHV'),
(53, NULL, NULL, NULL, NULL),
(54, '100597', 95, 95, 'NHV'),
(55, '100597', 95, 95, 'NHV'),
(56, '100377\r\n\r\n', 100, 32, 'NHV'),
(57, '101103', 100, 32, 'SXT'),
(58, '100377\r\n\r\n', 100, 32, 'NHV'),
(59, '101103', 100, 32, 'SXT'),
(60, '100378', 125, 32, 'NHV'),
(61, '101104\r\n', 125, 32, 'SXT'),
(62, '100378', 125, 32, 'NHV'),
(63, '101104\r\n', 125, 32, 'SXT'),
(64, '100379', 150, NULL, NULL),
(65, '100379', 150, 32, 'NHV'),
(66, '101105', 150, 32, 'SXT'),
(67, '100379', 150, 32, 'NHV'),
(68, '101105', 150, 32, 'SXT'),
(69, '100407', 100, 38, 'NHV'),
(70, '101112', 100, 38, 'SXT'),
(71, '100407', 100, 38, 'NHV'),
(72, '101112', 100, 38, 'SXT'),
(73, '100408', 150, 38, 'NHV'),
(74, '100418', 75, 43, 'NHV'),
(75, '100408', 150, 38, 'NHV'),
(76, '100418', 75, 43, 'NHV'),
(77, '100443', 75, 50, 'NHV'),
(78, '100446', 100, 50, 'NHV'),
(79, '100443', 75, 50, 'NHV'),
(80, '100446', 100, 50, 'NHV'),
(81, '100448', 150, NULL, NULL),
(82, '100448', 150, 50, 'NHV'),
(83, '100506', 100, 75, 'NHV'),
(84, '100448', 150, 50, 'NHV'),
(85, '100506', 100, 75, 'NHV'),
(86, '101139', 100, 75, 'SXT'),
(87, '100509', 150, 75, 'NHV'),
(88, '101139', 100, 75, 'SXT'),
(89, '100509', 150, 75, 'NHV'),
(90, '101141', 150, 75, 'SXT'),
(91, '100510', 200, 75, 'NHV'),
(92, '101141', 150, 75, 'SXT'),
(93, '100510', 200, 75, 'NHV'),
(94, '100500', 75, 75, 'NHV'),
(95, '100600', 125, 95, 'NHV'),
(96, '100500', 75, 75, 'NHV'),
(97, '100600', 125, 95, 'NHV'),
(98, '100603', 150, 95, 'NHV'),
(99, '100623', 100, 100, 'NHV'),
(100, '100603', 150, 95, 'NHV'),
(101, '100623', 100, 100, 'NHV'),
(102, '103204', 100, 100, 'SXT'),
(103, '100638', 150, 150, 'NHV'),
(104, '103204', 100, 100, 'SXT'),
(105, '100638', 150, 150, 'NHV'),
(106, '101853', 1220, 3, 'HDB'),
(108, '101853', 1220, 3, 'HDB'),
(110, '101897', 1220, 18, 'MPX'),
(112, '101897', 1220, 18, 'MPX'),
(114, '101893', 1220, 12, 'MPX'),
(115, '104724', 1220, 22, 'MPX'),
(116, '101893', 1220, 12, 'MPX'),
(117, '104724', 1220, 22, 'MPX'),
(118, '101942', 1220, 9, 'OSB'),
(119, '101945', 1250, 9, 'OSB'),
(120, '101942', 1220, 9, 'OSB'),
(121, '101945', 1250, 9, 'OSB'),
(122, '106606', 1500, 9, 'OSB'),
(123, '106606', 1500, 9, 'OSB'),
(125, '101893', 1220, 12, 'MEP'),
(127, '101893', 1220, 12, 'MEP'),
(128, '101914', 1220, 15, 'MEP'),
(129, '101914', 1220, 15, 'MEP'),
(131, '101892', 1220, 9, 'MEP'),
(132, '101855', 1220, 2440, 'HBO'),
(133, '100220', 100, 16, NULL);

--
-- Indexen voor geëxporteerde tabellen
--

--
-- Indexen voor tabel `bc_codes`
--
ALTER TABLE `bc_codes`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT voor geëxporteerde tabellen
--

--
-- AUTO_INCREMENT voor een tabel `bc_codes`
--
ALTER TABLE `bc_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=134;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
