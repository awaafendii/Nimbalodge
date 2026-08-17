import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../lib/utils.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // < md : feuille ancrée en bas (même primitive Radix Dialog que Sheet, voir sheet.tsx pour
        // le même pattern de slide), défilable, coins arrondis en haut seulement — le clavier
        // virtuel mobile réduit la hauteur visible, donc max-h-[85dvh] + overflow-y-auto plutôt
        // qu'une hauteur fixe. Seuil md (768px), pas sm (640px) : doit coïncider avec celui de
        // DataTable (repli en cartes sous md) pour qu'un même écran ne mélange jamais liste-cartes
        // + modale centrée, ou liste-tableau + feuille du bas. ≥ md : redevient la modale centrée
        // classique inchangée. Le max-w-* fourni par chaque appelant (jamais responsive lui-même,
        // toujours une valeur nue comme max-w-lg/max-w-2xl) continue de s'appliquer tel quel à
        // toutes les tailles — sur mobile il ne contraint rien puisque w-full est déjà plus étroit
        // que n'importe quel viewport de téléphone.
        "fixed inset-x-0 bottom-0 z-50 grid w-full max-h-[85dvh] gap-4 overflow-y-auto rounded-t-xl border border-border bg-card p-6 text-card-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[85vh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="size-4" />
        <span className="sr-only">Fermer</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // < md : reste atteignable pendant le défilement d'un long formulaire (sticky), fond plein
        // + bordure pour se détacher visuellement du contenu qui défile derrière, padding bas
        // conscient de la zone sûre (encoche/barre de gestes iOS). ≥ md : redevient la ligne
        // d'actions en flux normal, inchangée. sm:flex-row (pré-existant) fait passer les boutons
        // en ligne dès 640px, indépendamment du seuil md ci-dessus — une zone 640-768px avec des
        // boutons en ligne dans une barre encore sticky reste un état cohérent, pas un bug.
        "sticky bottom-0 -mx-6 flex flex-col-reverse gap-2 border-t border-border bg-card px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:justify-end md:static md:mx-0 md:border-t-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0",
        className
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-title text-lg font-[var(--fw-title)] leading-none", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
