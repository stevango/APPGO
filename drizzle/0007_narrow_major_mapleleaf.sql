CREATE TABLE `shareLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`label` varchar(100),
	`expiresAt` timestamp NOT NULL,
	`active` boolean DEFAULT true,
	`viewCount` int DEFAULT 0,
	`lastViewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shareLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `shareLinks_token_unique` UNIQUE(`token`)
);
