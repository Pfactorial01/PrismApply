import { useState } from 'react'
import { uploadResume, type ResumeUploadResult } from '../../lib/resumeApi'

type Props = {
  onComplete: (result: ResumeUploadResult) => void
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = (content.items as Array<{ str?: string }>).map((item) => item.str ?? '').join(' ')
    pages.push(text)
  }
  return pages.join('\n\n')
}

export function ResumeUpload({ onComplete }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(f: File) {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file')
      return
    }
    setError(null)
    setFile(f)
    setParsing(true)
    try {
      const text = await extractPdfText(f)
      if (!text.trim()) {
        setError(
          'Could not extract text from this PDF. The file may be scanned or image-based.',
        )
        setParsing(false)
        return
      }
      setParsing(false)
      setUploading(true)
      const result = await uploadResume(f, text)
      onComplete(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process resume')
      setParsing(false)
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) void handleFile(f)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
  }

  const busy = parsing || uploading

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Upload your resume
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          We will analyze your resume with AI and prefill your profile so you can start
          applying faster.
        </p>
      </div>

      <div
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-12 transition-all duration-200 ${
          dragOver
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
            : 'border-[var(--color-border)] hover:border-[var(--color-text-tertiary)] bg-[var(--color-surface-elevated)]'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('resume-file-input')?.click()}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-text-primary)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {parsing ? 'Reading PDF\u2026' : 'Uploading and analyzing\u2026'}
            </span>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <svg
              className="h-8 w-8 text-[var(--color-accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {file.name}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {(file.size / 1024).toFixed(0)} KB
            </span>
            <button
              type="button"
              className="mt-1 text-sm text-[var(--color-danger)] underline underline-offset-2 transition-colors duration-150 hover:text-[var(--color-danger)]/80"
              onClick={(e) => {
                e.stopPropagation()
                setFile(null)
                setError(null)
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <svg
              className="mb-4 h-10 w-10 text-[var(--color-text-tertiary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              Drop your resume PDF here, or click to browse
            </span>
          </>
        )}
        <input
          id="resume-file-input"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
        Your PDF will be stored securely and analyzed by AI to extract your experience, skills,
        and career history. You can review and edit everything before submitting applications.
      </p>
    </div>
  )
}
