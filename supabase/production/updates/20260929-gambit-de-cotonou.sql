-- Informations réelles du tournoi du 3 octobre 2026 (affiche « Le Gambit de Cotonou » fournie par le propriétaire).
-- À exécuter une fois dans SQL Editor du projet de production. Homologation et nombre de places : à confirmer.
update public.tournaments set
  name = 'Le Gambit de Cotonou',
  edition = '1re édition',
  summary = '{"fr": "Tournoi d''échecs en cadence rapide 15 + 0, 9 rondes au système suisse, au Jammin Bar de Cotonou. Ouvert à tous, inscription gratuite.", "en": "Rapid chess tournament, 15 + 0, 9-round Swiss, at Jammin Bar in Cotonou. Open to all, free entry."}',
  description = '{"fr": "Le Gambit de Cotonou, 1re édition : stratégie, partage, passion. Tournoi ouvert à tous, en cadence rapide (15 minutes par joueur, sans incrément), 9 rondes au système suisse, le samedi 3 octobre 2026 à partir de 8 h 30 au Jammin Bar de Cotonou. Inscription gratuite et obligatoire, jusqu''au 1er octobre 2026. Dotation pour les 3 premiers, prix de la meilleure femme et du meilleur jeune (moins de 15 ans). Plus qu''un jeu, une communauté.", "en": "Le Gambit de Cotonou, 1st edition: strategy, sharing, passion. An open rapid tournament (15 minutes per player, no increment), 9-round Swiss, on Saturday 3 October 2026 from 8:30 am at Jammin Bar in Cotonou. Free, mandatory registration until 1 October 2026. Prizes for the top 3, best woman and best junior (under 15). More than a game, a community."}',
  venue = 'Jammin Bar',
  city = 'Cotonou',
  starts_at = '2026-10-03 08:30:00+01',
  registration_closes_at = '2026-10-01 23:59:00+01',
  cadence = 'rapid',
  base_minutes = 15,
  increment_seconds = 0,
  rounds_count = 9,
  pairing_system = 'swiss_dutch',
  entry_fee_xof = 0,
  allow_online_payment = false,
  unconfirmed_fields = '{rated,capacity}'
where slug = 'tournoi-chesspirit-2026';

delete from public.prizes
  where tournament_id = (select id from public.tournaments where slug = 'tournoi-chesspirit-2026');
insert into public.prizes (tournament_id, kind, rank, category, label, position)
select t.id, p.kind, p.rank, p.category, p.label::jsonb, p.position
from public.tournaments t,
  (values
    ('rank', 1, null, '{"fr": "1er", "en": "1st"}', 1),
    ('rank', 2, null, '{"fr": "2e", "en": "2nd"}', 2),
    ('rank', 3, null, '{"fr": "3e", "en": "3rd"}', 3),
    ('category', null, 'women', '{"fr": "Meilleure femme", "en": "Best woman"}', 4),
    ('category', null, 'u15', '{"fr": "Meilleur jeune (moins de 15 ans)", "en": "Best junior (under 15)"}', 5)
  ) as p(kind, rank, category, label, position)
where t.slug = 'tournoi-chesspirit-2026';

select name, venue, starts_at at time zone 'Africa/Porto-Novo' as debut, rounds_count, entry_fee_xof,
  (select count(*) from public.prizes where tournament_id = t.id) as prix
from public.tournaments t where slug = 'tournoi-chesspirit-2026';
