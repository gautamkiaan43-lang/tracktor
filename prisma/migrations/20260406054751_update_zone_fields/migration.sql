/*
  Warnings:

  - You are about to drop the column `distance` on the `zones` table. All the data in the column will be lost.
  - Added the required column `max_distance` to the `zones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `min_distance` to the `zones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `surcharge_per_hectare` to the `zones` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `zones` DROP COLUMN `distance`,
    ADD COLUMN `max_distance` DOUBLE NOT NULL,
    ADD COLUMN `min_distance` DOUBLE NOT NULL,
    ADD COLUMN `surcharge_per_hectare` DOUBLE NOT NULL;
