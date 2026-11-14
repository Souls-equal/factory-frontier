# Phase 9 — vérifications en jeu

Ces scénarios ne sont pas encore validés par le joueur. Les statistiques sont
conservées uniquement tant que la machine existe dans la partie actuelle.

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

- L'inspection d'une machine montre ses moyennes par minute depuis sa création,
  son utilisation et les stocks. Le résumé d'usine regroupe les machines encore
  posées et compte les sorties pleines, entrées manquantes, coupures de courant et manque de charbon des fondeurs.
- Les moyennes ne sont pas des débits instantanés ; les données disparaissent à
  la démolition ou à la fin de la partie. Le temps passé dans les menus est exclu.
- Une voie transportant un excès d'un ingrédient peut bloquer celui qui suit :
  utiliser les deux voies ou équilibrer l'arrivée. Aucun mode de diagnostic
  spécialisé ni tableau historique n'est encore disponible.
