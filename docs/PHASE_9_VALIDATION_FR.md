# Phase 9 — vérifications en jeu

Ces scénarios ne sont pas encore validés par le joueur. Les statistiques sont
limitées à la partie actuelle.

## Assembleur et composant renforcé

1. Construire deux constructeurs : choisir Iron Plate sur l'un et Iron Rod sur
   l'autre. Les alimenter en lingots de fer et en électricité.
2. Construire un Assembler (20 pierres, 15 bois, 10 kW) et le relier au réseau.
   Amener les plaques et les tiges sur les deux voies de l'entrée cyan arrière ;
   la sortie jaune avant envoie les composants renforcés vers un stockage.
3. Vérifier 1 plaque + 1 tige → 1 composant en 4 secondes. Ouvrir E pour voir
   les deux stocks, les alimenter ou les récupérer séparément.
4. Arrêter une entrée, couper le courant, puis saturer la sortie : vérifier les
   états, la conservation des objets et la reprise après correction.

## Fonderie et acier

1. Construire une Foundry (20 pierres, 15 bois, 10 kW). Amener minerai de fer
   et charbon sur ses deux voies arrière ou les ajouter depuis E.
2. Vérifier 1 minerai + 1 charbon → 1 lingot d'acier en 4 secondes. Relier sa
   sortie à un Constructor, choisir Steel Plate dans son inspection et vérifier
   1 lingot → 1 plaque d'acier en 2 secondes.
3. Pour changer de recette, vider entrée et sortie du Constructor. Les objets
   déjà en transit ne changent pas de type et peuvent bloquer une entrée.

## Statistiques et limites

- Appuyer sur H hors construction pour ouvrir le tableau de bord : comparer les
  productions, consommations et extractions par minute, puis les réseaux et
  états des machines. Fermer avec H, Échap ou le bouton et vérifier la reprise.
- Bloquer une sortie ou un convoyeur, enlever une entrée et couper l'électricité :
  les états et coordonnées doivent apparaître, puis disparaître après correction.
- Le tableau utilise les 60 derniers groupes d'une seconde de simulation. Au
  démarrage les débits sont extrapolés ; les valeurs aux frontières sont
  approximatives. Le menu met la simulation en pause. Un événement d'une machine
  démolie reste visible jusqu'à l'expiration de sa fenêtre ; tout est perdu en
  fin de session. L'inspection E garde ses propres moyennes depuis la construction.
- Une voie transportant un excès d'un ingrédient peut bloquer celui qui suit :
  utiliser les deux voies ou équilibrer l'arrivée. Le tableau montre des états
  constatés, sans déduire automatiquement la cause en amont ; aucun graphique
  historique ni sauvegarde n'est encore disponible.
