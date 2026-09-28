-- Rappels : une seule relance par inscription (la veille du tournoi).
alter table public.registrations add column reminder_sent_at timestamptz;
