import { useState, useMemo } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Paper, Typography, TextField,
  InputAdornment, Skeleton, TableSortLabel, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EmptyState from './EmptyState';
import { useTranslation } from '../../i18n';
import { PremiumCard } from '../design';

function SkeletonRows({ columns, rows = 6 }) {
  return Array.from({ length: rows }).map((_, ri) => (
    <TableRow key={ri}>
      {columns.map((col, ci) => (
        <TableCell key={ci}>
          <Skeleton variant="text" width={col.width || '80%'} height={20} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

/**
 * columns: [{ id, label, render?, sortable?, width?, align? }]
 * rows: data array
 * searchable: bool
 * searchPlaceholder: string
 * rowKey: function(row) → key
 */
export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  searchable = true,
  searchPlaceholder,
  rowKey = (row) => row.id,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  defaultSort,
  defaultSortDir = 'asc',
  toolbar,
  onRowClick,
  rowsPerPageOptions = [10, 25, 50],
}) {
  const { t } = useTranslation();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('dataTableComponent.searchPlaceholder');
  const resolvedEmptyTitle = emptyTitle ?? t('dataTableComponent.noResults');
  const resolvedEmptyDescription = emptyDescription ?? t('dataTableComponent.nothingToDisplay');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [orderBy, setOrderBy] = useState(defaultSort || '');
  const [order, setOrder] = useState(defaultSortDir);

  const handleSort = (colId) => {
    if (orderBy === colId) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(colId);
      setOrder('asc');
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      columns.some((col) => {
        const val = col.value ? col.value(row) : row[col.id];
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    if (!orderBy) return filtered;
    return [...filtered].sort((a, b) => {
      const col = columns.find((c) => c.id === orderBy);
      const aVal = col?.value ? col.value(a) : a[orderBy];
      const bVal = col?.value ? col.value(b) : b[orderBy];
      const cmp = String(aVal ?? '') < String(bVal ?? '') ? -1 : String(aVal ?? '') > String(bVal ?? '') ? 1 : 0;
      return order === 'asc' ? cmp : -cmp;
    });
  }, [filtered, orderBy, order, columns]);

  const paginated = useMemo(() =>
    sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sorted, page, rowsPerPage]
  );

  return (
    <Box>
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          {searchable && (
            <TextField
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder={resolvedSearchPlaceholder}
              size="small"
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          {toolbar}
        </Box>
      )}

      <PremiumCard sx={{ overflow: 'auto', maxHeight: 640, p: 0 }}>
        <TableContainer sx={{ maxHeight: 640 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.align || 'left'}
                    sx={{ py: 1.5, whiteSpace: 'nowrap', width: col.width }}
                  >
                    {col.sortable !== false ? (
                      <TableSortLabel
                        active={orderBy === col.id}
                        direction={orderBy === col.id ? order : 'asc'}
                        onClick={() => handleSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <SkeletonRows columns={columns} />
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ border: 0, py: 6 }}>
                    <EmptyState
                      title={search ? t('dataTableComponent.noResultsMatchSearch') : resolvedEmptyTitle}
                      description={search ? t('dataTableComponent.tryAdjustingSearch') : resolvedEmptyDescription}
                      icon={emptyIcon}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    hover
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    sx={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.id} align={col.align || 'left'} sx={{ py: 1.5 }}>
                        {col.render ? col.render(row) : (row[col.id] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </PremiumCard>

      {!loading && sorted.length > rowsPerPageOptions[0] && (
        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={rowsPerPageOptions}
          sx={{ borderTop: '1px solid', borderColor: 'divider', mt: -1 }}
        />
      )}
    </Box>
  );
}
