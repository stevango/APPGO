CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int,
	`description` varchar(200) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`paidAt` timestamp,
	`status` enum('paid','pending','overdue','cancelled') NOT NULL DEFAULT 'pending',
	`method` enum('boleto','credit_card','debit_card','pix','recurring_card') NOT NULL DEFAULT 'boleto',
	`boletoUrl` text,
	`boletoBarcode` varchar(60),
	`referenceMonth` varchar(7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
