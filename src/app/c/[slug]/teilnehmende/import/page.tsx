import Link from 'next/link';

import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { requirePermission } from '@/lib/rbac';

import { ImportForm } from './import-form';

export const metadata = { title: 'Teilnehmende importieren' };

export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requirePermission(slug, 'member.create');

  return (
    <>
      <PageHeader
        title="Teilnehmende importieren"
        description="Übernehmen Sie eine bestehende Liste als CSV-Datei."
        breadcrumb={
          <Link href={`/c/${slug}/teilnehmende`} className="hover:text-slate-700">
            Teilnehmende
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Datei auswählen" />
            <CardBody>
              <ImportForm slug={slug} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="So ist die Datei aufgebaut" />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p>
              Die erste Zeile enthält die Spaltennamen. Trennzeichen kann ein Semikolon, ein Komma
              oder ein Tabulator sein.
            </p>
            <p className="font-medium text-slate-700">Erkannte Spalten</p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>E-Mail (erforderlich)</li>
              <li>Vorname, Nachname</li>
              <li>Telefon, Mobil</li>
              <li>Straße, PLZ, Ort, Land</li>
              <li>Organisation, Funktion</li>
              <li>Mitgliedsnummer, Notizen</li>
            </ul>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`Vorname;Nachname;E-Mail;Ort
Anna;Berger;anna@example.org;Leipzig
Jonas;Feld;jonas@example.org;Halle`}
            </pre>
            <p>
              Bereits bekannte Adressen werden der Community hinzugefügt, ohne vorhandene
              Stammdaten zu überschreiben.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
