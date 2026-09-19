# Komon

Komon ist eine Anwendung für die Verwaltung mehrerer Communities: Vereine,
Initiativen, Netzwerke und Arbeitskreise. Alle Gemeinschaften liegen in einer
Installation nebeneinander, teilen sich die Stammdaten der Personen und bleiben
in ihren Inhalten und Rechten getrennt.

## Was die Anwendung kann

| Bereich | Umfang |
| --- | --- |
| **Teilnehmer-Management** | Stammdaten je Person, community-eigene Zusatzfelder, Schlagworte, Gruppen, Suche und Filter, CSV-Import und -Export |
| **Kommunikation über E-Mail** | Rundschreiben mit Empfängerauswahl, Platzhaltern und Vorlagen, geplanter Versand, Warteschlange mit Wiederholung, Zustellprotokoll |
| **Gruppenmailadressen** | Listen im Stil von Mailman: Einlieferungs- und Moderationsregeln, Betreffpräfix, Fußzeile, Listenkopfzeilen, Archiv mit Gesprächsverlauf, Abgleich mit Gruppen |
| **Dateiablage** | Ordnerbaum, Versionsverlauf, Zugriffsrechte je Ordner und Rolle, sichere Auslieferung |
| **Eventmanagement** | Planung mit Programm und Aufgaben, Einladungen mit persönlichem Rückmeldelink, Warteliste, Anwesenheitserfassung, Nachbereitung mit Protokoll und Nachlese |
| **Terminmanagement** | Monatskalender aus Events, freien Terminen und geplanten Beiträgen, Wiederholungen, Ausgabe als iCalendar |
| **Content-Journal** | Beiträge, Protokolle und Beschlüsse mit Status, Redaktionsplan und Abstimmung über Kommentare |
| **Benutzer und Rechte** | Rollen mit feiner Rechteauswahl, Einladung neuer Zugänge, Passwortverwaltung, Sitzungsübersicht, Protokoll aller Vorgänge |

## Schnellstart

```bash
npm install
cp .env.example .env
npm run db:migrate      # legt die Datenbank an
npm run db:seed         # füllt Beispieldaten
npm run dev
```

Die Anwendung läuft danach auf <http://localhost:3000>.

### Zugänge aus den Beispieldaten

Alle mit dem Passwort `komon-demo-2026`:

| Adresse | Rolle |
| --- | --- |
| `mira.lindqvist@example.org` | Leitung, zusätzlich Plattformverwaltung |
| `jonas.feld@example.org` | Verwaltung |
| `anna.berger@example.org` | Redaktion |
| `tarek.osman@example.org` | Eventteam, Leitung der zweiten Community |

Die Beispieldaten legen zwei Communities an: den Kulturverein Nordklang mit
Vorstand, Arbeitskreisen und zwei Mailinglisten sowie die offene
Nachbarschaft Ostvorstadt.

## Aufbau

```
prisma/schema.prisma      Datenmodell
prisma/seed.ts            Beispieldaten
scripts/mail-worker.ts    Dauerhafter Versand-Worker
src/app/                  Seiten und Server Actions (Next.js App Router)
src/components/           Wiederverwendbare Bausteine der Oberfläche
src/lib/                  Fachlogik: Rechte, E-Mail, Listen, Dateien, Kalender
tests/                    Tests für Fachlogik und Integration
```

### Technik

Next.js 15 mit dem App Router und React 19, TypeScript, Tailwind CSS, Prisma
mit SQLite, Zod für die Prüfung von Eingaben, Nodemailer für den Versand und
Vitest für die Tests. Geschrieben wird ausschließlich über Server Actions, die
Rechte prüft jede Aktion selbst.

## Rechte und Rollen

Eine Person wird über eine **Mitgliedschaft** mit einer Community verbunden.
Die Mitgliedschaft trägt beliebig viele **Rollen**, jede Rolle bündelt
**Berechtigungen**. Die Rechte einer Person ergeben sich aus der Summe ihrer
Rollen.

Jede neue Community erhält sieben Systemrollen: Leitung, Verwaltung,
Moderation, Eventteam, Redaktion, Mitglied und Gast. Eigene Rollen lassen sich
jederzeit ergänzen. Zwei Regeln schützen vor Aussperrung:

- Die Rolle Leitung behält stets alle Rechte.
- Niemand kann Rechte vergeben, die er selbst nicht besitzt.

Die vollständige Liste steht in `src/lib/permissions.ts`.

## Gruppenmailadressen

Jede Community bekommt in den Einstellungen eine eigene Domain, zum Beispiel
`listen.example.org`. Eine Liste mit dem Lokalteil `vorstand` ist dann unter
`vorstand@listen.example.org` erreichbar.

### Eingehende Nachrichten annehmen

Der Mailserver oder ein Zustelldienst liefert eingehende Nachrichten an den
Posteingang der Anwendung:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "X-Komon-Secret: $INBOUND_SECRET" \
  -d '{
    "to": "vorstand@listen.example.org",
    "from": "Anna Berger <anna@example.org>",
    "subject": "Termin für die Sitzung",
    "text": "Passt euch der erste Montag?",
    "messageId": "<abc123@example.org>"
  }'
```

Die Nachricht durchläuft danach drei Stufen:

1. **Zuordnung** der Empfängeradresse zu einer Liste
2. **Prüfung der Absenderin**, auch über hinterlegte Zweitadressen
3. **Verteilung oder Vorlage bei der Moderation**, je nach Regel der Liste

Verteilte Nachrichten erhalten Betreffpräfix, Fußzeile und die Kopfzeilen
`List-Id`, `List-Post`, `List-Archive`, `List-Unsubscribe` und `Precedence`.
Die absendende Person bekommt keine Kopie zurück. Antworten landen über
`In-Reply-To` und `References` im selben Gesprächsverlauf des Archivs.

### Einlieferungsregeln

| Regel | Wirkung |
| --- | --- |
| `OPEN` | Alle dürfen schreiben |
| `SUBSCRIBERS` | Nur eingetragene Adressen |
| `MEMBERS` | Alle Mitglieder der Community |
| `MODERATORS` | Nur Moderation und Leitung |

Dazu tritt die Moderationsregel `NONE`, `NON_SUBSCRIBERS` oder `ALL`. Einzelne
Adressen lassen sich zusätzlich auf Einzelfreigabe setzen.

## E-Mail-Versand

Im Auslieferungszustand steht `MAIL_TRANSPORT=log`. Nachrichten werden dann
nicht versendet, sondern als Datei unter `storage/outbox` abgelegt. Das eignet
sich für die Entwicklung und für einen ersten Rundgang.

Für den Betrieb setzen Sie `MAIL_TRANSPORT=smtp` und die Zugangsdaten Ihres
Mailservers. Der Versand läuft über eine Warteschlange, die auf drei Wegen
abgearbeitet wird:

1. **Aus der Oberfläche**, direkt nach dem Absenden
2. **Über den Worker** mit `npm run mail:worker`, empfehlenswert bei großen Verteilern
3. **Über einen Cron-Aufruf** an `POST /api/mail/queue` mit dem Kopf `X-Komon-Secret`

Fehlgeschlagene Zustellungen werden bis zu `MAIL_MAX_ATTEMPTS` mal wiederholt
und lassen sich in der Nachrichtenansicht erneut anstoßen.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Anwendung für den Betrieb bauen |
| `npm run start` | Gebaute Anwendung starten |
| `npm run typecheck` | Typen prüfen |
| `npm test` | Tests ausführen |
| `npm run db:migrate` | Änderungen am Datenmodell einspielen |
| `npm run db:seed` | Beispieldaten laden |
| `npm run db:reset` | Datenbank zurücksetzen und neu füllen |
| `npm run mail:worker` | Versand-Worker starten |

Dieselben drei Tore prüft GitHub Actions bei jedem Push und jeder Pull
Request: `npm run typecheck`, `npm test` und `npm run build`. Der Workflow
liegt in `.github/workflows/ci.yml`.

## Betrieb

### Auf PostgreSQL wechseln

SQLite genügt für kleine und mittlere Installationen. Für größere Gemeinschaften
oder mehrere Anwendungsprozesse empfiehlt sich PostgreSQL:

1. In `prisma/schema.prisma` den `provider` auf `postgresql` setzen
2. `DATABASE_URL` auf die Verbindungszeichenfolge ändern
3. `npm run db:migrate` ausführen

Das Datenmodell kommt ohne datenbankspezifische Eigenheiten aus. Aufzählbare
Werte liegen bewusst als Text vor und werden in `src/lib/enums.ts` gepflegt,
damit beide Datenbanken dasselbe Schema tragen.

### Sicherheit

- Sitzungen laufen über ein Cookie mit `httpOnly` und `sameSite=lax`,
  in der gebauten Anwendung zusätzlich mit `secure`.
- Passwörter werden mit bcrypt gespeichert. Nach acht Fehlversuchen wird das
  Konto für fünfzehn Minuten gesperrt.
- Der Posteingang und die Warteschlange prüfen `INBOUND_SECRET` in konstanter
  Zeit. **Bitte für den Betrieb durch einen langen Zufallswert ersetzen.**
- Dateien werden nie unter einem vom Browser wählbaren Pfad ausgeliefert.
  HTML und SVG gehen immer als Download heraus, nicht zur Anzeige.
- Jede Server Action prüft die Rechte selbst. Ein fehlendes Recht führt zu
  einem Abbruch, nicht zu einer stillen Teilausführung.

### Datenschutz

Die Anwendung hält das Einverständnis für Rundschreiben je Mitgliedschaft fest
und beachtet es bei jedem Versand. Personen mit abgestellter Zustellung bleiben
außen vor. Am Stammdatensatz lassen sich Einverständnis und Aufbewahrungsfrist
hinterlegen. Das Protokoll hält fest, wer welche Daten wann geändert hat.

## Tests

```bash
npm test
```

Die Tests decken die Fachlogik ab: Regeln der Mailinglisten, Aufbereitung von
E-Mails, Berechtigungen, CSV, iCalendar, Dateinamen und Kalenderraster. Zwei
Integrationstests arbeiten gegen eine eigene SQLite-Datei und prüfen den Weg
einer eingehenden Listennachricht sowie die Warteschlange des Versands.
