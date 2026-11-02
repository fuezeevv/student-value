import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { visibleMaterialFile } from "@/server/domain/material-files";
import { FileDownload } from "@/components/workspace/FileDownload";
export default async function MaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCurrentUser();
  const file = await visibleMaterialFile(user, (await params).id);
  if (!file) notFound();
  return (
    <div className="max-w-3xl space-y-7">
      <Link
        className="text-link"
        href={`/courses/${file.material.courseOfferingId}?tab=materials`}
      >
        ← К материалам предмета
      </Link>
      <h1 className="page-title">{file.material.title}</h1>
      <p className="text-slate-300 break-words">
        {file.filename} · {(file.byteSize / 1024 / 1024).toFixed(1)} МБ
      </p>
      <FileDownload
        id={file.materialId}
        filename={file.filename}
        byteSize={file.byteSize}
        sha256={file.sha256}
      />
      <p className="text-sm text-slate-400 whitespace-pre-wrap">
        {file.material.sourceNote}
      </p>
      <details className="text-xs text-slate-500 break-all">
        <summary>Проверка оригинала</summary>
        <p className="mt-3">SHA-256: {file.sha256}</p>
      </details>
    </div>
  );
}
