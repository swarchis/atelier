-- Vendor Platform: certifications, factory capabilities, a price range,
-- manual (founder-set, not AI-decided) verification, and an onboarding
-- lifecycle stage on top of the existing vendor record.
-- Run this in the Supabase SQL Editor after 003_vendor_enhancements.sql.

alter table vendors add column if not exists certifications jsonb not null default '[]'::jsonb;
alter table vendors add column if not exists capabilities jsonb not null default '[]'::jsonb;

-- Free-text on purpose ("$8-$12/unit", "~$15/unit FOB") — pricing from search
-- results or a pasted listing is rarely a single clean number, and forcing
-- it into numeric min/max columns would mean silently dropping the caveats
-- that actually matter (FOB vs landed, sample vs bulk, etc).
alter table vendors add column if not exists price_range text;

-- Verification is a human trust judgment, not something AI decides — this is
-- a manual toggle the founder sets themselves after their own diligence
-- (checking a business registration, a factory visit, a referral), with
-- room to note what was actually verified.
alter table vendors add column if not exists verified boolean not null default false;
alter table vendors add column if not exists verified_notes text;

-- prospect -> contacted -> sampling -> onboarded: where this vendor
-- relationship actually stands, independent of the `label` trust tag.
alter table vendors add column if not exists onboarding_stage text not null default 'prospect';
