Diktae 1.1.9 — 5e retour de Nico, multi-cabinet et separation des locuteurs.

Cette version reprend l'integralite de la 1.1.8 (jamais installee) : un poste en
1.1.7 recoit tout en une seule mise a jour.

COMPTA
- Fini de tout refaire a chaque paiement : apres avoir change un moyen de paiement ou supprime une facture, la liste revient telle qu'elle etait (mois, filtres, recherche) et se repositionne sur la ligne modifiee.
- Compta par cabinet : EHPAD, second cabinet... chaque facture est rattachee a son cabinet des l'emission, avec une vue Tous les cabinets qui cumule.

DOSSIER PATIENT
- Fusion de deux dossiers en double : tout l'historique du doublon est reattribue, puis le doublon disparait.

BILAN
- Asymetries du dos : une epaule plus basse donne bien le cote oppose plus haut. Le sens etait inverse.

TRANSCRIPTION
- Separation des locuteurs (praticien / patient) desormais automatique : plus besoin de compte ni de jeton HuggingFace. Les modeles se telechargent tout seuls au premier demarrage (environ 29 Mo) et restent sur le poste.

LICENCE
- Bouton Copier a cote de l'identifiant de l'ordinateur, qu'on ne pouvait meme pas selectionner.

ETAT DU SYSTEME
- La ligne de la diarisation annoncait "sans distinguer praticien et patient" alors que la separation des locuteurs fonctionne : elle suit maintenant l'etat reel.
- La tuile Ollama affichait 0 modele alors qu'elle n'interroge pas Ollama en backend Sonnet : elle indique desormais "non utilise".

SOUS LE CAPOT
- ffmpeg retrouve meme quand il n'est pas dans le PATH de l'application.
- Compatibilite avec les differentes versions de WhisperX installees selon les postes.
