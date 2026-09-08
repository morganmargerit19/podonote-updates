Diktae 1.2.0 — 6e retour de Nico : la liste des factures ne s'arrete plus, et une serie d'ameliorations d'ergonomie.

COMPTA
- Toutes les factures sont visibles : la liste est desormais paginee (100 par page, reglable a 25, 50, 100 ou 200) avec Precedent / Suivant et les numeros de page. Au-dela de 160 factures, la liste s'arretait net.
- Apres un changement de moyen de paiement, une facture marquee payee ou une suppression, on revient sur la meme page, sur la ligne modifiee.
- Filtre par periode (du... au...) avec des raccourcis : Ce mois, Mois dernier, Annee en cours, Annee precedente.
- Montants de la selection affiches en tete de liste : total, encaisse, en attente.
- Bouton Exporter (CSV) : la selection complete s'enregistre dans Documents\Diktae\Compta, prete pour Excel ou l'expert-comptable.

PATIENTS
- La recherche ignore accents et majuscules ("lefevre", "LEFEVRE" trouvent Lefevre) et cherche aussi par terrain (diabete, AOMI...) et par etiquette de soin. Meme chose pour la recherche de factures.
- En creant un dossier qui ressemble a un dossier existant (meme nom et prenom, ou meme date de naissance), un bandeau le signale avec un lien vers l'autre dossier et le rappel de "Fusionner un doublon". Rien n'est bloque.
- Les noms saisis tout en minuscules ou tout en majuscules sont remis au propre (MARTIN claire devient Martin Claire).
- Au-dela de 200 dossiers, la liste se replie derriere un bouton "Afficher les dossiers suivants" ; la recherche voit toujours tout.

FICHE DE SOIN
- Une fiche validee avec "patient diabetique : oui" ajoute le terrain Diabete (et Neuropathie / AOMI si coches) au dossier, qui apparait alors dans "Terrain a risque".

DOSSIER PATIENT
- Comparer deux visites fonctionne a nouveau (l'ecran s'affichait en vrac) et compare des fiches du meme type, avec les rubriques propres a chaque type.
- Le lien "Associer une poche" ne se coupe plus sur deux lignes ; date d'edition d'un bilan en francais.

DIVERS
- Le bouton de verrouillage demande confirmation avant de fermer la session.
- Fiche preference motrice : la carte "Detail du testing" n'apparait que lorsqu'elle contient quelque chose.
