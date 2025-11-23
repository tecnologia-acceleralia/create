import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/common';
import { EmptyState } from '@/components/common';
import { cn } from '@/utils/cn';
import { safeTranslate } from '@/utils/i18n-helpers';

export type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DataTableProps<T> = {
  title: string;
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string | ReactNode;
  pagination?: {
    meta: PaginationMeta;
    onPageChange: (page: number) => void;
    paginationLabel?: (from: number, to: number, total: number) => string;
    prevLabel?: string;
    nextLabel?: string;
  };
  className?: string;
  actions?: ReactNode;
};

export function DataTable<T extends { id: number | string }>({
  title,
  columns,
  data,
  isLoading = false,
  emptyMessage,
  pagination,
  className,
  actions
}: DataTableProps<T>) {
  const { t } = useTranslation();

  const paginationLabel = pagination?.paginationLabel ?? ((from, to, total) => 
    safeTranslate(t, 'common.pagination', { from, to, total, defaultValue: `${from}-${to} de ${total}` })
  );

  const prevLabel = pagination?.prevLabel ?? safeTranslate(t, 'common.prevPage', { defaultValue: 'Anterior' });
  const nextLabel = pagination?.nextLabel ?? safeTranslate(t, 'common.nextPage', { defaultValue: 'Siguiente' });

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle>{title}</CardTitle>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner />
        ) : data.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(column => (
                    <TableHead key={column.key} className={column.className}>
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(item => (
                  <TableRow key={item.id}>
                    {columns.map(column => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pagination && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {paginationLabel(
                    (pagination.meta.page - 1) * pagination.meta.pageSize + 1,
                    Math.min(pagination.meta.page * pagination.meta.pageSize, pagination.meta.totalItems),
                    pagination.meta.totalItems
                  )}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pagination.onPageChange(Math.max(1, pagination.meta.page - 1))}
                    disabled={pagination.meta.page <= 1}
                  >
                    {prevLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pagination.onPageChange(Math.min(pagination.meta.totalPages, pagination.meta.page + 1))}
                    disabled={pagination.meta.totalPages === 0 || pagination.meta.page >= pagination.meta.totalPages}
                  >
                    {nextLabel}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState message={emptyMessage} />
        )}
      </CardContent>
    </Card>
  );
}

