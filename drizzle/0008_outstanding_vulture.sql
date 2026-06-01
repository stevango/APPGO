ALTER TABLE `blockLogs` ADD `termsAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `blockLogs` ADD `ipAddress` varchar(45);--> statement-breakpoint
ALTER TABLE `blockLogs` ADD `userAgent` text;--> statement-breakpoint
ALTER TABLE `blockLogs` ADD `reason` text;--> statement-breakpoint
ALTER TABLE `blockLogs` ADD `vehicleSpeed` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `blockLogs` ADD `vehicleIgnition` boolean DEFAULT false;