import React, { useMemo, useState } from 'react';
import { Activity, Search } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/common/UIPrimitives';
import { useAppData } from '../context/AppDataContext';
import { formatTimestampID } from '../utils/formatters';

export const ActivityLogPage: React.FC = () => {
  const { activityLogs } = useAppData();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  const entities = useMemo(
    () => Array.from(new Set(activityLogs.map((a) => a.entityType))).sort(),
    [activityLogs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activityLogs.filter((log) => {
      if (entityFilter !== 'all' && log.entityType !== entityFilter) return false;
      if (!q) return true;
      return `${log.action} ${log.summary} ${log.actorName} ${log.entityType}`
        .toLowerCase()
        .includes(q);
    });
  }, [activityLogs, search, entityFilter]);

  return (
    <div>
      <PageHeader
        title="Activity Log & Audit Trail"
        subtitle="Catatan kronologis seluruh perubahan penting pada pelanggan, quotation, order, purchase order, produksi, pemasangan, dan pembayaran."
      />

      <div className="bg-white border border-[#E5E2DA] rounded-xl p-4 mb-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7D8580] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aktivitas, nomor order, atau pelaku perubahan..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E2DA] bg-[#F8F7F4] text-sm outline-none focus:border-[#1F3D2B]"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E2DA] bg-white text-sm"
        >
          <option value="all">Semua Modul ({activityLogs.length})</option>
          {entities.map((en) => (
            <option key={en} value={en} className="capitalize">{en}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-5 h-5" />}
          title="Belum ada log aktivitas"
          description="Setiap kali Anda membuat pelanggan, quotation, order, PO, atau mencatat pembayaran, sistem otomatis merekam jejak audit di sini."
        />
      ) : (
        <div className="bg-white border border-[#E5E2DA] rounded-xl divide-y divide-[#E5E2DA]">
          {filtered.map((log) => (
            <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#5A635D]">
                  <span className="font-semibold text-[#1F3D2B]">{log.action}</span>
                  <span>·</span>
                  <span className="capitalize">{log.entityType}</span>
                </div>
                <p className="text-sm text-[#1F2421] mt-0.5">{log.summary}</p>
              </div>
              <div className="text-xs text-[#5A635D] sm:text-right shrink-0">
                <p className="font-medium text-[#1F2421]">{log.actorName}</p>
                <p className="font-mono text-[11px]">{formatTimestampID(log.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
