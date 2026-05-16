"use client"

import { detectContentType } from "@/lib/detect-content-type"
import {
  buildKnowledgeDocumentFromFile,
  findKnowledgeMatches,
  type KnowledgeDocument,
  type KnowledgeMatch,
} from "@/lib/knowledge-base"
import type { ContentType } from "@/lib/content-types"

type RequestMessage =
  | { id: string; type: "detect-content-type"; text: string }
  | { id: string; type: "find-knowledge-matches"; noteText: string; documents: KnowledgeDocument[]; limit: number }
  | { id: string; type: "build-knowledge-documents"; files: File[] }

type SuccessResponse =
  | { id: string; ok: true; type: "detect-content-type"; result: ContentType }
  | { id: string; ok: true; type: "find-knowledge-matches"; result: KnowledgeMatch[] }
  | { id: string; ok: true; type: "build-knowledge-documents"; result: KnowledgeDocument[] }

type ErrorResponse = { id: string; ok: false; error: string }

type ResponseMessage = SuccessResponse | ErrorResponse

let workerInstance: Worker | null = null
let requestSeq = 0

function canUseWorker(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined"
}

function getWorker(): Worker | null {
  if (!canUseWorker()) return null
  if (!workerInstance) {
    workerInstance = new Worker(new URL("./workers/nodepad.worker.ts", import.meta.url))
  }
  return workerInstance
}

function callWorker<T>(message: RequestMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    if (!worker) {
      reject(new Error("Web Worker is not available"))
      return
    }

    const onMessage = (event: MessageEvent<ResponseMessage>) => {
      const response = event.data
      if (!response || response.id !== message.id) return

      worker.removeEventListener("message", onMessage)
      worker.removeEventListener("error", onError)

      if (!response.ok) {
        reject(new Error(response.error))
        return
      }

      resolve(response.result as T)
    }

    const onError = (event: ErrorEvent) => {
      worker.removeEventListener("message", onMessage)
      worker.removeEventListener("error", onError)
      reject(new Error(event.message || "Worker execution failed"))
    }

    worker.addEventListener("message", onMessage)
    worker.addEventListener("error", onError)
    worker.postMessage(message)
  })
}

function nextRequestId(): string {
  requestSeq += 1
  return `nodepad-worker-${requestSeq}`
}

export async function detectContentTypeInWorker(text: string): Promise<ContentType> {
  const id = nextRequestId()
  try {
    return await callWorker<ContentType>({ id, type: "detect-content-type", text })
  } catch {
    return detectContentType(text)
  }
}

export async function findKnowledgeMatchesInWorker(
  noteText: string,
  documents: KnowledgeDocument[],
  limit = 4,
): Promise<KnowledgeMatch[]> {
  if (!noteText.trim() || documents.length === 0) return []

  const id = nextRequestId()
  try {
    return await callWorker<KnowledgeMatch[]>({ id, type: "find-knowledge-matches", noteText, documents, limit })
  } catch {
    return findKnowledgeMatches(noteText, documents, limit)
  }
}

export async function buildKnowledgeDocumentsFromFilesInWorker(files: File[]): Promise<KnowledgeDocument[]> {
  if (files.length === 0) return []

  const id = nextRequestId()
  try {
    return await callWorker<KnowledgeDocument[]>({ id, type: "build-knowledge-documents", files })
  } catch {
    return Promise.all(files.map(file => buildKnowledgeDocumentFromFile(file)))
  }
}
