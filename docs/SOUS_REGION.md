# Extension à la sous-région

Chesspirit est lancé au Bénin. La base est prête à accueillir d'autres pays sans migration de données ; l'ouverture d'un pays est une décision à prendre pays par pays.

## Ce qui est prêt

- **Pays sur chaque fiche** : profils, tournois et structures ont un code pays (ISO 3166, `BJ` par défaut) relié à la table `countries`.
- **Table `countries`** : Bénin ouvert ; Togo, Burkina Faso, Niger, Côte d'Ivoire, Sénégal, Mali, Nigéria et Ghana préparés mais fermés (indicatif téléphonique, monnaie, fuseau horaire). Ouverture par la super-administration dans _Administration → Réglages → Pays_.
- **Profil** : dès qu'un second pays est ouvert, le formulaire propose le pays ; le département n'est demandé que pour le Bénin. Un pays fermé est refusé à l'enregistrement.
- **Téléphones** : tous les numéros au format international (E.164) sont acceptés.
- **Monnaie** : le franc CFA (XOF) est commun aux pays de l'UEMOA ; tous les montants sont stockés en XOF.
- **Boutique** : zone de livraison « sous-région » déjà prévue.
- **Fuseau** : les dates sont stockées en UTC et affichées à l'heure de Porto-Novo (UTC+1, comme le Niger et le Nigéria ; le Togo, le Burkina Faso, la Côte d'Ivoire, le Sénégal, le Mali et le Ghana sont en UTC+0).

## À faire avant d'ouvrir un pays

1. **Paiement** : vérifier auprès du prestataire (FedaPay, KKiaPay) que les opérateurs Mobile Money du pays sont couverts et activés sur le compte marchand.
2. **SMS** : vérifier l'acheminement et le coût des SMS de connexion vers ce pays chez le fournisseur choisi.
3. **Monnaie** : pour le Nigéria (NGN) ou le Ghana (GHS), ajouter la conversion ou des tarifs dans la monnaie locale (non fait : tous les prix sont en XOF).
4. **Fuseau** : afficher les horaires des tournois dans le fuseau du pays organisateur (colonne `timezone` prête, affichage non branché).
5. **Juridique** : faire relire mentions légales, CGU, CGV et politique de confidentialité pour le pays (protection des données, protection des mineurs).
6. **Cote et classements** : décider si la cote Chesspirit est commune ou par pays ; ajouter un filtre pays aux classements.
7. **Fédérations** : prendre contact avec la fédération nationale du pays avant tout tournoi homologué.
8. **Contenus** : langues locales (le lexique accepte d'autres langues sur le modèle du fon).
