import Link from 'next/link';

import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { deleteTemplateAction, saveTemplateAction } from '../actions';
import { TemplateCard, TemplateForm } from './template-ui';

export const metadata = { title: 'Vorlagen' };

export default async function TemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'mail.template.manage');

  const templates = await prisma.emailTemplate.findMany({
    where: { communityId: context.community.id },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader
        title="Vorlagen"
        description="Wiederkehrende Texte für Einladungen, Begrüßungen und Erinnerungen."
        breadcrumb={
          <Link href={`/c/${slug}/nachrichten`} className="hover:text-slate-700">
            Nachrichten
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {templates.length === 0 ? (
            <Card>
              <EmptyState
                title="Noch keine Vorlagen"
                description="Legen Sie rechts eine erste Vorlage an."
              />
            </Card>
          ) : (
            templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={{
                  id: template.id,
                  name: template.name,
                  description: template.description,
                  subject: template.subject,
                  bodyText: template.bodyText,
                  isSystem: template.isSystem,
                }}
                useHref={`/c/${slug}/nachrichten/neu?vorlage=${template.id}`}
                saveAction={saveTemplateAction.bind(null, slug, template.id)}
                deleteAction={deleteTemplateAction.bind(null, slug, template.id)}
              />
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="Neue Vorlage" />
          <CardBody>
            <TemplateForm
              action={saveTemplateAction.bind(null, slug, null)}
              submitLabel="Vorlage anlegen"
              idPrefix="neu"
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
