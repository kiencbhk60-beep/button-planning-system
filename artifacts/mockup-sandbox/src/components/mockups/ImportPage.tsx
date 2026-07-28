import { useState, useRef, useCallback } from "react";
import { toast, Toaster } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  UploadCloudIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  XCircleIcon,
  RotateCcwIcon,
  DatabaseIcon,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const FILE_TYPE_OPTIONS = [
  { value: "KE_HOACH",    label: "📋 Kế hoạch Dập Cúc (File chính)" },
  { value: "SAP_EXPORT",  label: "🏭 SAP Export (BTP)" },
  { value: "SAN_LUONG",   label: "📊 Sản lượng Nhà máy" },
  { value: "LICH_CONT",   label: "🚢 Lịch Đóng Cont" },
  { value: "HTQLKHCL",    label: "✅ HTQLKHCL (Chất lượng)" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadResult {
  sessionId: number;
  detectedType: string;
  fileName: string;
  fileSizeKb: number;
  rowCount: number;
  previewData: Record<string, unknown>[];
}

type Phase = "idle" | "uploading" | "preview" | "confirming" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`size-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors ${
          done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : active
              ? "bg-blue-600 border-blue-600 text-white"
              : "bg-white border-gray-200 text-gray-400"
        }`}
      >
        {done ? <CheckCircle2Icon className="size-4" /> : null}
      </div>
      <span className={`text-xs ${active || done ? "text-gray-700 font-medium" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportPage() {
  // State
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileType, setFileType] = useState<string>("KE_HOACH");
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [confirmedCount, setConfirmedCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload logic ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Validate extension
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Chỉ chấp nhận file .xlsx hoặc .xls");
      return;
    }

    setPhase("uploading");
    setUploadResult(null);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_type", fileType);
    formData.append("header_row", String(headerRow));

    try {
      const res = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json() as { success: boolean; data?: UploadResult; error?: string };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setUploadResult(json.data!);
      setPhase("preview");
      toast.success(`Đọc file thành công: ${json.data!.rowCount} dòng hợp lệ`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối server";
      setErrorMsg(msg);
      setPhase("error");
      toast.error(`Upload thất bại: ${msg}`);
    }
  }, [fileType, headerRow]);

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  }, [handleUpload]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    // Reset input để cho phép upload lại cùng tên file
    e.target.value = "";
  };

  // ── Confirm logic ────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!uploadResult) return;
    setPhase("confirming");

    try {
      const res = await fetch(`/api/import/${uploadResult.sessionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json() as {
        success: boolean;
        data?: { insertedCount: number; message: string };
        error?: string;
        detail?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setConfirmedCount(json.data!.insertedCount);
      setPhase("done");
      toast.success(json.data!.message, { duration: 5000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi server";
      setErrorMsg(msg);
      setPhase("error");
      toast.error(`Xác nhận thất bại: ${msg}`, { duration: 6000 });
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setPhase("idle");
    setUploadResult(null);
    setErrorMsg("");
    setConfirmedCount(0);
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const isUploading  = phase === "uploading";
  const isConfirming = phase === "confirming";
  const isDone       = phase === "done";
  const isError      = phase === "error";
  const hasPreview   = phase === "preview" || phase === "confirming" || phase === "done";

  const previewCols = uploadResult?.previewData[0]
    ? Object.keys(uploadResult.previewData[0])
    : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast container — bỏ qua next-themes, dùng light mode cố định */}
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">📥 Import Dữ Liệu</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload file Excel → Xem trước → Xác nhận lưu vào hệ thống
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          <StepDot active={!hasPreview && !isDone} done={hasPreview || isDone} label="1. Upload" />
          <div className={`flex-1 h-0.5 mx-2 rounded ${hasPreview || isDone ? "bg-emerald-400" : "bg-gray-200"}`} />
          <StepDot active={hasPreview && !isDone} done={isDone} label="2. Xem trước" />
          <div className={`flex-1 h-0.5 mx-2 rounded ${isDone ? "bg-emerald-400" : "bg-gray-200"}`} />
          <StepDot active={isDone} done={false} label="3. Xác nhận" />
        </div>

        {/* ── DONE state ─────────────────────────────────────────────────── */}
        {isDone && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2Icon className="size-14 text-emerald-500" />
              <div>
                <p className="text-lg font-bold text-emerald-800">Import thành công!</p>
                <p className="text-sm text-emerald-700 mt-1">
                  <span className="font-semibold">{confirmedCount} dòng</span> đã được ghi vào hệ thống từ file{" "}
                  <span className="font-mono">{uploadResult?.fileName}</span>
                </p>
              </div>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <RotateCcwIcon className="size-4" /> Import file tiếp theo
              </button>
            </CardContent>
          </Card>
        )}

        {/* ── ZONE 1: Cấu hình + Upload ──────────────────────────────────── */}
        {!isDone && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Cấu hình & Chọn file</CardTitle>
              <CardDescription>Chọn loại file trước, sau đó kéo thả hoặc bấm chọn file Excel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Row: Type + Header row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Loại file <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={fileType}
                    onValueChange={setFileType}
                    disabled={isUploading || hasPreview}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại file..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-48 space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Dòng tiêu đề (Header Row)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={headerRow}
                      onChange={(e) => setHeaderRow(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={isUploading || hasPreview}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    File SAP thường dùng dòng 3–5
                  </p>
                </div>
              </div>

              {/* Drag & Drop zone */}
              {!hasPreview && (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`
                    relative flex flex-col items-center justify-center gap-3
                    rounded-xl border-2 border-dashed p-10 text-center cursor-pointer
                    transition-all duration-200
                    ${dragOver
                      ? "border-blue-500 bg-blue-50 scale-[1.01]"
                      : "border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
                    }
                    ${isUploading ? "pointer-events-none opacity-60" : ""}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={onFileChange}
                  />

                  {isUploading ? (
                    <>
                      <Spinner className="size-10 text-blue-500" />
                      <p className="text-sm font-medium text-blue-700">Đang đọc file Excel...</p>
                      <p className="text-xs text-blue-500">Vui lòng chờ</p>
                    </>
                  ) : (
                    <>
                      <UploadCloudIcon
                        className={`size-12 transition-colors ${dragOver ? "text-blue-500" : "text-gray-300"}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          Kéo thả file vào đây
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          hoặc{" "}
                          <span className="text-blue-600 underline underline-offset-2">
                            bấm để chọn file
                          </span>
                          {" "}· Hỗ trợ .xlsx, .xls · Tối đa 50 MB
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* File info + change button khi đã upload */}
              {hasPreview && uploadResult && (
                <div className="flex items-center justify-between rounded-lg border bg-blue-50 border-blue-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheetIcon className="size-6 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {uploadResult.fileName}
                      </p>
                      <p className="text-xs text-blue-600">
                        {formatSize(uploadResult.fileSizeKb)} · {uploadResult.rowCount} dòng hợp lệ ·{" "}
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]" variant="outline">
                          {uploadResult.detectedType}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  {phase === "preview" && (
                    <button
                      onClick={handleReset}
                      className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                      <RotateCcwIcon className="size-3" /> Tải file khác
                    </button>
                  )}
                </div>
              )}

              {/* Error state */}
              {isError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <XCircleIcon className="size-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800">Đã xảy ra lỗi</p>
                    <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs text-red-700 underline hover:text-red-900"
                  >
                    Thử lại
                  </button>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* ── ZONE 2: Preview Table ──────────────────────────────────────── */}
        {hasPreview && uploadResult && uploadResult.previewData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Xem trước dữ liệu</CardTitle>
                  <CardDescription className="mt-0.5">
                    5 dòng đầu tiên — kiểm tra các cột đã nhận diện đúng chưa
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {previewCols.length} cột được đọc
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-64 rounded-b-xl">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-50 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-gray-500 w-10 px-3">#</TableHead>
                      {previewCols.map((col) => (
                        <TableHead key={col} className="text-xs font-semibold text-gray-700 whitespace-nowrap px-3">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResult.previewData.map((row, i) => (
                      <TableRow key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <TableCell className="text-xs text-gray-400 font-mono px-3">{i + 1}</TableCell>
                        {previewCols.map((col) => (
                          <TableCell key={col} className="text-xs text-gray-700 whitespace-nowrap max-w-[160px] truncate px-3">
                            {row[col] instanceof Date
                              ? (row[col] as Date).toLocaleDateString("vi-VN")
                              : row[col] != null
                                ? String(row[col])
                                : <span className="text-gray-300 italic">—</span>
                            }
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {uploadResult.rowCount > 5 && (
                <p className="text-center text-xs text-gray-400 py-2 border-t">
                  ... và {uploadResult.rowCount - 5} dòng tiếp theo (tổng {uploadResult.rowCount} dòng)
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── ZONE 3: Action Buttons ─────────────────────────────────────── */}
        {phase === "preview" && uploadResult && (
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={handleReset}
              disabled={isConfirming}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RotateCcwIcon className="size-4" />
              Hủy / Tải file khác
            </button>

            <button
              onClick={() => void handleConfirm()}
              disabled={isConfirming}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm"
            >
              {isConfirming ? (
                <>
                  <Spinner className="size-4 text-white" />
                  Đang lưu vào Database...
                </>
              ) : (
                <>
                  <DatabaseIcon className="size-4" />
                  Xác nhận & Lưu Database
                </>
              )}
            </button>
          </div>
        )}

        {phase === "confirming" && (
          <div className="flex items-center justify-center gap-3 rounded-lg border bg-blue-50 border-blue-200 px-4 py-4">
            <Spinner className="size-5 text-blue-600" />
            <p className="text-sm text-blue-700 font-medium">
              Đang ghi {uploadResult?.rowCount} dòng vào hệ thống...
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
