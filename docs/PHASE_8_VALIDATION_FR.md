# Phase 8 — essais en jeu

**Statut :** intégration jouable, à valider par le joueur. Les sauvegardes ne sont
pas encore implémentées : recharger efface les constructions et leur contenu.
La pose des fondations est inchangée.

## Mise en route

1. Construire un **Miner Mk.1** sur un gisement, un **Power Pole** et un
   **Biomass Generator** via Q. La création nécessite des matériaux ; le mode
   créatif de Q permet de tester gratuitement les constructions.
2. Placer le poteau à moins de 10 m en trois dimensions du générateur et du
   mineur : les câbles apparaissent automatiquement. Chaque bâtiment se relie au
   poteau le plus proche ; les poteaux proches se relient entre eux.
3. Viser le générateur, appuyer sur E puis **Add Wood**. Fermer le panneau :
   les panneaux ouverts mettent la simulation en pause. Le mineur doit produire.
4. E sur le poteau ou la machine montre l'état du réseau et ses chiffres. Le
   mineur, la fonderie et le constructeur demandent chacun 10 kW quand activés ;
   le générateur fournit 30 kW et consomme un bois toutes les 30 secondes quand
   un réseau en ligne lui demande de l'énergie.

## Scénarios à vérifier

- [ ] Une machine sans poteau ou sans générateur alimenté indique **NO_POWER**
  et ne produit pas. Ajouter du bois relance la production.
- [ ] Couper l'alimentation ou laisser le combustible s'épuiser pendant une
  recette : la progression et les objets restent, puis la recette reprend.
- [ ] Ajouter un quatrième consommateur à un seul générateur : **overloaded**,
  demande 40 kW, disponible 30 kW, alimentation 0 kW. Désactiver une machine
  ou ajouter un générateur alimenté : le réseau repart.
- [ ] Construire puis démolir un poteau reliant deux réseaux. Vérifier fusion,
  séparation, câbles visibles et compteurs ; un bâtiment peut changer de poteau
  quand on en place un plus proche.
- [ ] Ouvrir E sur un générateur, ajouter puis récupérer du bois, le désactiver et
  le réactiver. La démolition est bloquée tant qu'il contient du bois stocké.
  Attention : démolir un générateur vide perd le temps de combustion restant.
- [ ] Vérifier que la fonderie demande toujours du charbon en plus de l'électricité,
  et que les convoyeurs continuent de fonctionner normalement.

## Règles actuelles

Les câbles sont automatiques et gratuits, pas d'outil pour les couper un par un.
Toute machine activée réserve sa puissance même si son entrée manque ou sa sortie
est pleine. Tous les générateurs disponibles du réseau consomment du bois à
plein régime dès que le réseau en ligne a une demande ; en surcharge, à vide ou
isolés, ils n'en consomment pas. Les réglages et coûts pourront évoluer.
