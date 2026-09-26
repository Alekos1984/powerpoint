# Actualisation en rTMS — décorticage de la présentation source

Source : [`docs/Actualisation en rTMS.pptx`](../Actualisation%20en%20rTMS.pptx) (branche `webapp`), 47 diapositives,
canevas 16:9 (1280×720 px / 12192000×6858000 EMU). C'est le compte-rendu personnel d'un congrès espagnol
(*III Jornadas — Actualizaciones en Neuromodulación*, 25-26 septembre 2025, Séville — voir `image1.png`),
pris diapo après diapo pendant les sessions.

**But de ce dossier** : extraire fidèlement le texte et les visuels de chaque diapositive, avec assez
d'indications de mise en page pour **recréer la présentation directement en HTML + images**
(un Claude Artifact / site web au format présentation), sans repasser par la plateforme Netlify construite plus tôt.

**Le texte oral / la narration ne sont pas traités ici** — c'est explicitement reporté à une phase ultérieure.
Aucune note orateur n'existe dans le fichier source : les diapositives 41 à 47 ont un espace réservé aux
notes (3 formes chacune, comme d'habitude dans PowerPoint) mais **le texte de ces notes est vide** — confirmé
directement avec `python-pptx` (`slide.notes_slide.notes_text_frame.text == ""`).

## Méthode

1. Conversion avec l'outil du dépôt [`pptx_to_svg.py`](../../skills/ppt-master/scripts/pptx_to_svg.py)
   (`--inheritance-mode flat`, sans `--roundtrip`) pour obtenir un SVG à plat par diapositive avec les
   transformations de groupes déjà résolues en coordonnées absolues, et un dossier `images/` dédupliqué.
2. Sur 47 diapositives, seuls **38 fichiers image uniques** existent (forte réutilisation des bandeaux de session).
3. Un script Python parcourt chaque SVG plat (`data-pptx-frame`, `data-pptx-object`) pour extraire texte et images
   avec leur position en % du canevas, puis **filtre les éléments positionnés hors du cadre visible (0-100%)** :
   ce sont des restes de « diapositives construites par copie » (l'auteur duplique une diapo et pousse les anciens
   éléments hors champ plutôt que de les supprimer) — la moitié environ des formes du fichier source ne sont
   jamais réellement visibles.

## Structure de la présentation

47 diapositives = 1 page de titre + **12 sections**, chaque section étant reconnaissable à un même
bandeau récurrent (photos des intervenants + titres de communication) qui reste affiché en haut du cadre pendant
que le contenu de synthèse est ajouté diapo après diapo en dessous (diapositives « construites » progressivement,
pas 47 mises en page indépendantes). Voir [`slides.md`](./slides.md) pour le détail diapo par diapo.

| Diapositives | Bandeau de session |
|---|---|
| 1–1 | *(aucun — hors séquence / transition)* |
| 2–6 | `image4.png`
| 7–7 | `image5.png`
| 8–8 | `image6.png`
| 9–9 | `image7.png`
| 10–18 | *(aucun — hors séquence / transition)* |
| 19–19 | `image7.png`
| 20–29 | `image18.png`
| 30–30 | `image24.png`
| 31–37 | `image26.png`
| 38–44 | `image30.png`
| 45–47 | `image35.png`

## Catalogue des images (38 fichiers uniques)

Convention : dossier [`images/`](./images/) + ce tableau, sur le même principe que
[`skills/ppt-master/templates/icons/README.md`](../../skills/ppt-master/templates/icons/README.md)
(pas de fichier de tags séparé — la recherche se fait par nom de fichier et par ce tableau).

`rôle` : `title-bg` fond de couverture · `logo` · `banner` bandeau de session récurrent ·
`figure` schéma/diagramme scientifique natif · `photo` photo de l'écran de la salle (rephotographiée,
qualité variable) · `chart` graphique de résultats d'étude · `ad` publicité produit (hors-sujet) ·
`meme` clin d'œil humoristique de fin.

| Fichier | Rôle | Diapo(s) où visible | Description |
|---|---|---|---|
| [`image1.png`](./images/image1.png) | title-bg | 1 | Fond plein cadre de la diapo de titre : « III Jornadas — Actualizaciones en Neuromodulación », 25-26 septembre 2025, Global Omnium Auditorio, Séville. C'est la couverture de l'évènement source (un congrès espagnol) dont cette présentation est le compte-rendu personnel. |
| [`image2.png`](./images/image2.png) | logo | 1 | Logo « NeuroStim » (sponsor de l'évènement). |
| [`image3.png`](./images/image3.png) | logo | 1 | Logo SEPC — Sociedad Española de Psiquiatría Clínica (partenaire de l'évènement). |
| [`image4.png`](./images/image4.png) | banner | 2, 3, 4, 5, 6 | Bandeau de session « NEUROMODULACIÓN (I) » : 4 intervenants (tDCS/schizophrénie, protocoles accélérés EMT, EMT/addiction cocaïne, projet CORE-TRD) + modérateur, photos rondes reliées à leur titre de communication. |
| [`image5.png`](./images/image5.png) | banner | 7 | Bandeau « PREGUNTA AL EXPERTO 16:50-17:50 — Terapia Electroconvulsiva (TEC) », intervenant Mikel Urretavizcaya, modérateur Francisco Gotor Luengo. |
| [`image6.png`](./images/image6.png) | banner | 8 | Bandeau « Uso de la psiquiatría intervencionista en depresión resistente », intervenants Cristóbal Pavón & Jesús García, modératrice Beatriz Losilla. |
| [`image7.png`](./images/image7.png) | banner | 9, 19 | Bandeau « TALLER 19:40-21:00 — EMT en patología resistente », intervenants Alejandro Fuertes & Manuel García-Ferriol, modérateur Álvaro Moleón. |
| [`image8.jpeg`](./images/image8.jpeg) | photo | 10 | Photo d'écran — planche-mère « Abnormal brain networks in depression » : les 8 circuits numérotés (Rumination, Anxious avoidance, Negative bias, Threat dysregulation, Anhedonia, Context insensitivity, Inattention, Cognitive dyscontrol) avec légende Hyper/Typical/Hypo-connectivité. Sert de référence ; les images 9, 10, 12-15 sont des recadrages isolant chaque circuit un par un (reveal progressif diapo après diapo). |
| [`image9.png`](./images/image9.png) | figure | 11 | Recadrage isolé du circuit 1 « Rumination » (aMPFC / PCC / AG) — extrait de la planche-mère image8. |
| [`image10.png`](./images/image10.png) | figure | 12 | Recadrage isolé du circuit 2 « Anxious avoidance » (dACC / aI / TP / SLEA / Precuneus). |
| [`image11.png`](./images/image11.png) | photo | 11 | Photo d'écran — schéma cérébral coloré « La hipoactividad del CFP se asocia con hiperactividad de la red neuronal por defecto (DMN)… » (IPC, PCC, mPFC, ACC, MTL). |
| [`image12.png`](./images/image12.png) | figure | 13 | Recadrage isolé du circuit 3 « Negative bias » (dACC / Insula / Amygdala / PCC). |
| [`image13.png`](./images/image13.png) | figure | 14 | Recadrage isolé du circuit 4 « Threat dysregulation » (ACC-MPFC / Insula / Amygdala). |
| [`image14.png`](./images/image14.png) | figure | 15 | Recadrage isolé des circuits 5 « Anhedonia » et 6 « Context insensitivity » côte à côte (dACC-vMPFC / OFC / Striatum). |
| [`image15.png`](./images/image15.png) | figure | 16 | Recadrage isolé des circuits 7 « Inattention » et 8 « Cognitive dyscontrol » côte à côte. |
| [`image16.jpeg`](./images/image16.jpeg) | photo | 18 | Photo d'écran — planche de synthèse des 6 circuits (Default mode, Salience, Negative affect, Positive affect, Attention, Cognitive control) avec le traitement associé à chacun (ex. TMS pour Default mode et Cognitive control). |
| [`image17.png`](./images/image17.png) | photo | 17 | Photo d'écran — « Abnormal brain networks in depression », schéma cérébral coloré (DLPFC, parietal, insula, mPFC, PCC…) avec 4 points listés (hyperconnectivité amygdalienne/saillance, hypoconnectivité récompense, hypoconnectivité fronto-pariétale, hyperconnectivité DMN). |
| [`image18.png`](./images/image18.png) | banner | 20, 21, 22, 23, 24, 25, 26, 27, 28, 29 | Bandeau « NEUROMODULACIÓN (II) — TRABAJOS DE INVESTIGACIÓN NACIONALES » : 4 communications (estimulación cerebral de précision/EMT multifocal, neuromodulación domiciliaria, neuromodulación y psicodélicos, intégration…). |
| [`image19.png`](./images/image19.png) | figure | 22 | En-tête d'article scientifique (Clinical Neurophysiology / Elsevier) — « Modulating brain networks in space and time: Multi-locus transcranial magnetic stimulation », Sinisalo et al. |
| [`image20.png`](./images/image20.png) | figure | 23 | Schéma A/B/C comparant TMS conventionnelle vs multi-locus : ciblage multi-site, engagement du réseau, réhabilitation de la connectivité. |
| [`image21.png`](./images/image21.png) | figure | 23 | Schéma technique de la bobine multi-locus (coil array) et somme des champs électriques par polarité. |
| [`image22.png`](./images/image22.png) | figure | 24 | Rendu 3D — casque de stimulation mTMS bi-site compatible IRM (« Dual-site mTMS compatible con MRI »). |
| [`image23.png`](./images/image23.png) | figure | 26 | Roue de classification des substances psychoactives (Cannabinoids, Stimulants, Empathogens, Psychedelics, Dissociatives, Depressants, Opioids) — figure de contexte général, en marge du sujet rTMS. |
| [`image24.png`](./images/image24.png) | banner | 30 | Bandeau « NEUROIMAGEN Y NEUROMODULACIÓN », intervenante Marisa Anguita (radiologue), modérateur Sergio González. |
| [`image25.png`](./images/image25.png) | photo | 29 | Photo d'une pièce de repos (fauteuils, lit, plantes, éclairage tamisé) — illustration d'un environnement de séance/sommeil. |
| [`image26.png`](./images/image26.png) | banner | 31, 32, 33, 34, 35, 36, 37 | Bandeau « SUEÑO Y EMT », intervenant Julio Prieto (neurophysiologiste), modérateur Cristóbal Pavón. |
| [`image27.png`](./images/image27.png) | photo | 34 | Photo d'écran — protocole « rTMS como inductora de metaplasticidad » : 2 protocoles HF sur M1 séparés de 12h (avec/sans sommeil), tableau Sesión 1/2 Over-day/Over-night, paramètres 20Hz / 90% UMR / trains 2s / 240 stimuli. |
| [`image28.png`](./images/image28.png) | photo | 35 | Photo d'écran — tableau comparatif « Privación de sueño 48h » vs « cTBS tras privación » (effets sur le système glymphatique, l'anxiété, la polarisation d'AQP4). |
| [`image29.png`](./images/image29.png) | photo | 36 | Photo d'écran — 3 encarts : diminution de la latence du sommeil / augmentation du sommeil à ondes lentes / augmentation de la synchronisation thalamo-corticale. |
| [`image30.png`](./images/image30.png) | banner | 38, 39, 40, 41, 42, 43, 44 | Bandeau « EMT: combinación terapéutica y abordaje de casos ultra-resistentes », intervenant Álvaro Moleón, modérateur Cristóbal Pavón. |
| [`image31.png`](./images/image31.png) | chart | 39 | Graphique d'essai clinique — score HDRS-24 dans le temps (Baseline / Semaine 2 / Semaine 4), 4 bras actif/sham tDCS x rTMS. |
| [`image32.png`](./images/image32.png) | chart | 41 | Graphique d'essai clinique — score de dépression HDRS-17 dans le temps (Baseline à Semaine 12, N=27-32), courbes individuelles + bande d'erreur standard. |
| [`image33.png`](./images/image33.png) | ad | 42 | Publicité produit — complément alimentaire « BIOPHENIX Énergie » (ATP + CoQ10 + D-Sérine). |
| [`image34.png`](./images/image34.png) | photo | 43 | Photo d'écran — graphique en barres pré/post-intervention (PHQ-9, HDRS, HDRS-3, HAS). |
| [`image35.png`](./images/image35.png) | banner | 45, 46, 47 | Bandeau « INTELIGENCIA ARTIFICIAL EN SALUD CEREBRAL », intervenant Federico Juárez Granados, modérateur Miguel Pérez. |
| [`image36.png`](./images/image36.png) | photo | 45 | Photo d'écran — « Open AI Imagina nuestro Futuro de IA » : 5 niveaux de développement de l'IA (chatbots → raisonneurs → agents → innovateurs → organisations). |
| [`image37.png`](./images/image37.png) | photo | 46 | Photo d'écran — extrait Google Research / Nature sur AMIE (IA de raisonnement diagnostique médical), avec graphique de précision (Top-n) : AMIE seul / clinicien assisté par AMIE / clinicien assisté par recherche / clinicien seul. |
| [`image38.png`](./images/image38.png) | meme | 47 | Photo d'écran — planche « 2024 brain rot » (Oxford Word of the Year), historique et fréquence d'usage du terme — clin d'œil humoristique de fin. |

## Indications de recréation (HTML + images)

- **Canevas de référence** : 1280×720 (16:9). Toutes les positions ci-dessous et dans `slides.md` sont exprimées
  en `top/left/width/height` en % de ce canevas — directement utilisables comme un conteneur
  `position: relative; aspect-ratio: 16/9` avec des enfants en `position: absolute; top/left/width/height: X%`.
- **Bandeaux de session** (`banner`) : à traiter comme un habillage de section fixe (même image, même position)
  plutôt qu'à ré-décrire à chaque diapositive — voir le tableau de sections ci-dessus.
- **Figures scientifiques recadrées** (`image9`, `image10`, `image12` à `image15`) : ce sont des recadrages
  successifs d'une même planche mère (`image8`). Pour une recréation HTML plus propre que le PPTX source, il est
  possible de reconstruire la planche complète une fois et de n'en révéler/surligner qu'une partie par diapo
  (ex. via un cache CSS ou un `<use>` SVG), plutôt que de dupliquer 6 fichiers PNG quasi identiques — à décider
  selon le style visuel choisi pour l'Artifact final.
- **Photos d'écran** (`photo`) : qualité et cadrage variables (perspective, reflets) — à considérer comme des
  pièces justificatives à retranscrire en texte/graphique propre plutôt qu'à réutiliser telles quelles dans un
  design soigné, sauf volonté explicite de garder l'aspect « notes de terrain ».
- Le texte de chaque diapositive dans `slides.md` est **verbatim**, dans l'ordre de lecture haut→bas ; à reformuler
  ou raccourcir seulement si demandé.

## Prochaine étape (hors périmètre de ce dossier)

Génération du texte oral / de la narration par diapositive — volontairement non traité ici, à faire dans un
second temps une fois la recréation visuelle validée.
