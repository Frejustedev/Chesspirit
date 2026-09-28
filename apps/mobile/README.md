# Application mobile Chesspirit (Expo)

Application React Native (Expo SDK 57, expo-router) branchée sur la même base Supabase que le site, avec les mêmes règles d'accès (RLS). Elle ne contient que des adresses publiques (clé `anon`), aucun secret.

## Écrans

- **Tournois** : calendrier, fiche du tournoi, inscription de soi ou de ses enfants (paiement Mobile Money démarré par le site, ouvert dans le navigateur intégré ; ou paiement sur place).
- **Cotes** : mes cotes (rapide, blitz, classique, en ligne) et classement public.
- **Parties** : mes parties, ouvertes dans le lecteur du site.
- **Alertes** : notifications reçues, marquage lu, activation des notifications du téléphone (jeton Expo enregistré dans `push_tokens`).
- **Profil** : identité, ville et club modifiables ; carte de membre, famille, données et suppression du compte sur le site ; déconnexion.

Connexion sans mot de passe par code SMS ou e-mail (comme le site). La session est gardée dans le trousseau du téléphone (`expo-secure-store`, découpée en morceaux de moins de 2 Ko).

L'inscription passe par `POST /api/mobile/register` du site (jeton de session en `Authorization: Bearer`), qui applique exactement les règles du site.

## Lancer en local

```bash
cp .env.example .env          # URL Supabase locale, clé anon, adresse du site
pnpm --filter chesspirit-mobile start
```

Sur un téléphone, remplacer `localhost` par l'adresse IP de l'ordinateur.

## Vérifications

```bash
pnpm --filter chesspirit-mobile typecheck
pnpm --filter chesspirit-mobile test
npx expo export --platform android   # vérifie que l'application se compile
```

## Publication (non faite)

`eas.json` contient trois profils (`development`, `preview` en APK interne, `production`). Rien n'a été publié ni compilé sur EAS : il faut un compte Expo, `eas init` (renseigne `extra.eas.projectId`, nécessaire aux notifications), des icônes définitives, puis les comptes Google Play et Apple Developer. Voir `docs/MISE_EN_LIGNE.md`.

## Limites connues

- Les notifications du téléphone sont enregistrées (jetons) mais l'envoi depuis le serveur par le service Expo Push n'est pas encore branché : les notifications restent envoyées par SMS, e-mail et WhatsApp.
- Les tournois dont le formulaire demande des champs complémentaires s'inscrivent sur le site.
- Interface en français seulement.
