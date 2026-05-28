-- Drop password storage (authentication is now owned by Firebase).
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- Add Firebase UID, nullable until first Firebase sign-in attaches it.
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
