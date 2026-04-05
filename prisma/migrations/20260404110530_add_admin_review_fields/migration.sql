-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "adminScore" DOUBLE PRECISION,
ADD COLUMN     "reviewComment" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
