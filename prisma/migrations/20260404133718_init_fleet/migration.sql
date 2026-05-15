/*
  Warnings:

  - You are about to drop the column `model_name` on the `tractors` table. All the data in the column will be lost.
  - You are about to drop the column `plate_number` on the `tractors` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[operator_id]` on the table `tractors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `tractors` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `tractors` DROP FOREIGN KEY `tractors_operator_id_fkey`;

-- DropIndex
DROP INDEX `tractors_plate_number_key` ON `tractors`;

-- AlterTable
ALTER TABLE `system_config` ADD COLUMN `contact_email` VARCHAR(191) NOT NULL DEFAULT 'ops@dummy.com',
    ADD COLUMN `hub_location` VARCHAR(191) NOT NULL DEFAULT 'Ludhiana Central Command',
    ADD COLUMN `hub_name` VARCHAR(191) NOT NULL DEFAULT 'TractorLink Admin HQ',
    ADD COLUMN `pre_alert_hours` INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN `service_interval_hours` INTEGER NOT NULL DEFAULT 250,
    ADD COLUMN `support_email` VARCHAR(191) NOT NULL DEFAULT 'support@dummy.com';

-- AlterTable
ALTER TABLE `tractors` DROP COLUMN `model_name`,
    DROP COLUMN `plate_number`,
    ADD COLUMN `model` VARCHAR(191) NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    MODIFY `operator_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `fuel_logs_tractor_id_fkey` ON `fuel_logs`(`tractor_id`);

-- CreateIndex
CREATE UNIQUE INDEX `tractors_operator_id_key` ON `tractors`(`operator_id`);

-- AddForeignKey
ALTER TABLE `tractors` ADD CONSTRAINT `tractors_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_logs` ADD CONSTRAINT `fuel_logs_tractor_id_fkey` FOREIGN KEY (`tractor_id`) REFERENCES `tractors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
