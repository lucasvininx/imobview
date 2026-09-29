-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Tour" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "draft" JSONB NOT NULL DEFAULT '{"scenes":[],"initialSceneId":null}',
    "published" JSONB,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanoramaAsset" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadKey" TEXT NOT NULL,
    "fileName" VARCHAR(160) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PanoramaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tour_organizationId_propertyId_createdAt_idx" ON "Tour"("organizationId", "propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_id_organizationId_key" ON "Tour"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PanoramaAsset_storageKey_key" ON "PanoramaAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "PanoramaAsset_uploadKey_key" ON "PanoramaAsset"("uploadKey");

-- CreateIndex
CREATE INDEX "PanoramaAsset_organizationId_tourId_status_idx" ON "PanoramaAsset"("organizationId", "tourId", "status");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanoramaAsset" ADD CONSTRAINT "PanoramaAsset_tourId_organizationId_fkey" FOREIGN KEY ("tourId", "organizationId") REFERENCES "Tour"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
