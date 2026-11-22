-- Phase 2 Migration: Add issues column to FacultySyncRun
ALTER TABLE "FacultySyncRun" ADD COLUMN IF NOT EXISTS "issues" JSONB;
