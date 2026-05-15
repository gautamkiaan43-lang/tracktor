-- CreateTable
CREATE TABLE `fuel_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operator_id` INTEGER NOT NULL,
    `tractor_id` INTEGER NULL,
    `liters` DOUBLE NOT NULL,
    `cost` DOUBLE NOT NULL,
    `station` VARCHAR(191) NOT NULL,
    `receipt_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fuel_logs` ADD CONSTRAINT `fuel_logs_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
