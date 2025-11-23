import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import { safeTranslate } from '@/utils/i18n-helpers';

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();
  const translate = (key: string) => {
    const translation = safeTranslate(t, key);
    return translation === key ? 'Contenido no encontrado' : translation;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={translate('privacy.title')}
        subtitle={translate('privacy.subtitle')}
      />

      <div className="max-w-none mt-8">
        <div className="space-y-8 text-base leading-7 text-foreground">
          <p className="text-lg leading-relaxed text-foreground">
            {translate('privacy.intro')}
          </p>

          <div className="rounded-lg bg-card border border-border/60 p-6 shadow-sm">
            <h2 className="mt-0 text-2xl font-semibold mb-4 text-foreground">
              {translate('privacy.controller.title')}
            </h2>
            <div className="space-y-3 text-base">
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.controller.company')}
                </strong>{' '}
                <span className="text-foreground">Acceleralia SL</span>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.controller.nif')}
                </strong>{' '}
                <span className="text-foreground">B01998426</span>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.controller.address')}
                </strong>{' '}
                <span className="text-foreground">C. CAN BRUIXA, 16, 1, 08028 Barcelona, España</span>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.controller.email')}
                </strong>{' '}
                <a
                  href="mailto:support+create@acceleralia.com"
                  className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  support+create@acceleralia.com
                </a>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.purposes.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.purposes.intro')}
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.purpose1')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.purpose1Content')}
                  </span>
                </p>
                <p className="mt-2 text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.legalBasis1')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.legalBasis1Content')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.purpose2')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.purpose2Content')}
                  </span>
                </p>
                <p className="mt-2 text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.legalBasis2')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.legalBasis2Content')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.purpose3')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.purpose3Content')}
                  </span>
                </p>
                <p className="mt-2 text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.legalBasis3')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.legalBasis3Content')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.purpose4')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.purpose4Content')}
                  </span>
                </p>
                <p className="mt-2 text-base leading-relaxed text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.purposes.legalBasis4')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.purposes.legalBasis4Content')}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.categories.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.categories.intro')}
            </p>
            <ul className="ml-6 list-disc space-y-3 text-base leading-relaxed text-foreground">
              <li className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.categories.identifying')}
                </strong>{' '}
                  <span className="text-foreground">
                  {translate('privacy.categories.identifyingContent')}
                </span>
              </li>
              <li className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.categories.credentials')}
                </strong>{' '}
                  <span className="text-foreground">
                  {translate('privacy.categories.credentialsContent')}
                </span>
              </li>
              <li className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.categories.connection')}
                </strong>{' '}
                  <span className="text-foreground">
                  {translate('privacy.categories.connectionContent')}
                </span>
              </li>
            </ul>
            <div className="mt-4 rounded-lg border-l-4 border-primary bg-primary/10 p-4">
              <p className="text-base leading-relaxed text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.categories.note')}
                </strong>{' '}
                  <span className="text-foreground">
                  {translate('privacy.categories.noteContent')}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.recipients.title')}
            </h2>
            <ul className="ml-6 list-disc space-y-3 text-base leading-relaxed text-foreground">
              <li className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.recipients.processors')}
                </strong>{' '}
                  <span className="text-foreground">
                  {translate('privacy.recipients.processorsContent')}
                </span>
              </li>
              <li className="text-foreground">
                <strong className="text-foreground">
                  {translate('privacy.recipients.legal')}
                </strong>{' '}
                  <span className="text-foreground">
                  {translate('privacy.recipients.legalContent')}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              <strong className="text-foreground">
                {translate('privacy.recipients.transfers')}
              </strong>{' '}
                  <span className="text-foreground">
                {translate('privacy.recipients.transfersContent')}
              </span>
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.retention.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.retention.content')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.rights.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.rights.intro')}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.rights.access')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.rights.accessContent')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.rights.rectification')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.rights.rectificationContent')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.rights.deletion')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.rights.deletionContent')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.rights.opposition')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.rights.oppositionContent')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.rights.limitation')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.rights.limitationContent')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">
                    {translate('privacy.rights.portability')}
                  </strong>{' '}
                  <span className="text-foreground">
                    {translate('privacy.rights.portabilityContent')}
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-6 text-base leading-relaxed text-foreground">
              {translate('privacy.rights.exercise')}{' '}
              <a
                href="mailto:seguridad@acceleralia.com"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                support+create@acceleralia.com
              </a>
              {', '}
              {translate('privacy.rights.exerciseContent')}
            </p>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              {translate('privacy.rights.withdrawal')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.authority.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.authority.content')}
              <a
                href="https://www.aepd.es"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                www.aepd.es
              </a>
              {') '}
              {translate('privacy.authority.content2')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.security.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.security.content')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.updates.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.updates.content')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('privacy.contact.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('privacy.contact.content')}
            </p>
            <p className="text-base text-foreground">
              <strong className="text-foreground">
                {translate('privacy.contact.email')}
              </strong>{' '}
              <a
                href="mailto:support+create@acceleralia.com"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                support+create@acceleralia.com
              </a>
            </p>
          </div>

          <hr className="my-8 border-gray-300 dark:border-gray-700" />

          <p className="text-sm italic text-muted-foreground">
            {translate('privacy.lastUpdate')}{' '}
            {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
