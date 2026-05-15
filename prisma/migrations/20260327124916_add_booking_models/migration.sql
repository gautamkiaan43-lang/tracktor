-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `base_rate_per_hectare` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `farmer_id` INTEGER NOT NULL,
    `service_id` INTEGER NOT NULL,
    `land_size` DOUBLE NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `base_price` DOUBLE NOT NULL,
    `distance_km` DOUBLE NOT NULL DEFAULT 0,
    `distance_charge` DOUBLE NOT NULL DEFAULT 0,
    `fuel_surcharge` DOUBLE NOT NULL DEFAULT 0,
    `total_price` DOUBLE NOT NULL,
    `final_price` DOUBLE NOT NULL,
    `tractor_id` INTEGER NULL,
    `operator_id` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_farmer_id_fkey` FOREIGN KEY (`farmer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
