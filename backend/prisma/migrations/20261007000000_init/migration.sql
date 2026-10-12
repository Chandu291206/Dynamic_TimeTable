-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CR');

-- CreateTable
CREATE TABLE "Faculty" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "staffId" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "qualification" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "imageSourceUrl" TEXT,
    "profileSourceUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastScrapedAt" TIMESTAMP(3),
    "imageHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassRoom" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "branch" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableSlot" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "startTime" CHAR(5) NOT NULL,
    "endTime" CHAR(5) NOT NULL,
    "subjectId" INTEGER,
    "facultyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableOverride" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "startTime" CHAR(5) NOT NULL,
    "endTime" CHAR(5) NOT NULL,
    "subjectId" INTEGER,
    "facultyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimetableOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "classId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Faculty_staffId_key" ON "Faculty"("staffId");
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");
CREATE UNIQUE INDEX "ClassRoom_year_branch_section_key" ON "ClassRoom"("year", "branch", "section");
CREATE INDEX "TimetableSlot_classId_day_idx" ON "TimetableSlot"("classId", "day");
CREATE UNIQUE INDEX "TimetableSlot_classId_day_startTime_endTime_key" ON "TimetableSlot"("classId", "day", "startTime", "endTime");
CREATE INDEX "TimetableOverride_classId_date_idx" ON "TimetableOverride"("classId", "date");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_role_classId_idx" ON "User"("role", "classId");

ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
