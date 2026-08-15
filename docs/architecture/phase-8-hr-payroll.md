# Phase 8 — RH + planning + présence + congés + paie

Introduit `Employee`/`WorkSchedule`/`Attendance`/`LeaveRequest`/`Payslip`, couvrant §21 (RH :
employés, contrats, présences, planning, congés) et §22 (Paie : salaire de base + primes + heures
supplémentaires − absences − avances − retenues = net à payer, alimentant automatiquement Finance).

Le §44 (liste des 29 modules cibles) nomme cette portée `hr`/`payroll` comme noms de dossiers
futurs, mais cette liste "reste une feuille de route documentée, pas une arborescence physique
prématurée". Comme chaque phase précédente, l'implémentation continue la granularité un-module-par-
entité (Phase 7 : 4 modules distincts pour room-types/rooms/guests/reservations) — Phase 8 ajoute
**5 modules distincts**, pas deux méga-modules `hr`/`payroll`.

## `Employee` — entité catalogue, pas de modèle `Contract` séparé

"Contrats" (§21) représentés en champs plats (`contractType`/`contractStartDate`/`contractEndDate`)
— le brief ne décrit ni avenant ni historique de versions ; un modèle dédié ajouterait une
complexité non demandée (même raisonnement que le modèle Dettes non créé en Phase 6). Historique/
avenants de contrat explicitement hors périmètre.

## `Employee.userId` facultatif, pas 1:1 requis avec `User`

`User` est un modèle auth/identité pur (aucun champ RH). Forcer chaque employé à posséder un compte
de connexion serait excessif — le personnel cuisine/ménage peut être suivi en RH/paie sans jamais
se connecter au système. `Employee` garde ses propres `firstName`/`lastName` indépendamment d'un
éventuel `userId` — même principe qu'`Invoice.clientName` vs `guestId` (Phase 6/7) : "complète, ne
remplace pas".

## `WorkSchedule` ("planning") — CRUD simple, sans contrôle de chevauchement

Contrairement à `Room` (ressource physique à usage exclusif — deux réservations ne peuvent pas être
vraies simultanément), deux créneaux de planning qui se chevauchent pour un même employé ne sont
pas une contradiction structurelle (roulement fractionné, chevauchement de passation) — un jugement
RH, pas une règle à appliquer en base. Pas de récurrence (créneaux répétés non détaillés au brief).

## `Attendance` ("présences") — pointage manuel, une seule ouverture à la fois

`create()` = clock-in (défaut `now()`), **rejette (409)** si un enregistrement ouvert (`clockOut`
null) existe déjà pour l'employé — évite un état structurellement incohérent. `POST
/attendances/:id/clock-out` ferme l'enregistrement. Pas de borne biométrique/kiosque. Pas
d'isolation "propre pointage uniquement" — aucune dimension d'isolation par utilisateur n'existe
ailleurs dans le code (seulement organisation/hôtel) ; en introduire une ici serait un concept
nouveau non établi.

## `LeaveRequest` ("congés") — tout via `transition()`

`PENDING → APPROVED/REJECTED/CANCELLED`, les trois transitions partent toutes d'un statut source
unique (`PENDING`) — même pattern symétrique qu'`ExpensesService.submit/approve/reject`. `type` en
texte libre (congé payé/maladie/sans solde — varie par pays/convention collective, même logique que
`Reservation.source`). `update()` autorisé tant que `PENDING`. Annulation d'un congé déjà `APPROVED`
hors périmètre cette phase (limite documentée, pas un oubli silencieux).

## `Payslip` ("paie") — `DRAFT → FINALIZED → PAID`, alimente Finance automatiquement

`baseSalary` = copie figée d'`Employee.baseSalary` à la création (jamais relue après, même principe
qu'`agreedRate`/`unitPrice`). `netPay` calculé à la demande dans la réponse (jamais stocké, même
principe que les totaux Invoice) : `baseSalary + bonuses + overtimeAmount − absenceDeduction −
advances − deductions`. `finalize()` verrouille les montants. `markPaid()` — structure identique à
`ExpensesService.markPaid()` : XOR `cashAccountId`/`bankAccountId` requis, `paymentMethod` explicite
(pas dérivé), catégorie validée type `EXPENSE` et même hôtel ; dans un seul `$transaction`, crée une
nouvelle `Expense` **directement au statut `PAID`** (pas de passage par DRAFT/PENDING/APPROVED — le
`FINALIZED` du Payslip représente déjà l'approbation RH) + la `CashTransaction`/`BankTransaction`
correspondante. Une `Expense` par `Payslip` (pas de lot de paie agrégé — traçabilité individuelle,
cohérent avec le grain utilisé partout ailleurs). Pas de lien automatique
`Attendance`/`LeaveRequest` → `absenceDeduction` (saisie manuelle, même limite documentée que la
non-réconciliation Invoice/Revenue, Phase 6).

## Pas d'injection cross-module

Contrairement à `ReservationsModule`→`RoomsModule` (réutilisation d'une vraie logique,
`hasOverlap()`), la lecture d'`Employee.baseSalary` pour le snapshot est une lecture de routine
(comme `ExpensesService.validateReferences()` lisant `FinancialCategory`/`Department` directement
via `this.prisma`, sans injection). Les 5 nouveaux modules n'importent rien entre eux.

## Permissions — format plat, HOTEL_ADMIN reçoit tout, y compris `payslips.mark-paid`

20 clés `resource.action` (non-finance, cohérent Phase 7). HOTEL_ADMIN reçoit déjà
`finance.expense.pay` (l'action qui déplace l'argent) et n'est exclu que de `finance.expense.book`
(contrôle comptable org-level). `Payslip` n'a pas d'équivalent de `book()` dans ce design (pas de
statut post-PAID) — donc rien à exclure. Test 403 de vérification réutilise `finance.expense.book`
(Phase 5, toujours valide).

## Vérification en base réelle

1. Migration (contournement Windows établi Phase 6) → `prisma generate` → `npm run build:api` →
   `npm run db:seed` → `node apps/api/dist/main.js`.
2. `POST /employees` sans `userId` → 201 ; avec `userId` répété → 409.
3. `POST /work-schedules` ×2 chevauchants → 201 les deux fois (pas de rejet).
4. `POST /attendances` puis `POST /attendances` à nouveau (même employé) → 409 ; `clock-out` puis
   nouveau `POST /attendances` → 201.
5. `POST /leave-requests` → PENDING, `days` inclusif → `approve` → APPROVED ; nouvelle demande →
   `cancel` → CANCELLED ; `cancel` sur celle approuvée → 400.
6. `POST /payslips` → DRAFT, `baseSalary` snapshotté, `netPay` calculé → `PATCH` (DRAFT) → 200 →
   `finalize` → FINALIZED → `PATCH` → 400 → `mark-paid` → PAID, `expenseId` renseigné.
7. `GET /expenses/:expenseId` → PAID, `amount == netPay`. Solde caisse diminué exactement de
   `netPay`. `GET /finance/summary` reflète la dépense.
8. Isolation hôtel, 403 via `finance.expense.book`, 401 sans token.
9. `npm run typecheck` + non-régression `apps/web`/`nimbalodge-app`.

## Périmètre exclu

Historique/versions de contrat, avenants, renouvellements (Contract reste des champs plats sur
Employee) ; contrôle de chevauchement sur WorkSchedule ; bornage biométrique/kiosque/self-service
pour Attendance (saisie manuelle uniquement) ; annulation d'un LeaveRequest déjà APPROVED (cancel
reste PENDING-only) ; lien automatique Attendance/LeaveRequest → Payslip.absenceDeduction (saisie
manuelle) ; génération de paie en masse (création individuelle uniquement, comme Invoice/Expense) ;
barèmes d'impôts/cotisations sociales spécifiques au pays au-delà du champ générique `deductions` ;
portail self-service employé ; workflow d'approbation à plusieurs niveaux pour Payslip
(DRAFT→FINALIZED collapse ce qui serait submit+approve chez Expense, volontaire) ; connexion
frontend↔backend.
