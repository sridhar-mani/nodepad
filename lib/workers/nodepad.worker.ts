/// <reference lib="webworker" />

import { detectContentType } from "../detect-content-type"
import {
  buildKnowledgeDocumentFromFile,
  findKnowledgeMatches,
  type KnowledgeDocument,
  type KnowledgeMatch,
} from "../knowledge-base"
import type { ContentType } from "../content-types"

type RequestMessage =
  | { id: string; type: "detect-content-type"; text: string }
  | { id: string; type: "find-knowledge-matches"; noteText: string; documents: KnowledgeDocument[]; limit: number }
  | { id: string; type: "build-knowledge-documents"; files: File[] }

type ResponseMessage =
  | { id: string; ok: true; type: "detect-content-type"; result: ContentType }
  | { id: string; ok: true; type: "find-knowledge-matches"; result: KnowledgeMatch[] }
  | { id: string; ok: true; type: "build-knowledge-documents"; result: KnowledgeDocument[] }
  | { id: string; ok: false; error: string }

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = async (event: MessageEvent<RequestMessage>) => {
  const message = event.data

  try {
    if (message.type === "detect-content-type") {
      const result = detectContentType(message.text)
      const response: ResponseMessage = { id: message.id, ok: true, type: "detect-content-type", result }
      workerScope.postMessage(response)
      return
    }

    if (message.type === "find-knowledge-matches") {
      const result = findKnowledgeMatches(message.noteText, message.documents, message.limit)
      const response: ResponseMessage = { id: message.id, ok: true, type: "find-knowledge-matches", result }
      workerScope.postMessage(response)
      return
    }

    if (message.type === "build-knowledge-documents") {
      const result = await Promise.all(message.files.map(file => buildKnowledgeDocumentFromFile(file)))
      const response: ResponseMessage = { id: message.id, ok: true, type: "build-knowledge-documents", result }
      workerScope.postMessage(response)
      return
    }

    const exhaustiveTypeCheck: never = message
    throw new Error(`Unknown worker message: ${JSON.stringify(exhaustiveTypeCheck)}`)
  } catch (error) {
    const response: ResponseMessage = {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : "Worker execution failed",
    }
    workerScope.postMessage(response)
  }
}

export {}
