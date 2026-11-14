# Phase 7 — guide de validation en jeu

**Statut : validation globale par le joueur.** Il ne signale aucun bug apparent
dans ce qu'il a testé ; les résultats de chaque scénario ci-dessous ne sont pas
connus individuellement. La phase 8 est désormais jouable et attend sa propre
validation. Les changements disparaissent au rechargement : les sauvegardes relèvent
d'une phase ultérieure.

Ouvrir [le jeu](https://souls-equal.github.io/factory-frontier/). Dans Q, le
mode créatif rend la construction gratuite ; les machines ont toujours besoin
de leurs entrées. Les ports cyan sont les entrées et les ports jaunes les sorties.
Fermer un panneau avant d'observer le fonctionnement : il met la simulation en
pause. Signaler pour chaque problème le bâtiment, l'orientation, la hauteur, le
mode choisi et une capture si possible.

## 1. Stockage et transferts

- [ ] Relier une entrée et une sortie de conteneur à des convoyeurs ; remplir les
  huit emplacements et vérifier que l'entrée se bloque puis reprend après retrait.
- [ ] Dans E, sélectionner une pile du joueur, saisir une quantité et la déposer ;
  choisir une pile du stockage et en retirer une quantité. Une case vide transfère
  toute la pile, et un nombre négatif, nul, fractionnaire ou supérieur à la pile ne
  transfère rien. Vérifier aussi **Retrieve contents** et un inventaire plein.
- [ ] Tester le filtre de sortie du stockage avec deux matériaux, son rétablissement
  sur **Any item**, et la protection contre la démolition d'un stockage non vide.
- [ ] Dans un terminal, retirer une quantité ; vérifier qu'il ne propose pas de
  dépôt manuel. Utiliser Échap après avoir utilisé un champ ou une liste.

## 2. Splitter et merger

- [ ] Alimenter un splitter et relier ses trois sorties à des récepteurs. En mode
  **Balanced**, vérifier la répartition et la reprise après blocage d'une branche.
- [ ] Essayer **Overflow** puis **Strict priority** avec une sortie préférée
  bloquée ou déconnectée. Essayer **Filter by item** avec du fer, du charbon et
  une sortie **Unmatched items**. Un objet destiné à une sortie indisponible doit
  attendre, sans être redirigé vers une sortie non autorisée.
- [ ] Alimenter les trois entrées d'un merger avec des matériaux distincts et
  vérifier qu'aucune entrée active n'est durablement affamée. Remplir le récepteur,
  puis le vider. La récupération manuelle et la démolition doivent préserver les
  objets dans les tampons, même si l'inventaire du joueur est plein.

## 3. Lifts et plateformes

- [ ] Construire un lift montant puis descendant, tourner avec R et essayer les
  deux ordres de placement. Ajuster la hauteur avant placement : Page Up/Down pour
  1 m et Shift + Page Up/Down pour 0,1 m. Vérifier le mouvement réel des objets.
- [ ] Relier directement les ports compatibles d'une machine, d'un splitter,
  d'un merger et de deux lifts alignés. Sur une plateforme, vérifier les niveaux,
  le blocage d'un récepteur et la reprise après l'avoir vidé.
- [ ] Sur deux niveaux, placer un conteneur latéral au-dessus de la case en face
  d'une sortie basse : il ne doit pas bloquer cette sortie. Un bâtiment réellement
  sur le trajet et à la même hauteur doit toujours la bloquer.
- [ ] Avec G, inspecter un convoyeur et un lift actifs, puis bloqués ; vérifier
  que les compteurs progressent uniquement lors de sorties effectives.

## 4. Trajets et chaîne complète

- [ ] Dans Q, choisir **Conveyor**, appuyer sur T, cliquer la première case libre
  après une sortie existante, ajouter des points, changer l'ordre des coudes avec
  R, annuler un point avec Backspace et confirmer avec Entrée. Vérifier l'aperçu,
  le coût et l'absence de construction partielle en cas de refus.
- [ ] Confirmer un trajet ouvert, le prolonger ensuite, puis poser le récepteur.
  Une extrémité de convoyeur ordinaire ouverte laisse tomber les objets au sol :
  arrêter la source ou la raccorder avant de l'alimenter si ce n'est pas souhaité.
  Un lift sans sortie conserve ses objets.
- [ ] Sur une plateforme, déplacer ou faire sauter le joueur dans et hors de
  l'emprise d'un trajet prévisualisé ; l'aperçu doit refléter le chevauchement.
- [ ] Relier deux mineurs (fer et charbon) au merger, puis smelter, constructeur,
  splitter et deux récepteurs dont un via lift. Vérifier production, blocage des
  deux sorties, reprise progressive et conservation. Un objet déjà engagé sur
  une branche bloquée y reste jusqu'à ce que cette branche soit libérée.

## Limites actuelles à connaître

- Lifts réglables de 1 à 8 m, par pas de 0,1 m avant placement ; pas de
  redimensionnement d'un lift déjà posé. Plusieurs lifts peuvent être chaînés.
- Trajets orthogonaux de 24 cases maximum par confirmation ; une sortie existante
  est nécessaire au départ. Une partie peut être prolongée par un nouveau trajet.
  Certaines dispositions peuvent être refusées par le placement progressif.
- Les anciennes variantes de convoyeur de deux cases ne se raccordent pas aux
  nouvelles interfaces de lift, splitter, merger et stockage ; utiliser le
  convoyeur d'une case disponible dans Q.
- Prévisualisation indicative : obstacles mobiles et objets en cours de transport
  peuvent la faire évoluer ; la confirmation vérifie à nouveau l'état réel.
- Pas de sauvegarde ni de réseau électrique dans cette phase. Les règles de
  support, portée et collision des fondations restent applicables.

Pour des scénarios détaillés, voir `PHASE_7_MANUAL_ACCEPTANCE.md` et
`PHASE_7_ROUTE_CHECK.md`. Aucun résultat joueur n'est présumé avant votre retour.
