-- Retire les partenaires affichés sur la page du tournoi du 3 octobre (demande du propriétaire, 29 septembre 2026).
delete from public.tournament_partners
  where tournament_id = (select id from public.tournaments where slug = 'tournoi-chesspirit-2026');
