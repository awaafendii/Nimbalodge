-- Étape 7 — distingue POURQUOI un RefreshToken a été révoqué ("rotated" = rotation normale, seul
-- cas déclenchant la détection de réutilisation ; "logout"/"user-revoked"/"user-revoked-all"/
-- "password-reset" = action volontaire, jamais un signal de vol). Découvert en testant en direct
-- la gestion des sessions : sans cette distinction, une révocation volontaire (self-service
-- "sign out this device") déclenchait à tort la cascade de révocation "vol détecté" sur toutes les
-- autres sessions actives de l'utilisateur.

ALTER TABLE "RefreshToken"
  ADD COLUMN "revokedReason" TEXT;
