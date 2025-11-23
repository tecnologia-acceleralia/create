import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/common';
import { useTenant } from '@/context/TenantContext';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getEventStatistics, getEventDetail, type EventStatistics } from '@/services/events';
import { formatDateTime } from '@/utils/date';
import { arrayToCSV, downloadCSV } from '@/utils/csv';
import type { RegistrationSchema } from '@/services/public';

function getFullName(firstName: string | null, lastName: string | null, email: string | null) {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }
  return email ?? '—';
}

function resolveSchemaLabel(
  label: Record<string, string> | string | undefined,
  language: string,
  fallback: string
): string {
  if (!label) {
    return fallback;
  }

  if (typeof label === 'string') {
    return label;
  }

  const normalized = language?.split('-')[0]?.toLowerCase();
  if (normalized && label[normalized]) {
    return label[normalized] ?? fallback;
  }

  // Fallback: español, inglés, catalán, o el fallback proporcionado
  return label.es ?? label.en ?? label.ca ?? fallback;
}

function getGradeLabel(
  gradeCode: string,
  registrationSchema: RegistrationSchema | null | undefined,
  language: string
): string {
  if (gradeCode === '__NO_GRADE__') {
    return '';
  }

  if (!registrationSchema || typeof registrationSchema !== 'object') {
    return gradeCode;
  }

  // El schema tiene campos en el nivel raíz, buscar el campo 'grade'
  const gradeField = (registrationSchema as Record<string, unknown>).grade;
  if (!gradeField || typeof gradeField !== 'object') {
    return gradeCode;
  }

  const gradeFieldObj = gradeField as { options?: Array<{ value: string; label?: Record<string, string> | string }> };
  if (!Array.isArray(gradeFieldObj.options) || gradeFieldObj.options.length === 0) {
    return gradeCode;
  }

  const gradeOption = gradeFieldObj.options.find(option => option.value === gradeCode);
  if (!gradeOption) {
    return gradeCode;
  }

  return resolveSchemaLabel(gradeOption.label, language, gradeCode);
}

function EventStatisticsTab({ eventId, onViewTeam }: { readonly eventId: number; readonly onViewTeam?: (teamId: number) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const { branding, registrationSchema: tenantRegistrationSchema } = useTenant();
  const [selectedCustomField, setSelectedCustomField] = useState<string>('');

  const { data: statistics, isLoading, isError } = useQuery<EventStatistics>({
    queryKey: ['events', eventId, 'statistics'],
    queryFn: () => getEventStatistics(eventId),
    enabled: Number.isInteger(eventId)
  });

  const { data: eventDetail } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => getEventDetail(eventId),
    enabled: Number.isInteger(eventId),
    select: (data) => data.registration_schema
  });

  const primaryColor = branding.primaryColor || 'hsl(var(--primary))';

  // Aplicar estilos a tabs activos cuando cambia el color primario
  useEffect(() => {
    const styleId = 'event-statistics-tabs-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
      [data-statistics-tabs] button[data-state="active"] {
        background-color: ${primaryColor} !important;
        color: white !important;
      }
    `;
    
    return () => {
      const existing = document.getElementById(styleId);
      if (existing?.parentNode) {
        existing.remove();
      }
    };
  }, [primaryColor]);

  const customFieldOptions = useMemo(() => {
    if (!statistics?.customFields || statistics.customFields.length === 0) {
      return [];
    }
    return statistics.customFields.map(field => ({
      value: field.name,
      label: field.label
    }));
  }, [statistics]);

  const selectedCustomFieldAggregate = useMemo(() => {
    if (!selectedCustomField || !statistics?.customFieldAggregates) {
      return null;
    }
    return statistics.customFieldAggregates[selectedCustomField] ?? null;
  }, [selectedCustomField, statistics]);

  // Ordenar equipos por nombre
  const sortedTeams = useMemo(() => {
    if (!statistics?.teams) return [];
    return [...statistics.teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [statistics]);

  // Ordenar usuarios sin equipo por nombre
  const sortedUsersWithoutTeam = useMemo(() => {
    if (!statistics?.usersWithoutTeam) return [];
    return [...statistics.usersWithoutTeam].sort((a, b) => {
      const nameA = getFullName(a.firstName, a.lastName, a.email).toLowerCase();
      const nameB = getFullName(b.firstName, b.lastName, b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [statistics]);

  // Ordenar todos los usuarios por nombre
  const sortedUsers = useMemo(() => {
    if (!statistics?.users) return [];
    return [...statistics.users].sort((a, b) => {
      const nameA = getFullName(a.firstName, a.lastName, a.email).toLowerCase();
      const nameB = getFullName(b.firstName, b.lastName, b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [statistics]);

  // Ordenar resumen por grados por columna "Con equipo" (descendente)
  const sortedGradeSummary = useMemo(() => {
    if (!statistics?.gradeSummary) return [];
    return [...statistics.gradeSummary].sort((a, b) => (b.withTeam || 0) - (a.withTeam || 0));
  }, [statistics]);

  // Función para exportar equipos a CSV
  const exportTeamsToCSV = () => {
    if (!statistics || sortedTeams.length === 0) return;
    
    const headers = [
      '#',
      safeTranslate(t, 'events.statisticsSection.teams.team'),
      safeTranslate(t, 'events.statisticsSection.teams.project'),
      'Estado Proyecto',
      safeTranslate(t, 'events.statisticsSection.teams.captain'),
      'Email Capitán',
      'Total Miembros',
      safeTranslate(t, 'events.statisticsSection.teams.members')
    ];

    const csvData = sortedTeams
      .filter(team => team.name) // Filtrar equipos sin nombre
      .map((team, index) => ({
        [headers[0]]: String(index + 1),
        [headers[1]]: team.name || '',
        [headers[2]]: team.project?.name || 'Sin proyecto',
        [headers[3]]: team.project?.status || '',
        [headers[4]]: team.captain ? getFullName(team.captain.firstName, team.captain.lastName, team.captain.email) : 'Sin capitán',
        [headers[5]]: team.captain?.email || '',
        [headers[6]]: String(team.totalMembers || 0),
        [headers[7]]: team.members && team.members.length > 0 
          ? team.members.map(m => getFullName(m.firstName, m.lastName, m.email)).join('; ')
          : 'Sin miembros'
      }));

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    downloadCSV(csv, `equipos-evento-${eventId}`);
  };

  // Función para exportar usuarios sin equipo a CSV
  const exportUsersWithoutTeamToCSV = () => {
    if (!statistics?.usersWithoutTeam?.length) return;
    
    const headers = [
      '#',
      safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.name'),
      safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.email'),
      safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.grade'),
      safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.lastLogin')
    ];

    const csvData = sortedUsersWithoutTeam
      .filter(user => user.firstName || user.lastName || user.email) // Filtrar usuarios sin datos
      .map((user, index) => ({
        [headers[0]]: String(index + 1),
        [headers[1]]: getFullName(user.firstName, user.lastName, user.email) || '',
        [headers[2]]: user.email || '',
        [headers[3]]: user.grade || '',
        [headers[4]]: user.lastLoginAt ? formatDateTime(locale, user.lastLoginAt) : ''
      }));

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    downloadCSV(csv, `usuarios-sin-equipo-evento-${eventId}`);
  };

  // Función para exportar usuarios a CSV
  const exportUsersToCSV = () => {
    if (!statistics?.users?.length) return;
    
    const headers = [
      '#',
      safeTranslate(t, 'events.statisticsSection.users.name'),
      safeTranslate(t, 'events.statisticsSection.users.email'),
      safeTranslate(t, 'events.statisticsSection.users.team'),
      safeTranslate(t, 'events.statisticsSection.users.role'),
      safeTranslate(t, 'events.statisticsSection.users.grade'),
      safeTranslate(t, 'events.statisticsSection.users.lastLogin')
    ];

    const csvData = sortedUsers
      .filter(user => user.firstName || user.lastName || user.email) // Filtrar usuarios sin datos
      .map((user, index) => ({
        [headers[0]]: String(index + 1),
        [headers[1]]: getFullName(user.firstName, user.lastName, user.email) || '',
        [headers[2]]: user.email || '',
        [headers[3]]: user.team?.name || 'Sin equipo',
        [headers[4]]: (user.roles && user.roles.length > 0) ? user.roles.join(', ') : 'Sin roles',
        [headers[5]]: user.grade || '',
        [headers[6]]: user.lastLoginAt ? formatDateTime(locale, user.lastLoginAt) : ''
      }));

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    downloadCSV(csv, `usuarios-evento-${eventId}`);
  };

  // Función para exportar grados a CSV
  const exportGradesToCSV = () => {
    if (!statistics?.gradeSummary?.length) return;
    
    const headers = [
      safeTranslate(t, 'events.statisticsSection.grades.grade'),
      safeTranslate(t, 'events.statisticsSection.grades.withTeam'),
      safeTranslate(t, 'events.statisticsSection.grades.withoutTeam'),
      safeTranslate(t, 'events.statisticsSection.grades.total')
    ];

    const csvData = sortedGradeSummary.map(entry => {
      const gradeLabel = entry.grade === '__NO_GRADE__'
        ? safeTranslate(t, 'events.statisticsSection.grades.noGrade')
        : getGradeLabel(entry.grade, tenantRegistrationSchema, locale);
      return {
        [headers[0]]: gradeLabel,
        [headers[1]]: String(entry.withTeam || 0),
        [headers[2]]: String(entry.withoutTeam || 0),
        [headers[3]]: String(entry.total || 0)
      };
    });

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    downloadCSV(csv, `grados-evento-${eventId}`);
  };

  // Función para exportar variables custom a CSV
  const exportCustomFieldsToCSV = () => {
    if (!selectedCustomFieldAggregate?.summary?.length) return;
    
    const headers = [
      selectedCustomFieldAggregate.field.label || selectedCustomFieldAggregate.field.name,
      safeTranslate(t, 'events.statisticsSection.customFields.withTeam'),
      safeTranslate(t, 'events.statisticsSection.customFields.withoutTeam'),
      safeTranslate(t, 'events.statisticsSection.customFields.total')
    ];

    const csvData = selectedCustomFieldAggregate.summary.map(entry => ({
      [headers[0]]: entry.value === '__NO_VALUE__' ? safeTranslate(t, 'events.statisticsSection.customFields.noValue') : String(entry.value || ''),
      [headers[1]]: String(entry.withTeam || 0),
      [headers[2]]: String(entry.withoutTeam || 0),
      [headers[3]]: String(entry.total || 0)
    }));

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    downloadCSV(csv, `custom-${selectedCustomFieldAggregate.field.name}-evento-${eventId}`);
  };

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  if (isError || !statistics) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {safeTranslate(t, 'events.statisticsError', { defaultValue: 'Error al cargar las estadísticas' })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="teams" className="space-y-6">
      <TabsList data-statistics-tabs className="grid w-full grid-cols-5">
        <TabsTrigger value="teams">{safeTranslate(t, 'events.statisticsSection.teams.title', { defaultValue: 'Equipos' })}</TabsTrigger>
        <TabsTrigger value="users-without-team">{safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.title', { defaultValue: 'Sin Equipos' })}</TabsTrigger>
        <TabsTrigger value="users">{safeTranslate(t, 'events.statisticsSection.users.title', { defaultValue: 'Usuarios' })}</TabsTrigger>
        <TabsTrigger value="grades">{safeTranslate(t, 'events.statisticsSection.grades.title', { defaultValue: 'Grados' })}</TabsTrigger>
        {customFieldOptions.length > 0 && (
          <TabsTrigger value="custom">{safeTranslate(t, 'events.statisticsSection.customFields.title', { defaultValue: 'Custom' })}</TabsTrigger>
        )}
      </TabsList>

      {/* Tab: Equipos */}
      <TabsContent value="teams" className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{safeTranslate(t, 'events.statisticsSection.teams.title', { defaultValue: 'Equipos y Proyectos' })}</CardTitle>
            <Button variant="outline" size="sm" onClick={exportTeamsToCSV}>
              <Download className="h-4 w-4 mr-2" />
              {safeTranslate(t, 'common.export', { defaultValue: 'Exportar CSV' })}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{safeTranslate(t, 'events.statisticsSection.teams.team', { defaultValue: 'Equipo' })}</TableHead>
                <TableHead>{safeTranslate(t, 'events.statisticsSection.teams.project', { defaultValue: 'Proyecto' })}</TableHead>
                <TableHead>{safeTranslate(t, 'events.statisticsSection.teams.captain', { defaultValue: 'Capitán' })}</TableHead>
                <TableHead>{safeTranslate(t, 'events.statisticsSection.teams.totalMembers', { defaultValue: 'Total Miembros' })}</TableHead>
                <TableHead>{safeTranslate(t, 'events.statisticsSection.teams.members', { defaultValue: 'Miembros' })}</TableHead>
                {onViewTeam && <TableHead>{safeTranslate(t, 'common.actions', { defaultValue: 'Acciones' })}</TableHead>}
              </TableRow>
            </TableHeader>
              <TableBody>
                {sortedTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={onViewTeam ? 7 : 6} className="text-center text-sm text-muted-foreground">
                      {safeTranslate(t, 'events.statisticsSection.teams.empty', { defaultValue: 'No hay equipos registrados' })}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTeams.map((team, index) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        {team.project ? (
                          <div>
                            <div className="font-medium">{team.project.name}</div>
                            <Badge variant="outline" className="mt-1 capitalize">
                              {team.project.status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {safeTranslate(t, 'events.statisticsSection.teams.noProject', { defaultValue: 'Sin proyecto' })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {team.captain ? (
                          <div>
                            <div>{getFullName(team.captain.firstName, team.captain.lastName, team.captain.email)}</div>
                            <div className="text-xs text-muted-foreground">{team.captain.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {safeTranslate(t, 'events.statisticsSection.teams.noCaptain', { defaultValue: 'Sin capitán' })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{team.totalMembers}</TableCell>
                      <TableCell>
                        {team.members.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            {safeTranslate(t, 'events.statisticsSection.teams.noMembers', { defaultValue: 'Sin miembros' })}
                          </span>
                        ) : (
                          <span className="text-sm">
                            {team.members.map(m => getFullName(m.firstName, m.lastName, m.email)).join(', ')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {onViewTeam && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewTeam(team.id)}
                          >
                            {safeTranslate(t, 'teams.viewDetails', { defaultValue: 'Ver equipo' })}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Usuarios sin equipos */}
      <TabsContent value="users-without-team" className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.title', { defaultValue: 'Usuarios sin Equipos' })}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportUsersWithoutTeamToCSV}>
              <Download className="h-4 w-4 mr-2" />
              {safeTranslate(t, 'common.export', { defaultValue: 'Exportar CSV' })}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.name', { defaultValue: 'Nombre' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.email', { defaultValue: 'Email' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.grade', { defaultValue: 'Grado' })}</TableHead>
                  <TableHead>
                    {safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.lastLogin', { defaultValue: 'Último login' })}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsersWithoutTeam.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {safeTranslate(t, 'events.statisticsSection.usersWithoutTeam.empty', { defaultValue: 'Todos los usuarios tienen equipo' })}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUsersWithoutTeam.map((user, index) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {getFullName(user.firstName, user.lastName, user.email)}
                      </TableCell>
                      <TableCell>{user.email ?? '—'}</TableCell>
                      <TableCell>{user.grade ?? '—'}</TableCell>
                      <TableCell>
                        {user.lastLoginAt ? formatDateTime(locale, user.lastLoginAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Todos los usuarios */}
      <TabsContent value="users" className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{safeTranslate(t, 'events.statisticsSection.users.title', { defaultValue: 'Todos los Usuarios' })}</CardTitle>
            <Button variant="outline" size="sm" onClick={exportUsersToCSV}>
              <Download className="h-4 w-4 mr-2" />
              {safeTranslate(t, 'common.export', { defaultValue: 'Exportar CSV' })}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.users.name', { defaultValue: 'Nombre' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.users.email', { defaultValue: 'Email' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.users.team', { defaultValue: 'Equipo' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.users.role', { defaultValue: 'Rol' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.users.grade', { defaultValue: 'Grado' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.users.lastLogin', { defaultValue: 'Último login' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      {safeTranslate(t, 'events.statisticsSection.users.empty', { defaultValue: 'No hay usuarios registrados' })}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUsers.map((user, index) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {getFullName(user.firstName, user.lastName, user.email)}
                      </TableCell>
                      <TableCell>{user.email ?? '—'}</TableCell>
                      <TableCell>
                        {user.team ? (
                          <span className="font-medium">{user.team.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {safeTranslate(t, 'events.statisticsSection.users.noTeam', { defaultValue: 'Sin equipo' })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.roles.length > 0 ? (
                          user.roles.join(', ')
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {safeTranslate(t, 'events.statisticsSection.users.noRoles', { defaultValue: 'Sin roles' })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{user.grade ?? '—'}</TableCell>
                      <TableCell>
                        {user.lastLoginAt ? formatDateTime(locale, user.lastLoginAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Grados */}
      <TabsContent value="grades" className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{safeTranslate(t, 'events.statisticsSection.grades.title', { defaultValue: 'Resumen por Grados' })}</CardTitle>
            <Button variant="outline" size="sm" onClick={exportGradesToCSV}>
              <Download className="h-4 w-4 mr-2" />
              {safeTranslate(t, 'common.export', { defaultValue: 'Exportar CSV' })}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.grades.grade', { defaultValue: 'Grado' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.grades.withTeam', { defaultValue: 'Con equipo' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.grades.withoutTeam', { defaultValue: 'Sin equipo' })}</TableHead>
                  <TableHead>{safeTranslate(t, 'events.statisticsSection.grades.total', { defaultValue: 'Total' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGradeSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {safeTranslate(t, 'events.statisticsSection.grades.empty', { defaultValue: 'No hay datos de grados' })}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedGradeSummary.map(entry => {
                    const gradeLabel =
                      entry.grade === '__NO_GRADE__'
                        ? safeTranslate(t, 'events.statisticsSection.grades.noGrade', { defaultValue: 'Sin grado' })
                        : getGradeLabel(entry.grade, tenantRegistrationSchema, locale);
                    return (
                      <TableRow key={entry.grade}>
                        <TableCell className="font-medium">{gradeLabel}</TableCell>
                        <TableCell>{entry.withTeam}</TableCell>
                        <TableCell>{entry.withoutTeam}</TableCell>
                        <TableCell className="font-medium">{entry.total}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Variables Custom */}
      {customFieldOptions.length > 0 && (
        <TabsContent value="custom" className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {safeTranslate(t, 'events.statisticsSection.customFields.title', { defaultValue: 'Agregados por Variables Custom' })}
              </CardTitle>
              {selectedCustomFieldAggregate && (
                <Button variant="outline" size="sm" onClick={exportCustomFieldsToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {safeTranslate(t, 'common.export', { defaultValue: 'Exportar CSV' })}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">
                  {safeTranslate(t, 'events.statisticsSection.customFields.selectField', { defaultValue: 'Seleccionar variable:' })}
                </label>
                <Select
                  value={selectedCustomField}
                  onChange={e => setSelectedCustomField(e.target.value)}
                  className="w-[300px]"
                >
                  <option value="">
                    {safeTranslate(t, 'events.statisticsSection.customFields.selectPlaceholder', { defaultValue: 'Selecciona una variable' })}
                  </option>
                  {customFieldOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              {selectedCustomFieldAggregate && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {selectedCustomFieldAggregate.field.label || selectedCustomFieldAggregate.field.name}
                        </TableHead>
                        <TableHead>{safeTranslate(t, 'events.statisticsSection.customFields.withTeam', { defaultValue: 'Con equipo' })}</TableHead>
                        <TableHead>{safeTranslate(t, 'events.statisticsSection.customFields.withoutTeam', { defaultValue: 'Sin equipo' })}</TableHead>
                        <TableHead>{safeTranslate(t, 'events.statisticsSection.customFields.total', { defaultValue: 'Total' })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomFieldAggregate.summary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                            {safeTranslate(t, 'events.statisticsSection.customFields.empty', { defaultValue: 'No hay datos' })}
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedCustomFieldAggregate.summary.map((entry) => {
                          const valueLabel =
                            entry.value === '__NO_VALUE__'
                              ? safeTranslate(t, 'events.statisticsSection.customFields.noValue', { defaultValue: 'Sin valor' })
                              : String(entry.value);
                          return (
                            <TableRow key={`${selectedCustomFieldAggregate.field.name}-${entry.value}`}>
                              <TableCell className="font-medium">{valueLabel}</TableCell>
                              <TableCell>{entry.withTeam}</TableCell>
                              <TableCell>{entry.withoutTeam}</TableCell>
                              <TableCell className="font-medium">{entry.total}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}

export default EventStatisticsTab;
