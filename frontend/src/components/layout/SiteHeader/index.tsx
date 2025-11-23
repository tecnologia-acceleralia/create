import { Link } from "react-router";
import { Globe, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { safeTranslate } from '@/utils/i18n-helpers';
import { useSiteHeader } from './hooks/useSiteHeader';
import { HeaderBranding } from './components/HeaderBranding';
import { HeaderNavigation } from './components/HeaderNavigation';
import { HeaderMobileMenu } from './components/HeaderMobileMenu';
import { HeaderProfileMenu } from './components/HeaderProfileMenu';

export function SiteHeader() {
  const { t } = useTranslation();
  const {
    branding,
    tenantSlug,
    user,
    superAdminUser,
    isSuperAdminSession,
    shouldRenderProfileMenu,
    tenantPath,
    location,
    activeEventId,
    isEventAdmin,
    canAccessTracking,
    eventHomePath,
    canViewPhases,
    phaseZero,
    phaseLinks,
    tasksByPhase,
    hasTeam,
    isEventHomeActive,
    displayName,
    avatarNode,
    loginHref,
    unreadCount,
    currentLanguage,
    headerStyle,
    mobileOpen,
    setMobileOpen,
    profileOpen,
    setProfileOpen,
    openPhaseMenu,
    setOpenPhaseMenu,
    openHomeMenu,
    setOpenHomeMenu,
    openTrackingMenu,
    setOpenTrackingMenu,
    menuPositions,
    menuRefs,
    toggleLanguage,
    handleLogout
  } = useSiteHeader();

  const brandLabel = safeTranslate(t, 'navigation.brand', { defaultValue: 'Create' });

  return (
    <header
      className="sticky top-0 z-[100] border-b border-[color:var(--header-border)] bg-[color:var(--header-bg)] text-[color:var(--header-fg)] shadow-sm backdrop-blur overflow-visible"
      style={headerStyle}
    >
      <div className="mx-auto grid h-16 w-full max-w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8 overflow-visible [&>*:nth-child(2)]:min-w-0 [&>*:nth-child(2)]:overflow-visible">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to="/" className="text-xl font-semibold text-[color:var(--header-fg)]">
            {brandLabel}
          </Link>
          {tenantSlug ? <HeaderBranding tenantSlug={tenantSlug} /> : null}
        </div>

        <div className="hidden items-center justify-center min-w-0 md:flex relative overflow-visible flex-1">
          <HeaderNavigation
            canViewPhases={canViewPhases}
            isEventAdmin={isEventAdmin}
            activeEventId={activeEventId}
            user={user}
            isSuperAdminSession={isSuperAdminSession}
            canAccessTracking={canAccessTracking}
            eventHomePath={eventHomePath}
            isEventHomeActive={isEventHomeActive}
            phaseZero={phaseZero}
            phaseLinks={phaseLinks}
            tasksByPhase={tasksByPhase}
            hasTeam={hasTeam}
            location={location}
            openPhaseMenu={openPhaseMenu}
            setOpenPhaseMenu={setOpenPhaseMenu}
            openHomeMenu={openHomeMenu}
            setOpenHomeMenu={setOpenHomeMenu}
            openTrackingMenu={openTrackingMenu}
            setOpenTrackingMenu={setOpenTrackingMenu}
            menuPositions={menuPositions}
            menuRefs={menuRefs}
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
          <HeaderProfileMenu
            user={user}
            superAdminUser={superAdminUser}
            isSuperAdminSession={isSuperAdminSession}
            tenantSlug={tenantSlug}
            displayName={displayName}
            avatarNode={avatarNode}
            loginHref={loginHref}
            unreadCount={unreadCount}
            activeEventId={activeEventId}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            handleLogout={handleLogout}
            variant="desktop"
          />

          <button
            type="button"
            onClick={toggleLanguage}
            className="hidden items-center gap-2 rounded-full border border-[color:var(--header-border)] px-3 py-1 text-xs font-semibold uppercase text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:inline-flex"
          >
            <Globe className="h-4 w-4" />
            {currentLanguage.toUpperCase()}
          </button>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--header-border)] text-[color:var(--header-muted)] shadow-sm transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:hidden"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={safeTranslate(t, 'navigation.toggleMenu')}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <HeaderMobileMenu
        mobileOpen={mobileOpen}
        user={user}
        isSuperAdminSession={isSuperAdminSession}
        canAccessTracking={canAccessTracking}
        canViewPhases={canViewPhases}
        eventHomePath={eventHomePath}
        isEventHomeActive={isEventHomeActive}
        activeEventId={activeEventId}
        phaseZero={phaseZero}
        phaseLinks={phaseLinks}
        tasksByPhase={tasksByPhase}
        hasTeam={hasTeam}
        location={location}
        currentLanguage={currentLanguage}
        toggleLanguage={toggleLanguage}
        setMobileOpen={setMobileOpen}
        superAdminUser={superAdminUser}
        tenantSlug={tenantSlug}
        displayName={displayName}
        avatarNode={avatarNode}
        loginHref={loginHref}
        unreadCount={unreadCount}
        shouldRenderProfileMenu={shouldRenderProfileMenu}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        handleLogout={handleLogout}
      />
    </header>
  );
}

