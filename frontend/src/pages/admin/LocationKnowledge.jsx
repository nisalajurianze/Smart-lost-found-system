import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiMapPin, FiRefreshCw, FiSearch, FiShield, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import locationKnowledgeService from '../../services/locationKnowledgeService';
import { useLanguage } from '../../i18n/LanguageContext';
import Pagination from '../../components/common/Pagination';

const statuses = ['community-suggested', 'map-source-verified', 'field-verified', 'university-approved', 'temporarily-closed', 'archived'];
const statusStyle = (status) => status === 'university-approved'
  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
  : status === 'community-suggested'
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
    : status === 'archived' || status === 'temporarily-closed'
      ? 'bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-200'
      : 'bg-primary-100 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200';

export const LocationKnowledge = () => {
  const { t, language } = useLanguage();
  const [scope, setScope] = useState('catalog');
  const [response, setResponse] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingId, setSavingId] = useState('');
  const locale = language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-LK';
  const catalog = scope === 'catalog';
  const requestKey = JSON.stringify([scope, status, search, page, refreshKey]);
  const result = response?.key === requestKey ? response.data : null;
  const loadError = response?.key === requestKey && response.error;
  const records = result?.records ?? [];
  const pagination = result?.pagination;
  const loading = !result && !loadError;
  const refresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    const controller = new window.AbortController();
    const showError = () => setResponse({ key: requestKey, error: true });
    const debounce = setTimeout(async () => {
      const timeout = setTimeout(() => {
        controller.abort();
        showError();
      }, 10000);
      controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
      try {
        const data = await locationKnowledgeService.listAdmin({ scope, status: status || undefined, search: search.trim() || undefined, page, limit: 24 }, controller.signal);
        if (!controller.signal.aborted) {
          if (page > data.pagination.totalPages) setPage(data.pagination.totalPages);
          else setResponse({ key: requestKey, data });
        }
      } catch {
        if (!controller.signal.aborted) showError();
      } finally {
        clearTimeout(timeout);
      }
    }, 250);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [scope, status, search, page, requestKey]);

  const updateStatus = async (record, verificationStatus) => {
    setSavingId(record._id);
    try {
      await locationKnowledgeService.review(record._id, {
        verificationStatus,
        note: `Admin location review: ${verificationStatus}`,
      });
      toast.success(t('location.updatedSuccess'));
      refresh();
    } catch {
      toast.error(t('location.updateError'));
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary-600 dark:text-primary-300">
            <FiMapPin aria-hidden="true" />
            <span className="text-sm font-extrabold uppercase tracking-wider">{t('location.eyebrow')}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-surface-900 dark:text-white">{t('location.reviewTitle')}</h1>
          <p className="mt-2 max-w-3xl text-surface-500 dark:text-surface-400">{t(catalog ? 'location.catalogSubtitle' : 'location.reviewSubtitle')}</p>
        </div>
        <button type="button" onClick={refresh} className="btn btn-outline btn-md">
          <FiRefreshCw aria-hidden="true" />{t('common.refresh')}
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {['catalog', 'community'].map((entry) => (
          <button key={entry} type="button" aria-pressed={scope === entry} onClick={() => {
            if (scope === entry) return;
            setScope(entry);
            setStatus('');
            setPage(1);
          }} className={`btn btn-md ${scope === entry ? 'btn-primary' : 'btn-outline'}`}>
            {t(`location.scope.${entry}`)}
          </button>
        ))}
      </div>

      <section className="grid gap-3 rounded-2xl border border-surface-200 bg-white p-4 sm:grid-cols-[1fr_16rem] dark:border-surface-800 dark:bg-surface-950">
        <label className="text-sm font-semibold">
          {t('common.search')}
          <div className="relative mt-1">
            <FiSearch aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              maxLength={180}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              className="min-h-11 w-full rounded-xl border border-surface-300 pl-10 pr-3 dark:border-surface-700 dark:bg-surface-900"
              placeholder={t('location.searchPlaceholder')}
            />
          </div>
        </label>
        <label className="text-sm font-semibold">
          {t('location.reviewStatus')}
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1 min-h-11 w-full rounded-xl border border-surface-300 bg-white px-3 dark:border-surface-700 dark:bg-surface-900">
            <option value="">{t('location.allStatuses')}</option>
            {statuses.map((entry) => <option key={entry} value={entry}>{t(`location.status.${entry}`, {}, entry)}</option>)}
          </select>
        </label>
      </section>

      {!loadError && <div role="status" className="text-sm font-semibold text-surface-500">
        {loading ? t('location.loading') : t('common.records', { count: pagination.totalDocs })}
      </div>}
      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 p-4 dark:border-red-900/60">
        <p>{t('location.loadError')}</p>
        <button type="button" onClick={refresh} className="btn btn-outline btn-sm">{t('location.retry')}</button>
      </div>}

      <div className="grid gap-4">
        {records.map((record) => (
          <article key={catalog ? record.id : record._id} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-950">
            <div className="flex flex-col justify-between gap-4 lg:flex-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-surface-900 dark:text-white">{record.canonicalName}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle(record.verificationStatus)}`}>{t(`location.status.${record.verificationStatus}`, {}, record.verificationStatus)}</span>
                  <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-bold dark:bg-surface-800">{t(`location.sensitivity.${record.sensitivity}`, {}, record.sensitivity)}</span>
                </div>
                <p className="mt-1 text-sm text-surface-500">{[record.area, record.campus, record.administrativeArea].filter(Boolean).join(' • ')}</p>
                <p className="mt-3 text-sm"><strong>{t('location.aliases')}:</strong> {(record.aliases || []).join(', ') || t('common.noneProvided')}</p>
                <p className="mt-2 break-words text-sm"><strong>{t('common.source')}:</strong> {catalog && record.sourceReference ? (
                  <a href={record.sourceReference} target="_blank" rel="noreferrer" className="text-primary-700 underline dark:text-primary-300">{t(`location.source.${record.sourceType}`, {}, record.sourceType)}</a>
                ) : <>{record.sourceType}{record.sourceReference ? ` · ${record.sourceReference}` : ''}</>}</p>
                {!catalog && <p className="mt-2 text-xs text-surface-500">
                  {t('common.version', { version: record.version })} • {t('common.submittedBy', { name: record.submittedBy?.fullName || t('common.user') })} • {t('common.updated', { date: new Date(record.updatedAt).toLocaleString(locale) })}
                </p>}
              </div>
              {!catalog && <div className="flex flex-wrap items-start gap-2 lg:max-w-md lg:justify-end">
                <button type="button" disabled={savingId === record._id} onClick={() => updateStatus(record, 'map-source-verified')} className="btn btn-outline btn-sm"><FiShield aria-hidden="true" />{t('location.mapVerified')}</button>
                <button type="button" disabled={savingId === record._id} onClick={() => updateStatus(record, 'field-verified')} className="btn btn-outline btn-sm"><FiCheckCircle aria-hidden="true" />{t('location.fieldVerified')}</button>
                <button type="button" disabled={savingId === record._id} onClick={() => updateStatus(record, 'university-approved')} className="btn btn-success btn-sm"><FiCheckCircle aria-hidden="true" />{t('location.universityApprove')}</button>
                <button type="button" disabled={savingId === record._id} onClick={() => updateStatus(record, 'archived')} className="btn btn-outline btn-sm text-red-600"><FiXCircle aria-hidden="true" />{t('common.archive')}</button>
              </div>}
            </div>
          </article>
        ))}
        {result && records.length === 0 && <div className="rounded-2xl border border-dashed border-surface-300 p-10 text-center text-surface-500 dark:border-surface-700">{t('location.noRecords')}</div>}
      </div>
      {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />}
      {catalog && result && <p className="text-xs text-surface-500"><a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>}
    </div>
  );
};

export default LocationKnowledge;
