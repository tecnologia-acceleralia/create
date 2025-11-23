import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import { safeTranslate } from '@/utils/i18n-helpers';

export default function CookiesPolicyPage() {
  const { t } = useTranslation();
  const translate = (key: string) => {
    const translation = safeTranslate(t, key);
    return translation === key ? 'Contenido no encontrado' : translation;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={translate('cookies.title')}
        subtitle={translate('cookies.subtitle')}
      />

      <div className="max-w-none mt-8">
        <div className="space-y-8 text-base leading-7 text-foreground">
          <p className="text-lg text-foreground">
            {translate('cookies.intro')}
          </p>

          <div className="rounded-lg bg-card border border-border/60 p-6 shadow-sm">
            <h2 className="mt-0 text-2xl font-semibold mb-4 text-foreground">
              {translate('cookies.whatAre.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.whatAre.content')}
            </p>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('cookies.types.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.types.intro')}
            </p>

            <div className="mt-6 space-y-6">
              <div className="rounded-lg border-2 border-border/60 bg-card p-6 shadow-sm">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  {translate('cookies.types.auth.title')}
                </h3>
                <div className="space-y-3 text-base">
                  <p className="text-foreground">
                    <strong className="text-foreground">
                      {translate('cookies.types.auth.purpose')}
                    </strong>{' '}
                    <span className="text-foreground">
                      {translate('cookies.types.auth.purposeContent')}
                    </span>
                  </p>
                  <p className="text-foreground">
                    <strong className="text-foreground">
                      {translate('cookies.types.auth.duration')}
                    </strong>{' '}
                    <span className="text-foreground">
                      {translate('cookies.types.auth.durationContent')}
                    </span>
                  </p>
                  <p className="text-foreground">
                    <strong className="text-foreground">
                      {translate('cookies.types.auth.type')}
                    </strong>{' '}
                    <span className="text-foreground">
                      {translate('cookies.types.auth.typeContent')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border-2 border-border/60 bg-card p-6 shadow-sm">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  {translate('cookies.types.preferences.title')}
                </h3>
                <div className="space-y-3 text-base">
                  <p className="text-foreground">
                    <strong className="text-foreground">
                      {translate('cookies.types.preferences.purpose')}
                    </strong>{' '}
                    <span className="text-foreground">
                      {translate('cookies.types.preferences.purposeContent')}
                    </span>
                  </p>
                  <p className="text-foreground">
                    <strong className="text-foreground">
                      {translate('cookies.types.preferences.duration')}
                    </strong>{' '}
                    <span className="text-foreground">
                      {translate('cookies.types.preferences.durationContent')}
                    </span>
                  </p>
                  <p className="text-foreground">
                    <strong className="text-foreground">
                      {translate('cookies.types.preferences.type')}
                    </strong>{' '}
                    <span className="text-foreground">
                      {translate('cookies.types.preferences.typeContent')}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('cookies.thirdParty.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.thirdParty.content')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('cookies.management.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.management.content')}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">Google Chrome:</strong>{' '}
                  <span className="text-foreground">
                    {translate('cookies.management.chrome')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">Mozilla Firefox:</strong>{' '}
                  <span className="text-foreground">
                    {translate('cookies.management.firefox')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">Microsoft Edge:</strong>{' '}
                  <span className="text-foreground">
                    {translate('cookies.management.edge')}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-4 shadow-sm">
                <p className="text-base text-foreground">
                  <strong className="text-foreground">Safari:</strong>{' '}
                  <span className="text-foreground">
                    {translate('cookies.management.safari')}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-base text-foreground">
                <strong className="text-foreground">
                  {translate('cookies.management.warning')}
                </strong>{' '}
                <span className="text-foreground">
                  {translate('cookies.management.warningContent')}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('cookies.consent.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.consent.content')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('cookies.updates.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.updates.content')}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {translate('cookies.contact.title')}
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {translate('cookies.contact.content')}
            </p>
            <p className="text-base text-foreground">
              <strong className="text-foreground">
                {translate('cookies.contact.email')}
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
            {translate('cookies.lastUpdate')}{' '}
            {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
