-- Reconcile destination defaults with the Gestify source security contract.
-- A Supabase target may grant broad privileges to anon while CREATE TABLE runs,
-- even when the source tables had no such grants. The backup manifest must
-- confirm that the source anonymous grant count was zero before this file runs.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from PUBLIC;

revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all sequences in schema public from PUBLIC;

alter default privileges in schema public
  revoke all privileges on tables from anon;

alter default privileges in schema public
  revoke all privileges on tables from PUBLIC;

alter default privileges in schema public
  revoke all privileges on sequences from anon;

alter default privileges in schema public
  revoke all privileges on sequences from PUBLIC;
