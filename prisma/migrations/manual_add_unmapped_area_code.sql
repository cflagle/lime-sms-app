-- Migration: add_unmapped_area_code_tracking
-- Created: 2026-01-13
-- Description: Adds UnmappedAreaCode table to track phone numbers with area codes not in our mapping

-- CreateTable
CREATE TABLE "UnmappedAreaCode" (
    "id" SERIAL NOT NULL,
    "areaCode" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "samplePhone" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnmappedAreaCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnmappedAreaCode_areaCode_key" ON "UnmappedAreaCode"("areaCode");

-- CreateIndex
CREATE INDEX "UnmappedAreaCode_count_idx" ON "UnmappedAreaCode"("count");
