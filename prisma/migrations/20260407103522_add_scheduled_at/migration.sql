-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `scheduled_at` DATETIME(3) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'pending';
