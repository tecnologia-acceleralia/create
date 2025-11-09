import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Globe, createLucideIcon } from "lucide-react";
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';

const FacebookIcon = createLucideIcon("social-facebook", [
  [
    "path",
    {
      d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
      key: "facebook-path"
    }
  ]
]);

const InstagramIcon = createLucideIcon("social-instagram", [
  ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5", key: "instagram-rect" }],
  ["path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z", key: "instagram-path" }],
  ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5", key: "instagram-line" }]
]);

const LinkedinIcon = createLucideIcon("social-linkedin", [
  [
    "path",
    {
      d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",
      key: "linkedin-path"
    }
  ],
  ["rect", { width: "4", height: "12", x: "2", y: "9", key: "linkedin-rect" }],
  ["circle", { cx: "4", cy: "4", r: "2", key: "linkedin-circle" }]
]);

const YoutubeIcon = createLucideIcon("social-youtube", [
  [
    "path",
    {
      d: "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17",
      key: "youtube-body"
    }
  ],
  ["path", { d: "m10 15 5-3-5-3z", key: "youtube-play" }]
]);

const XBrandIcon = createLucideIcon("social-x", [
  [
    "path",
    {
      d: "M3.5 3h4.4l4.2 6 5.3-6H21l-7.7 8.8L21 21h-4.4l-4.5-6.4L6.5 21H3l8.3-9.1L3.5 3z",
      fill: "currentColor",
      stroke: "none",
      key: "x-path"
    }
  ]
]);

const SOCIAL_ICON_MAP = [
  { key: 'website', Icon: Globe, translationKey: 'footer.website' },
  { key: 'facebook', Icon: FacebookIcon, translationKey: 'footer.facebook' },
  { key: 'instagram', Icon: InstagramIcon, translationKey: 'footer.instagram' },
  { key: 'linkedin', Icon: LinkedinIcon, translationKey: 'footer.linkedin' },
  { key: 'twitter', Icon: XBrandIcon, translationKey: 'footer.x' },
  { key: 'youtube', Icon: YoutubeIcon, translationKey: 'footer.youtube' }
] as const;

export function SiteFooter() {
  const { t } = useTranslation();
  const { branding } = useTenant();
  const tenantPath = useTenantPath();
  const year = new Date().getFullYear();

  const socialLinks = SOCIAL_ICON_MAP.flatMap(entry => {
    const value = branding.socialLinks?.[entry.key];
    if (!value) {
      return [];
    }
    return [
      {
        key: entry.key,
        Icon: entry.Icon,
        href: value,
        label: t(entry.translationKey)
      }
    ];
  });

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-border/60 bg-background/80 backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--tenant-primary)]/20 via-transparent to-[color:var(--tenant-accent)]/20" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={t('navigation.brand', { defaultValue: 'Create' })} className="h-10 w-auto" />
            ) : (
              <span className="text-lg font-semibold text-[color:var(--tenant-primary)]">Create</span>
            )}
            <p className="text-sm text-muted-foreground">{t('footer.description')}</p>
            {socialLinks.length ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {socialLinks.map(({ key, Icon, href, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-[color:var(--tenant-primary)] hover:text-[color:var(--tenant-primary)]"
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('footer.resources')}</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="mailto:support@acceleralia.com" className="transition-colors hover:text-[color:var(--tenant-primary)]">
                  {t('footer.support')}
                </a>
              </li>
              <li>
                <a
                  href="https://acceleralia.com/create-2/"
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-[color:var(--tenant-primary)]"
                >
                  {t('footer.aboutCreate')}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('footer.legal')}</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to={tenantPath('legal/privacy')} className="transition-colors hover:text-[color:var(--tenant-primary)]">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link to={tenantPath('legal/terms')} className="transition-colors hover:text-[color:var(--tenant-primary)]">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link to={tenantPath('legal/cookies')} className="transition-colors hover:text-[color:var(--tenant-primary)]">
                  {t('footer.cookies')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-border/60">
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--tenant-secondary)]/20 via-transparent to-[color:var(--tenant-accent)]/20" aria-hidden="true" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>
            {'\u00a9'} {year} Create. {t('footer.rights')}
          </span>
          <span>
            <a
              href="https://www.acceleralia.com"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[color:var(--tenant-primary)]"
            >
              {t('footer.madeWith')}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
