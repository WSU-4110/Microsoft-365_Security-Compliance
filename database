-- I made this using XAMPP for the sake of having something down, will convert it to PostgreSQL later.
-- I only could think of tables for user data, websites, and outages. Tables will probably be added/altered once more information is given about what exactly we need to store.
-- Tables are currently empty for the same reason of not knowing what needs to be stored. They will be filled once more information is given.


SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--Table containing user info
CREATE TABLE `userinfo` (
  `user_name` varchar(50) DEFAULT NULL,
  `user_password` varchar(50) DEFAULT NULL,
  `user_email` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table for outage information
CREATE TABLE `outages` (
  `outage_id` int(11) NOT NULL,
  `website_id` int(11) DEFAULT NULL,
  `status_code` int(11) DEFAULT NULL,
  `time_started` timestamp NULL DEFAULT NULL,
  `time_resolved` timestamp NULL DEFAULT NULL,
  `severity` varchar(20) DEFAULT NULL,
  `error_message` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--Table to store websites
CREATE TABLE `websites` (
  `website_id` int(11) DEFAULT NULL,
  `website_name` varchar(100) DEFAULT NULL,
  `website_url` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


ALTER TABLE `outages`
  ADD PRIMARY KEY (`outage_id`),
  ADD UNIQUE KEY `outage_id` (`outage_id`),
  ADD KEY `website_id` (`website_id`);


ALTER TABLE `websites`
  ADD UNIQUE KEY `website_id` (`website_id`);


ALTER TABLE `outages`
  ADD CONSTRAINT `outages_ibfk_1` FOREIGN KEY (`website_id`) REFERENCES `websites` (`website_id`);
COMMIT;

