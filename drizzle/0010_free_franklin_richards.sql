CREATE TABLE `paymentChangeHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`previousMethod` varchar(30) NOT NULL,
	`newMethod` varchar(30) NOT NULL,
	`incentiveType` enum('discount','marketplace_product','none') DEFAULT 'none',
	`incentiveValue` varchar(200),
	`incentiveClaimed` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentChangeHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paymentMethods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('boleto','credit_card','debit_card','pix','recurring_card') NOT NULL,
	`isActive` boolean DEFAULT true,
	`cardLast4` varchar(4),
	`cardBrand` varchar(30),
	`billingDay` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentMethods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceAppointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`servicePointId` int NOT NULL,
	`scheduledDate` timestamp NOT NULL,
	`status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
	`serviceType` varchar(100) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceAppointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `servicePoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`address` text NOT NULL,
	`city` varchar(100),
	`state` varchar(2),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`phone` varchar(20),
	`whatsapp` varchar(20),
	`openHours` varchar(100),
	`services` text,
	`active` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `servicePoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicleOfflineReasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`reason` enum('all_ok','garage','workshop','maintenance','other') NOT NULL,
	`details` text,
	`needsService` boolean DEFAULT false,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vehicleOfflineReasons_id` PRIMARY KEY(`id`)
);
