CREATE TABLE `routeHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`speed` int DEFAULT 0,
	`heading` int DEFAULT 0,
	`address` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `routeHistory_id` PRIMARY KEY(`id`)
);
