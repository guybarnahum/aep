-- Migration: 0009_add_internal_monologue_to_decisions.sql
-- Goal: Add internal_monologue column to decisions table for cognitive trace

ALTER TABLE decisions ADD COLUMN internal_monologue TEXT;