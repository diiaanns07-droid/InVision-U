/*
  Warnings:

  - The `verifiedStatus` column on the `Certificate` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[applicationId,sourceType]` on the table `ModelScore` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `certType` on the `Certificate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sourceType` on the `ModelScore` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ModelSourceType" AS ENUM ('ESSAY', 'INTERVIEW', 'VIDEO');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('ENT', 'IELTS', 'SAT', 'EXTRA', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "certType",
ADD COLUMN     "certType" "CertificateType" NOT NULL,
DROP COLUMN "verifiedStatus",
ADD COLUMN     "verifiedStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "EssaySubmission" ADD COLUMN     "fileKey" TEXT;

-- AlterTable
ALTER TABLE "ModelScore" ADD COLUMN     "deepHumanPotential" DOUBLE PRECISION,
ADD COLUMN     "leaderPotential" DOUBLE PRECISION,
DROP COLUMN "sourceType",
ADD COLUMN     "sourceType" "ModelSourceType" NOT NULL;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "telegram" TEXT;

-- AlterTable
ALTER TABLE "VideoSubmission" ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "fileKey" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Certificate_applicationId_certType_idx" ON "Certificate"("applicationId", "certType");

-- CreateIndex
CREATE UNIQUE INDEX "ModelScore_applicationId_sourceType_key" ON "ModelScore"("applicationId", "sourceType");

-- CreateIndex
CREATE INDEX "QuestionnaireAnswer_applicationId_orderIndex_idx" ON "QuestionnaireAnswer"("applicationId", "orderIndex");
