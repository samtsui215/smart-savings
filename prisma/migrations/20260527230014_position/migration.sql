-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_userId_parentId_position_idx" ON "Category"("userId", "parentId", "position");
