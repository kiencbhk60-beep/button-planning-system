import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { InboxIcon, AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardRow {
  id: number;
  khsx: string | null;
  so: string | null;
  maHang: string | null;
  tenHang: string | null;
  donVi: string | null;
  soLuongKeHoach: number;
  tongBtpThuVe: number;
  tongSanLuong: number;
  sanLuongConLai: number;
  tyLeHoanThanh: number;
  deadlineCont: string | null;
  isThieuBtpAlert: boolean;
  isDeadlineAlert: boolean;
}

interface DashboardSummary {
  tongMaHang: number;
  daHoanThanh: number;
  dangSanXuat: number;
  chuaBatDau: number;
  soMaHangThieuBtp: number;
  soMaHangDeadlineAlert: number;
}

interface ApiResponse {
  success: boolean;
  summary: DashboardSummary;
  data: DashboardRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString("vi-VN");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-sm">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-2xl font-bold ${colorClass}`}>
        {formatNumber(value)}
      </span>
    </div>
  );
}

function StatusBadges({ row }: { row: DashboardRow }) {
  const isCompleted = row.sanLuongConLai <= 0 && row.soLuongKeHoach > 0;
  const badges: React.ReactNode[] = [];

  if (isCompleted) {
    badges.push(
      <Badge
        key="done"
        className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
        variant="outline"
      >
        ✓ Hoàn thành
      </Badge>,
    );
  }
  if (row.isThieuBtpAlert) {
    badges.push(
      <Badge key="btp" variant="destructive">
        Thiếu BTP
      </Badge>,
    );
  }
  if (row.isDeadlineAlert) {
    badges.push(
      <Badge
        key="deadline"
        className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"
        variant="outline"
      >
        ⚡ Gấp: Đóng Cont
      </Badge>,
    );
  }
  if (badges.length === 0) {
    badges.push(
      <Badge key="ok" variant="secondary">
        Đang sản xuất
      </Badge>,
    );
  }

  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardTable() {
  const [data, setData] = useState<DashboardRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  async function fetchDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json.data);
      setSummary(json.summary);
      setLastUpdated(
        new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi kết nối API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchDashboard();
  }, []);

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Spinner className="size-8 text-blue-600" />
        <p className="text-gray-500 text-sm">Đang tải dữ liệu dashboard…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <Empty className="max-w-sm border-red-200 bg-red-50">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangleIcon className="size-5 text-red-500" />
            </EmptyMedia>
            <EmptyTitle className="text-red-700">Lỗi kết nối</EmptyTitle>
          </EmptyHeader>
          <p className="text-sm text-red-500 text-center">{error}</p>
          <button
            onClick={() => void fetchDashboard()}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            <RefreshCwIcon className="size-4" /> Thử lại
          </button>
        </Empty>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <Empty className="max-w-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle>Chưa có dữ liệu báo cáo</EmptyTitle>
          </EmptyHeader>
          <p className="text-sm text-gray-400 text-center">
            Vui lòng import file Kế hoạch Dập Cúc để xem tiến độ tại đây.
          </p>
        </Empty>
      </div>
    );
  }

  // ── Main dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            📊 Kế hoạch Dập Cúc — Tổng hợp tiến độ
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Cập nhật lúc {lastUpdated}
          </p>
        </div>
        <button
          onClick={() => void fetchDashboard()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCwIcon className="size-3.5" /> Làm mới
        </button>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryCard
              label="Tổng mã hàng"
              value={summary.tongMaHang}
              colorClass="text-gray-800"
            />
            <SummaryCard
              label="Hoàn thành"
              value={summary.daHoanThanh}
              colorClass="text-emerald-600"
            />
            <SummaryCard
              label="Đang sản xuất"
              value={summary.dangSanXuat}
              colorClass="text-blue-600"
            />
            <SummaryCard
              label="Chưa bắt đầu"
              value={summary.chuaBatDau}
              colorClass="text-gray-400"
            />
            <SummaryCard
              label="Thiếu BTP"
              value={summary.soMaHangThieuBtp}
              colorClass="text-red-600"
            />
            <SummaryCard
              label="Deadline gấp"
              value={summary.soMaHangDeadlineAlert}
              colorClass="text-orange-600"
            />
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-red-100 border border-red-300" />
            Thiếu BTP gia công
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-orange-100 border border-orange-300" />
            Deadline Cont ≤ 3 ngày
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-gray-100 border border-gray-300" />
            Đã hoàn thành
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-700 px-4">KHSX</TableHead>
                <TableHead className="font-semibold text-gray-700">Sales Order</TableHead>
                <TableHead className="font-semibold text-gray-700">Mã hàng</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">Kế hoạch</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">BTP thu về</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">Đã dập</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">Còn lại</TableHead>
                <TableHead className="font-semibold text-gray-700 text-center">Tiến độ</TableHead>
                <TableHead className="font-semibold text-gray-700">Deadline Cont</TableHead>
                <TableHead className="font-semibold text-gray-700">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const isCompleted =
                  row.sanLuongConLai <= 0 && row.soLuongKeHoach > 0;
                const days = daysUntil(row.deadlineCont);

                const rowClass = isCompleted
                  ? "opacity-60 bg-gray-50"
                  : "";

                return (
                  <TableRow key={row.id} className={rowClass}>
                    {/* KHSX */}
                    <TableCell className="px-4 font-mono text-xs text-gray-600">
                      {row.khsx ?? "—"}
                    </TableCell>

                    {/* SO */}
                    <TableCell className="font-mono text-xs text-gray-600">
                      {row.so ?? "—"}
                    </TableCell>

                    {/* Mã hàng */}
                    <TableCell>
                      <div className="font-semibold text-gray-900 text-sm">
                        {row.maHang ?? "—"}
                      </div>
                      {row.tenHang && (
                        <div className="text-xs text-gray-400 truncate max-w-[140px]">
                          {row.tenHang}
                        </div>
                      )}
                    </TableCell>

                    {/* Kế hoạch */}
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatNumber(row.soLuongKeHoach)}
                    </TableCell>

                    {/* BTP thu về — đỏ nếu thiếu */}
                    <TableCell
                      className={`text-right text-sm tabular-nums font-medium rounded-sm ${
                        row.isThieuBtpAlert
                          ? "bg-red-50 text-red-700 font-bold"
                          : "text-gray-700"
                      }`}
                    >
                      {formatNumber(row.tongBtpThuVe)}
                      {row.isThieuBtpAlert && (
                        <div className="text-xs font-normal text-red-400">
                          cần {formatNumber(row.soLuongKeHoach)}
                        </div>
                      )}
                    </TableCell>

                    {/* Đã dập */}
                    <TableCell className="text-right text-sm tabular-nums text-gray-700">
                      {formatNumber(row.tongSanLuong)}
                    </TableCell>

                    {/* Còn lại */}
                    <TableCell className="text-right text-sm tabular-nums">
                      <span
                        className={
                          row.sanLuongConLai > 0
                            ? "text-gray-900 font-medium"
                            : "text-emerald-600 font-medium"
                        }
                      >
                        {row.sanLuongConLai > 0
                          ? formatNumber(row.sanLuongConLai)
                          : "✓ 0"}
                      </span>
                    </TableCell>

                    {/* Tiến độ bar */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1 min-w-[80px]">
                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCompleted
                                ? "bg-emerald-500"
                                : row.tyLeHoanThanh > 50
                                  ? "bg-blue-500"
                                  : "bg-blue-300"
                            }`}
                            style={{
                              width: `${Math.min(row.tyLeHoanThanh, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {row.tyLeHoanThanh}%
                        </span>
                      </div>
                    </TableCell>

                    {/* Deadline Cont — cam nếu gấp */}
                    <TableCell
                      className={`text-sm font-medium ${
                        row.isDeadlineAlert
                          ? "bg-orange-50 text-orange-700 font-bold"
                          : "text-gray-700"
                      }`}
                    >
                      {formatDate(row.deadlineCont)}
                      {days !== null && (
                        <div
                          className={`text-xs font-normal ${
                            days <= 0
                              ? "text-red-500"
                              : days <= 3
                                ? "text-orange-500"
                                : "text-gray-400"
                          }`}
                        >
                          {days <= 0
                            ? `Đã qua ${Math.abs(days)} ngày`
                            : `còn ${days} ngày`}
                        </div>
                      )}
                    </TableCell>

                    {/* Trạng thái */}
                    <TableCell>
                      <StatusBadges row={row} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-gray-400 text-right">
          {data.length} mã hàng · Dữ liệu từ hệ thống Kế hoạch Dập Cúc v1
        </p>
      </div>
    </div>
  );
}
