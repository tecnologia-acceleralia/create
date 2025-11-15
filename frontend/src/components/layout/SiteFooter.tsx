import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Globe, createLucideIcon } from "lucide-react";
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { createSurfaceTheme } from '@/utils/color';

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
  const footerTheme = useMemo(() => createSurfaceTheme(branding.primaryColor), [branding.primaryColor]);
  const footerStyle = useMemo<CSSProperties>(
    () => ({
      '--footer-bg': footerTheme.background,
      '--footer-fg': footerTheme.foreground,
      '--footer-muted': footerTheme.muted,
      '--footer-border': footerTheme.border,
      '--footer-subtle': footerTheme.subtle,
      '--footer-surface': footerTheme.surface,
      '--footer-hover': footerTheme.hover,
      color: footerTheme.foreground,
      backgroundColor: footerTheme.background
    }),
    [footerTheme]
  );

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
    <footer
      className="relative mt-auto overflow-hidden border-t border-[color:var(--footer-border)] bg-[color:var(--footer-bg)] text-[color:var(--footer-fg)]"
      style={footerStyle}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-[color:var(--footer-subtle)] via-transparent to-[color:var(--footer-hover)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={t('navigation.brand', { defaultValue: 'Create' })} className="h-10 w-auto" />
            ) : (
              <span className="text-lg font-semibold text-[color:var(--footer-fg)]">Create</span>
            )}
            <p className="text-sm text-[color:var(--footer-muted)]">{t('footer.description')}</p>
            {socialLinks.length ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {socialLinks.map(({ key, Icon, href, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--footer-border)] text-[color:var(--footer-muted)] transition-colors hover:border-[color:var(--footer-fg)] hover:text-[color:var(--footer-fg)]"
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--footer-muted)]">{t('footer.resources')}</h3>
            <ul className="mt-4 space-y-2 text-sm text-[color:var(--footer-muted)]">
              <li>
                <a href="mailto:support+create@acceleralia.com" className="transition-colors hover:text-[color:var(--footer-fg)]">
                  {t('footer.support')}
                </a>
              </li>
              <li>
                <a
                  href="https://acceleralia.com/create-2/"
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-[color:var(--footer-fg)]"
                >
                  {t('footer.aboutCreate')}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--footer-muted)]">{t('footer.legal')}</h3>
            <ul className="mt-4 space-y-2 text-sm text-[color:var(--footer-muted)]">
              <li>
                <Link to={tenantPath('legal/privacy')} className="transition-colors hover:text-[color:var(--footer-fg)]">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link to={tenantPath('legal/terms')} className="transition-colors hover:text-[color:var(--footer-fg)]">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link to={tenantPath('legal/cookies')} className="transition-colors hover:text-[color:var(--footer-fg)]">
                  {t('footer.cookies')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-[color:var(--footer-border)]">
        <div
          className="absolute inset-0 bg-gradient-to-r from-[color:var(--footer-subtle)] via-transparent to-[color:var(--footer-hover)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-[color:var(--footer-muted)] sm:flex-row sm:px-6 lg:px-8">
          <span>
            {'\u00a9'} {year} Create. {t('footer.rights')}
          </span>
          <span>
            <a
              href="https://www.acceleralia.com"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[color:var(--footer-fg)]"
            >
              {t('footer.madeWith')}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
