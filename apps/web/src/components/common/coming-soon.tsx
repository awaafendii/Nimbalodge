import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nimbalodge/ui";

export function ComingSoon({ module, phase }: { module: string; phase: number }) {
  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{module}</CardTitle>
          <Badge variant="secondary">Phase {phase}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Ce module n'est pas encore reconnecté. Il fait partie de la roadmap de migration
          progressive et sera implémenté à la Phase {phase}, une fois le backend et les entités
          organisationnelles (organisation, hôtel, département, activité, centre de coût) en place.
        </p>
      </CardContent>
    </Card>
  );
}
