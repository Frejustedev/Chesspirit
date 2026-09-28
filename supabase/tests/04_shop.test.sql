-- Boutique : prix et stock calculés par la base, codes promo, cartes cadeaux, points, commandes privées.
select tests.reset_role();
create temp table ids as select
  tests.create_user('client@test.bj') as client,
  tests.create_user('autre@test.bj') as autre,
  tests.create_user('shop@test.bj') as shop;
grant select on ids to anon, authenticated, service_role;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select client, 'Cli', 'Ent', '1990-01-01', 'F' from ids;
insert into public.profiles (user_id, first_name, last_name, birth_date, sex) select autre, 'Au', 'Tre', '1991-01-01', 'M' from ids;
insert into public.user_roles (user_id, role) select shop, 'admin_shop' from ids;
insert into public.products (id, slug, name, price_xof, kind) values
  ('00000000-0000-0000-0000-0000000d0001', 'produit-test', '{"fr":"Produit test"}', 10000, 'physical'),
  ('00000000-0000-0000-0000-0000000d0002', 'carte-test', '{"fr":"Carte test"}', 5000, 'gift_card');
insert into public.product_variants (id, product_id, stock, price_xof) values
  ('00000000-0000-0000-0000-0000000d0011', '00000000-0000-0000-0000-0000000d0001', 3, null),
  ('00000000-0000-0000-0000-0000000d0012', '00000000-0000-0000-0000-0000000d0002', 0, 5000);
insert into public.promo_codes (code, kind, value) values ('TEST20', 'percent', 20), ('EPUISE', 'amount', 1000);
update public.promo_codes set max_uses = 1, uses = 1 where code = 'EPUISE';
insert into public.gift_cards (code, initial_xof, balance_xof, status) values ('CAD-TEST-TEST-0001', 3000, 3000, 'active');

select tests.as_anon();
select tests.eq((select count(*)::int from public.products where slug = 'produit-test'), 1, 'catalogue public');
select tests.no_read($$select * from public.promo_codes$$, 'codes promo non listables (anonyme)');
select tests.eq((select valid from public.check_promo('test20', 10000)), true, 'code promo vérifiable');
select tests.eq((select discount_xof from public.check_promo('TEST20', 10000)), 2000, 'remise de 20 %');
select tests.eq((select valid from public.check_promo('EPUISE', 10000)), false, 'code épuisé refusé');
select tests.throws($$select public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0011","quantity":1}]', 'pickup', '{}', 'X', '+22990000000')$$, 'anonyme : commande impossible');
select tests.throws($$insert into public.orders (delivery_method, contact_name, contact_phone, subtotal_xof, total_xof) values ('pickup', 'x', '1', 1, 0)$$, 'anonyme : insertion directe interdite');

select tests.login_as((select client from ids));
select tests.throws($$select public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0011","quantity":4}]', 'pickup', '{}', 'Cli Ent', '+22990000000')$$, 'stock insuffisant refusé');
select tests.throws($$select public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0011","quantity":1}]', 'cotonou', '{}', 'Cli Ent', '+22990000000')$$, 'adresse obligatoire en livraison');
create temp table o1 as select * from public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0011","quantity":2}]',
  'cotonou', '{"line":"Rue test"}', 'Cli Ent', '+229 90 00 00 00', null, 'TEST20', 'CAD-TEST-TEST-0001');
grant select on o1 to authenticated, service_role, anon;
-- 20000 − 4000 + 1500 (livraison) − 3000 (carte) = 14500
select tests.eq((select total_xof from o1), 14500, 'total calculé par la base (remise, livraison, carte cadeau)');
select tests.eq((select status::text from o1), 'pending_payment', 'commande en attente de paiement');
select tests.eq((select stock from public.product_variants where id = '00000000-0000-0000-0000-0000000d0011'), 1, 'stock réservé');
select tests.no_write($$update public.orders set total_xof = 1$$, 'le client ne modifie pas sa commande');
select tests.throws($$select public.set_order_status((select id from o1), 'shipped')$$, 'le client ne change pas le statut');
select tests.eq(public.gift_card_balance('CAD-TEST-TEST-0001'), null::int, 'carte cadeau entièrement utilisée');

select tests.login_as((select autre from ids));
select tests.eq((select count(*)::int from public.orders), 0, 'commande invisible pour un tiers');
select tests.eq((select count(*)::int from public.order_items), 0, 'lignes invisibles pour un tiers');
select tests.throws($$select public.cancel_order((select id from o1))$$, 'un tiers n''annule pas la commande');
select tests.eq((select count(*)::int from public.track_order((select number from o1), '+22990000001')), 0, 'suivi : mauvais téléphone refusé');
select tests.eq((select count(*)::int from public.track_order((select number from o1), '22990000000')), 1, 'suivi : numéro + téléphone');

-- Paiement confirmé par le webhook (rôle service).
select tests.reset_role();
select private.order_paid((select id from o1));
select tests.eq((select status::text from public.orders where id = (select id from o1)), 'paid', 'commande payée');
select tests.eq((select points from public.loyalty_ledger where order_id = (select id from o1) and reason = 'order_earned'), 145, 'points de fidélité gagnés (1 par 100 F)');
select tests.eq((select uses from public.promo_codes where code = 'TEST20'), 1, 'utilisation du code comptée');

select tests.login_as((select client from ids));
select tests.eq(public.loyalty_balance(), 145, 'solde de points');
select tests.throws($$select public.cancel_order((select id from o1))$$, 'le client n''annule plus une commande payée');
insert into public.product_reviews (product_id, profile_id, rating) values ('00000000-0000-0000-0000-0000000d0001', private.my_profile_id(), 5);
select tests.eq((select reviews_count from public.products where slug = 'produit-test'), 1, 'avis d''un acheteur publié');
-- Carte cadeau achetée avec des points : total nul, commande payée immédiatement, carte émise.
create temp table o2 as select * from public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0012","quantity":1,"gift":{"recipient_name":"Ami"}}]',
  'pickup', '{}', 'Cli Ent', '+22990000000', null, null, null, 10000);
grant select on o2 to authenticated, service_role, anon;
select tests.eq((select total_xof from o2), 5000, 'les points ne paient pas une carte cadeau');
select tests.eq((select delivery_method from o2), 'none', 'pas de livraison pour une carte cadeau');

select tests.login_as((select autre from ids));
select tests.throws($$insert into public.product_reviews (product_id, profile_id, rating) values ('00000000-0000-0000-0000-0000000d0001', private.my_profile_id(), 1)$$, 'avis réservé aux acheteurs');

select tests.login_as((select shop from ids), 'aal2');
select tests.eq((select count(*)::int >= 2 from public.orders where id in ((select id from o1), (select id from o2))), true, 'la boutique voit les commandes');
select tests.eq((select status::text from public.set_order_status((select id from o1), 'shipped', 'Livreur en route')), 'shipped', 'statut logistique mis à jour');
select tests.throws($$select public.set_order_status((select id from o2), 'shipped')$$, 'commande impayée non expédiable');
select tests.eq((select status::text from public.cancel_order((select id from o2))), 'cancelled', 'annulation par la boutique');
select tests.eq(public.loyalty_balance(), 0, 'boutique sans points propres');
select tests.reset_role();
select tests.eq((select coalesce(sum(points), 0)::int from public.loyalty_ledger l join public.profiles p on p.id = l.profile_id where p.first_name = 'Cli'), 145, 'points restitués après annulation');

select tests.login_as((select shop from ids), 'aal1');
select tests.eq((select count(*)::int from public.orders), 0, 'sans double authentification : aucune commande visible');

-- Correctifs de sécurité : remise interdite sur les cartes cadeaux, code limité par client.
select tests.login_as((select client from ids));
select tests.throws($$select public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0011","quantity":1}]', 'pickup', '{}', 'Cli Ent', '+22990000000', null, 'TEST20')$$, 'code promo déjà utilisé par ce client');
select tests.throws($$select public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0012","quantity":1}]', 'pickup', '{}', 'Cli Ent', '+22990000000', null, 'EPUISE')$$, 'code épuisé refusé à la commande');
select tests.reset_role();
update public.promo_codes set uses = 0, max_uses = 5 where code = 'EPUISE';
select tests.login_as((select client from ids));
select tests.eq((select total_xof from public.place_order('[{"variant_id":"00000000-0000-0000-0000-0000000d0012","quantity":1}]', 'pickup', '{}', 'Cli Ent', '+22990000000', null, 'EPUISE')), 5000, 'pas de remise sur une carte cadeau');
