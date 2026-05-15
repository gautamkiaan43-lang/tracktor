/*
  Warnings:

  - You are about to drop the column `name` on the `zones` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `zones_name_key` ON `zones`;

-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `air_distance` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `farmer_latitude` DOUBLE NULL,
    ADD COLUMN `farmer_longitude` DOUBLE NULL,
    ADD COLUMN `hub_latitude` DOUBLE NULL,
    ADD COLUMN `hub_location` VARCHAR(191) NULL,
    ADD COLUMN `hub_longitude` DOUBLE NULL,
    ADD COLUMN `hub_name` VARCHAR(191) NULL,
    ADD COLUMN `payment_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    ADD COLUMN `road_distance` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `service_name_snapshot` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `services` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `effective_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `system_config` ADD COLUMN `base_latitude` DOUBLE NULL,
    ADD COLUMN `base_longitude` DOUBLE NULL,
    ADD COLUMN `per_km_rate` DOUBLE NOT NULL DEFAULT 500,
    ADD COLUMN `pricing_mode` VARCHAR(191) NOT NULL DEFAULT 'ZONE';

-- AlterTable
ALTER TABLE `zones` DROP COLUMN `name`,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    MODIFY `max_distance` DOUBLE NULL;

-- CreateTable
CREATE TABLE `fuel_price_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `old_price` DOUBLE NOT NULL,
    `new_price` DOUBLE NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
