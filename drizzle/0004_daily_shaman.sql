ALTER TABLE `vehicles` ADD `speed` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `heading` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `odometer` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `vehicles` ADD `hourmeter` decimal(8,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `vehicles` ADD `batteryBackup` decimal(4,1) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `vehicles` ADD `batteryMain` decimal(5,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `vehicles` ADD `gpsSignal` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `gpsSatellites` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `trackerMode` enum('active','sleep','deep_sleep','emergency') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `vehicles` ADD `trackerModel` varchar(50);--> statement-breakpoint
ALTER TABLE `vehicles` ADD `trackerSerial` varchar(50);--> statement-breakpoint
ALTER TABLE `vehicles` ADD `simStatus` enum('active','inactive','no_signal') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `vehicles` ADD `simSignal` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `lastGpsAt` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `vehicles` ADD `lastGprsAt` timestamp DEFAULT (now());