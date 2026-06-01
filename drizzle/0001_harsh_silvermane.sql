CREATE TABLE `blockLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`action` enum('block','unblock') NOT NULL,
	`status` enum('requested','sent','confirmed','failed') DEFAULT 'requested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blockLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geofences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('casa','trabalho','escola','oficina','garagem','cidade','personalizada') DEFAULT 'personalizada',
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`radius` int DEFAULT 200,
	`active` boolean DEFAULT true,
	`alertOnEntry` boolean DEFAULT true,
	`alertOnExit` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geofences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int,
	`type` enum('cerca_entrada','cerca_saida','bloqueio','desbloqueio','sos','bateria_baixa','ignição_ligada','ignição_desligada','offline','furto_roubo','sistema') DEFAULT 'sistema',
	`title` varchar(200) NOT NULL,
	`message` text,
	`read` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`type` enum('furto','roubo','apropriacao','golpe','outro') NOT NULL,
	`status` enum('aberta','central_acionada','monitoramento','equipe_designada','em_diligencia','localizado','recuperado','finalizada') DEFAULT 'aberta',
	`protocol` varchar(20) NOT NULL,
	`description` text,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`address` text,
	`boDocument` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `occurrences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sosAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int,
	`type` enum('furto_roubo','acidente','pane','guincho','chaveiro','pneu','bateria','pane_seca','emergencia','central') NOT NULL,
	`status` enum('acionado','em_atendimento','finalizado') DEFAULT 'acionado',
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sosAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`plate` varchar(10) NOT NULL,
	`model` varchar(100) NOT NULL,
	`brand` varchar(100),
	`color` varchar(50),
	`year` int,
	`trackerStatus` enum('online','offline','alert') DEFAULT 'online',
	`ignition` boolean DEFAULT false,
	`blocked` boolean DEFAULT false,
	`batteryLevel` int DEFAULT 100,
	`lastLatitude` decimal(10,7),
	`lastLongitude` decimal(10,7),
	`lastAddress` text,
	`lastSignalAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `cpf` varchar(14);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `plan` varchar(64) DEFAULT 'basico';