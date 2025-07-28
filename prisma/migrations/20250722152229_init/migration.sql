/*
  Warnings:

  - Added the required column `followId` to the `Followers` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Followers" DROP CONSTRAINT "Followers_userId_fkey";

-- AlterTable
ALTER TABLE "Followers" ADD COLUMN     "followId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Followers" ADD CONSTRAINT "Followers_followId_fkey" FOREIGN KEY ("followId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
