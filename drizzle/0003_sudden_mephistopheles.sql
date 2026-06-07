CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleId` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`startAddress` text,
	`endAddress` text,
	`startLatitude` decimal(10,7),
	`startLongitude` decimal(10,7),
	`endLatitude` decimal(10,7),
	`endLongitude` decimal(10,7),
	`distanceKm` decimal(8,2),
	`maxSpeed` int DEFAULT 0,
	`avgSpeed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trips_id` PRIMARY KEY(`id`)
);
