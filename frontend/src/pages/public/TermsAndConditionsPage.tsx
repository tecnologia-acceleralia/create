import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';

export default function TermsAndConditionsPage() {
  const { t } = useTranslation();
  const translate = (key: string) => {
    const translation = t(key);
    return translation === key ? 'Contenido no encontrado' : translation;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={translate('terms.title')}
        subtitle={translate('terms.subtitle')}
      />

      <div className="max-w-none mt-8">
        <div className="space-y-8 text-base leading-7 text-foreground">
          <p className="text-lg leading-relaxed text-foreground">
            {translate('terms.intro')}
          </p>

          <div className="rounded-lg bg-card border border-border/60 p-6 shadow-sm">
            <h2 className="mt-0 text-2xl font-semibold mb-4 text-foreground">
              {translate('terms.provider.title')}
            </h2>
            <div className="space-y-3 text-base">
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('terms.provider.company')}
                </strong>{' '}
                <span className="text-foreground">Acceleralia SL</span>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('terms.provider.nif')}
                </strong>{' '}
                <span className="text-foreground">B01998426</span>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('terms.provider.address')}
                </strong>{' '}
                <span className="text-foreground">C. CAN BRUIXA, 16, 1, 08028 Barcelona, España</span>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('terms.provider.email')}
                </strong>{' '}
                <a
                  href="mailto:info@acceleralia.com"
                  className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  info@acceleralia.com
                </a>
              </p>
              <p className="text-foreground">
                <strong className="text-foreground">
                  {translate('terms.provider.registry')}
                </strong>{' '}
                <span className="text-foreground">Registro Mercantil de Barcelona, tomo 47545, folio 116, hoja 555162</span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.object.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.object.content')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.object.scope')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.access.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.access.intro')}
            </p>
            <ul className="ml-6 list-disc space-y-3 text-base leading-relaxed">
              <li className="text-foreground">
                {translate('terms.access.requirement1')}
              </li>
              <li className="text-foreground">
                {translate('terms.access.requirement2')}
              </li>
              <li className="text-foreground">
                {translate('terms.access.requirement3')}
              </li>
              <li className="text-foreground">
                {translate('terms.access.requirement4')}
              </li>
            </ul>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.access.reservation')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.obligations.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.obligations.intro')}
            </p>
            <ul className="ml-6 list-disc space-y-3 text-base leading-relaxed">
              <li className="text-foreground">
                {translate('terms.obligations.item1')}
              </li>
              <li className="text-foreground">
                {translate('terms.obligations.item2')}
              </li>
              <li className="text-foreground">
                {translate('terms.obligations.item3')}
              </li>
              <li className="text-foreground">
                {translate('terms.obligations.item4')}
              </li>
              <li className="text-foreground">
                {translate('terms.obligations.item5')}
              </li>
              <li className="text-foreground">
                {translate('terms.obligations.item6')}
              </li>
              <li className="text-foreground">
                {translate('terms.obligations.item7')}
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.intellectual.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.intellectual.content')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.intellectual.userContent')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.intellectual.tenant')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.liability.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.liability.service')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.liability.content')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.liability.limitation')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.liability.thirdParty')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.data.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.data.content')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.data.tenant')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.modifications.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.modifications.terms')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.modifications.service')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.termination.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.termination.user')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.termination.provider')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.termination.data')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.law.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.law.content')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.law.consumer')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.disputes.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.disputes.content')}
            </p>
            <p className="mt-2 text-foreground">
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.disputes.mediation')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.contact.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.contact.content')}
            </p>
            <p className="text-base text-foreground">
              <strong className="text-foreground">
                {translate('terms.contact.email')}
              </strong>{' '}
              <a
                href="mailto:support+create@acceleralia.com"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                support+create@acceleralia.com
              </a>
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.contact.acceptance')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('terms.acceptance.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.acceptance.content')}
            </p>
            <p className="text-base leading-relaxed text-foreground">
              {translate('terms.acceptance.modifications')}
            </p>
          </div>

          <hr className="my-8 border-gray-300 dark:border-gray-700" />

          <p className="text-sm italic text-muted-foreground">
            {translate('terms.lastUpdate')}{' '}
            {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
