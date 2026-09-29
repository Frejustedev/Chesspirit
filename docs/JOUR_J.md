# Jour J : organiser Le Gambit de Cotonou sur Chesspirit

Samedi 3 octobre 2026, Jammin Bar, Cotonou : 15 + 0, 9 rondes au système suisse, inscription gratuite.
Toutes les manipulations se font sur **www.chesspirit.com/fr/admin**, depuis un téléphone ou un ordinateur.

---

## Avant le tournoi

### Dès maintenant

1. **Mettre la page du tournoi à jour.**
   - Dans Supabase, ouvrez **SQL Editor** et exécutez le fichier `supabase/production/updates/20260929-gambit-de-cotonou.sql`.
   - Exécutez ensuite `20260929-retirer-partenaires.sql` si les partenaires ne doivent plus apparaître.
   - Vérifiez le résultat sur la page publique : nom, lieu, 8 h 30, 15 + 0, 9 rondes, gratuit, prix.
2. **Diffuser l'affiche.**
   - Allez dans **Administration**, choisissez le tournoi, puis l'onglet **Affiches**.
   - Choisissez « Annonce » puis le format voulu (A4, Instagram, Statut WhatsApp, etc.).
   - Le QR code de l'affiche mène directement à l'inscription.
3. **Ajouter les arbitres et assistants.**
   - Onglet **Réglages**, section **Équipe du tournoi** : saisissez le téléphone ou l'e-mail de la personne, choisissez son rôle (« Arbitre principal », « Arbitre adjoint », « Opérateur de saisie »), puis **Ajouter**.
   - La personne doit s'être connectée au moins une fois sur chesspirit.com.
   - Le nom de l'arbitre principal figure dans l'export FIDE.
4. **Vérifier les départages** (onglet **Réglages**).
   - L'ordre par défaut est Buchholz tronqué, Buchholz, puis Sonneborn-Berger. Modifiez-le seulement si le règlement annoncé est différent.
   - Laissez **Points de l'exempt** à 1 point, sauf décision contraire.

### La veille (vendredi 2 octobre)

- Les inscriptions en ligne se ferment automatiquement le **1er octobre à 23 h 59**.
  L'ajout de joueurs sur place, lui, reste toujours possible depuis l'administration.
- Onglet **Inscrits**, **Exporter en CSV** : gardez une copie de la liste sur votre téléphone.
- Onglet **Rondes**, lien **Mode hors ligne (saisie des résultats sans réseau)** : ouvrez-le une fois **avec du réseau** sur chaque téléphone qui saisira des résultats. La page restera alors utilisable même si la connexion coupe dans la salle.
- **Matériel** : téléphones chargés et batterie externe, connexion 4G de secours, échiquiers et pendules réglées sur 15 min sans incrément. Une imprimante est facultative : les appariements s'affichent aussi en ligne.

---

## Le jour J

### 1. Accueil des joueurs (à partir de 8 h)

Allez dans **Administration**, choisissez le tournoi, puis :

- **Joueur inscrit avec son billet** : onglet **Pointage**, bouton **Activer la caméra**, puis scannez le QR code du billet sur le téléphone du joueur. Vous pouvez aussi taper le **Code du billet** et appuyer sur **Pointer**.
- **Joueur inscrit sans son billet** : onglet **Inscrits**, puis bouton **Pointer** sur sa ligne.
- **Joueur non inscrit** : onglet **Inscrits**, bloc **Ajouter un joueur sur place**.
  - Saisissez le prénom et le nom. Le sexe et la date de naissance sont utiles pour les prix « meilleure femme » et « meilleur jeune ».
  - Le téléphone est facultatif ; « 97 00 00 00 » suffit, l'indicatif +229 est ajouté automatiquement.
  - Laissez cochée la case **Pointer tout de suite**, puis appuyez sur **Ajouter le joueur**.
  - Avec son téléphone, le joueur pourra plus tard se connecter et retrouver son profil, ses parties et sa cote.
- Le compteur « X inscrits · Y pointés » indique où vous en êtes. **Seuls les joueurs pointés seront appariés.**

### 2. Chaque ronde (9 fois)

Onglet **Rondes**.

1. Laissez cochée la case **Uniquement les joueurs pointés**.
2. Appuyez sur **Générer la ronde N**. La ronde est créée **non publiée**.
   - Sans service d'appariement externe, la ronde porte la mention « secours, non homologué ». C'est normal : les règles suisses et les règles de couleur de la FIDE sont respectées.
   - Relisez rapidement les appariements. Au besoin, corrigez avec le crayon **Modifier l'appariement**.
3. Appuyez sur **Publier** : les joueurs voient leur table sur leur téléphone (page du tournoi, **En direct**).
4. **Afficher les appariements dans la salle**, au choix :
   - ouvrez sur un écran ou une télévision l'adresse `www.chesspirit.com/fr/competitions/tournoi-chesspirit-2026/direct?projection=1` : appariements et classement se mettent à jour tout seuls ;
   - ou utilisez **Imprimer**, puis **Appariements** ou **Cartes de table**.
5. **Saisir les résultats** sur chaque table avec les boutons **1–0**, **½–½** ou **0–1**.
   - Pour un forfait, choisissez **Autre…**, puis « 1–0 forfait », « 0–1 forfait » ou « Double forfait ».
   - Le classement se recalcule à chaque résultat.
6. Quand « Tous les résultats sont saisis » s'affiche, générez la ronde suivante.

**Joueur qui fait une pause ou abandonne** : dans **Rondes**, ouvrez **Joueurs (n)**.
- Choisissez « Bye ½ point » ou « Absent (0) » pour la prochaine ronde.
- Choisissez **Forfait général** s'il quitte le tournoi, ou **Réintégrer** s'il revient.

**Coupure de réseau** : continuez sur la page **Mode hors ligne**. Les résultats sont gardés sur le téléphone et envoyés automatiquement au retour du réseau (« X résultats en attente d'envoi »).

**Horaires indicatifs** : une ronde en 15 + 0 dure au plus 30 minutes. Avec 5 minutes d'appariement, comptez environ 35 minutes par ronde. Pour 9 rondes à partir de 8 h 30, avec une pause de 30 minutes après la ronde 5, la fin arrive vers 14 h 15.

**10 joueurs ou moins** : 9 rondes au système suisse deviennent mathématiquement impossibles sans faire rejouer deux joueurs ensemble. Avant la ronde 1, dans **Réglages** :
- avec exactement 10 joueurs, choisissez le système « Toutes rondes » (9 rondes) ;
- avec moins de 10 joueurs, réduisez le **Nombre de rondes** (au plus le nombre de joueurs moins 1).

### 3. Fin du tournoi

1. Quand la ronde 9 est complète, appuyez sur **Clôturer le tournoi** en bas de l'onglet **Rondes**. Le classement final est publié.
2. **Prix spéciaux** : sur la page publique, onglet **Résultats**, le classement complet permet de repérer la meilleure femme et le meilleur jeune de moins de 15 ans. Cela suppose d'avoir renseigné le sexe et la date de naissance.
3. **Affiche des résultats** : onglet **Affiches**, choisissez « Résultats ». L'affiche est prête pour WhatsApp et Instagram.
4. **Exports** (onglet **Résultats et parties**) :
   - « Rapport d'arbitrage (PDF) » ;
   - export au format **TRF** (FIDE, Swiss Manager) ;
   - toutes les parties au format PGN, si elles ont été saisies.
5. Chaque joueur retrouve son résultat et son **attestation de participation** dans son espace, à la rubrique **Mes tournois**.

---

## En cas de problème

| Situation | Que faire |
| --- | --- |
| « Saisissez tous les résultats de la ronde en cours… » | Il manque un résultat : cherchez la table sans résultat dans la ronde en cours. |
| Un appariement est faux | Crayon **Modifier l'appariement** avant **Publier**, ou **Supprimer cette ronde** (dernière ronde, sans résultat) puis la générer à nouveau. |
| Un joueur arrive après la ronde 1 | **Ajouter un joueur sur place**, avec la case **Pointer tout de suite** cochée : il sera apparié à partir de la ronde suivante. |
| Le site ne répond plus | Continuez en **Mode hors ligne**, ou notez les résultats sur papier et saisissez-les dès le retour du réseau. |
| Code de connexion non reçu | Vérifiez les spams. Attendez une minute, puis **Renvoyer le code**. |
