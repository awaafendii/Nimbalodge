-- Étape 7 (Durcissement RBAC) — aplatit les clés de permission du domaine Finance, seul domaine du
-- catalogue à utiliser un format imbriqué `finance.<ressource>.<action>` au lieu du format plat
-- `resource.action` utilisé par les 103 autres clés. Réécrit `Permission.key` en place : `RolePermission`
-- référence `permissionId` (pas `key`), donc aucune attribution existante n'est perdue ou déplacée.

UPDATE "Permission" SET "key" = 'finance-categories.view' WHERE "key" = 'finance.category.view';
UPDATE "Permission" SET "key" = 'finance-categories.create' WHERE "key" = 'finance.category.create';
UPDATE "Permission" SET "key" = 'finance-categories.update' WHERE "key" = 'finance.category.update';

UPDATE "Permission" SET "key" = 'finance-cash-accounts.view' WHERE "key" = 'finance.cash-account.view';
UPDATE "Permission" SET "key" = 'finance-cash-accounts.create' WHERE "key" = 'finance.cash-account.create';
UPDATE "Permission" SET "key" = 'finance-cash-accounts.update' WHERE "key" = 'finance.cash-account.update';

UPDATE "Permission" SET "key" = 'finance-bank-accounts.view' WHERE "key" = 'finance.bank-account.view';
UPDATE "Permission" SET "key" = 'finance-bank-accounts.create' WHERE "key" = 'finance.bank-account.create';
UPDATE "Permission" SET "key" = 'finance-bank-accounts.update' WHERE "key" = 'finance.bank-account.update';

UPDATE "Permission" SET "key" = 'finance-revenues.view' WHERE "key" = 'finance.revenue.view';
UPDATE "Permission" SET "key" = 'finance-revenues.create' WHERE "key" = 'finance.revenue.create';

UPDATE "Permission" SET "key" = 'finance-expenses.view' WHERE "key" = 'finance.expense.view';
UPDATE "Permission" SET "key" = 'finance-expenses.create' WHERE "key" = 'finance.expense.create';
UPDATE "Permission" SET "key" = 'finance-expenses.update' WHERE "key" = 'finance.expense.update';
UPDATE "Permission" SET "key" = 'finance-expenses.submit' WHERE "key" = 'finance.expense.submit';
UPDATE "Permission" SET "key" = 'finance-expenses.approve' WHERE "key" = 'finance.expense.approve';
UPDATE "Permission" SET "key" = 'finance-expenses.pay' WHERE "key" = 'finance.expense.pay';
UPDATE "Permission" SET "key" = 'finance-expenses.book' WHERE "key" = 'finance.expense.book';

UPDATE "Permission" SET "key" = 'finance-budgets.view' WHERE "key" = 'finance.budget.view';
UPDATE "Permission" SET "key" = 'finance-budgets.create' WHERE "key" = 'finance.budget.create';
UPDATE "Permission" SET "key" = 'finance-budgets.update' WHERE "key" = 'finance.budget.update';
UPDATE "Permission" SET "key" = 'finance-budgets.check-overspend' WHERE "key" = 'finance.budget.check-overspend';

UPDATE "Permission" SET "key" = 'finance-summary.view' WHERE "key" = 'finance.summary.view';

UPDATE "Permission" SET "key" = 'finance-invoices.view' WHERE "key" = 'finance.invoice.view';
UPDATE "Permission" SET "key" = 'finance-invoices.create' WHERE "key" = 'finance.invoice.create';
UPDATE "Permission" SET "key" = 'finance-invoices.update' WHERE "key" = 'finance.invoice.update';
UPDATE "Permission" SET "key" = 'finance-invoices.issue' WHERE "key" = 'finance.invoice.issue';
UPDATE "Permission" SET "key" = 'finance-invoices.cancel' WHERE "key" = 'finance.invoice.cancel';

UPDATE "Permission" SET "key" = 'finance-payments.view' WHERE "key" = 'finance.payment.view';
UPDATE "Permission" SET "key" = 'finance-payments.create' WHERE "key" = 'finance.payment.create';

UPDATE "Permission" SET "key" = 'finance-credit-notes.view' WHERE "key" = 'finance.credit-note.view';
UPDATE "Permission" SET "key" = 'finance-credit-notes.create' WHERE "key" = 'finance.credit-note.create';
