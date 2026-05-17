"use client"

import { useCallback, useEffect, useState } from "react"
import { detectPwaCapabilities, type PwaCapability } from "@/lib/pwa/capabilities"
import { pickNodepadFile, saveToLinkedFile, pickSaveNodepadFile } from "@/lib/pwa/file-system"
import { getOpfsUsage, readWorkspaceFromOpfs, writeWorkspaceToOpfs } from "@/lib/pwa/opfs"
import {
  clearBiometricLock,
  hasStoredWebAuthnCredential,
  registerBiometricLock,
  verifyBiometricLock,
} from "@/lib/pwa/webauthn"
import {
  connectHidDevice,
  connectSerialDevice,
  connectUsbDevice,
  disconnectSerial,
  readSerialLine,
} from "@/lib/pwa/devices"
import { isWebGpuAvailable, summarizeOnDevice } from "@/lib/pwa/on-device-ai"
import { registerBackgroundSync, registerPeriodicSync } from "@/lib/pwa/edge-sync"
import { shareFromApp } from "@/lib/pwa/share"

interface PwaFeaturesPanelProps {
  workspaceJson?: string
  onImportFile?: (file: File) => void
  onSerialCapture?: (text: string) => void
  onOfflineSummary?: (summary: string) => void
}

export function PwaFeaturesPanel({
  workspaceJson,
  onImportFile,
  onSerialCapture,
  onOfflineSummary,
}: PwaFeaturesPanelProps) {
  const [caps, setCaps] = useState<PwaCapability[]>([])
  const [opfs, setOpfs] = useState<{ used: number; quota: number } | null>(null)
  const [webGpu, setWebGpu] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [locked, setLocked] = useState(hasStoredWebAuthnCredential())

  useEffect(() => {
    setCaps(detectPwaCapabilities())
    getOpfsUsage().then(setOpfs)
    isWebGpuAvailable().then(setWebGpu)
  }, [])

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    window.setTimeout(() => setStatus(null), 3500)
  }, [])

  const cap = (id: string) => caps.find((c) => c.id === id)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          PWA platform APIs
        </label>
        <p className="font-mono text-[9px] text-muted-foreground leading-relaxed mt-1">
          Hardware, on-device AI, OS integration, and resilient storage. Availability depends on your browser and install mode.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {caps.map((c) => (
          <div
            key={c.id}
            title={c.description}
            className={`rounded border px-2 py-1.5 font-mono text-[8px] uppercase tracking-wide ${
              c.supported
                ? "border-primary/25 bg-primary/5 text-primary"
                : "border-border/50 bg-muted/20 text-muted-foreground/40"
            }`}
          >
            {c.label}
          </div>
        ))}
      </div>

      {opfs && (
        <p className="font-mono text-[8px] text-muted-foreground">
          OPFS: {(opfs.used / 1024 / 1024).toFixed(1)} MB / {(opfs.quota / 1024 / 1024).toFixed(0)} MB
          {webGpu ? " · WebGPU ready" : ""}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <PwaAction
          label="Open .nodepad from disk"
          disabled={!cap("fileSystemAccess")?.supported}
          onClick={async () => {
            const file = await pickNodepadFile()
            if (file && onImportFile) {
              onImportFile(file)
              flash("Opened linked file")
            }
          }}
        />
        <PwaAction
          label="Save workspace to linked file"
          disabled={!cap("fileSystemAccess")?.supported || !workspaceJson}
          onClick={async () => {
            if (!workspaceJson) return
            const ok = await saveToLinkedFile(workspaceJson)
            flash(ok ? "Saved to disk" : "Link a file first (Open)")
          }}
        />
        <PwaAction
          label="Mirror workspace to OPFS"
          disabled={!cap("opfs")?.supported || !workspaceJson}
          onClick={async () => {
            if (!workspaceJson) return
            const ok = await writeWorkspaceToOpfs(JSON.parse(workspaceJson))
            flash(ok ? "OPFS mirror updated" : "OPFS write failed")
          }}
        />
        <PwaAction
          label="Restore from OPFS mirror"
          disabled={!cap("opfs")?.supported}
          onClick={async () => {
            const data = await readWorkspaceFromOpfs()
            flash(data ? "OPFS snapshot found (import via .nodepad)" : "No OPFS snapshot")
          }}
        />
        <PwaAction
          label={locked ? "Unlock with biometrics" : "Enable biometric lock"}
          disabled={!cap("webAuthn")?.supported}
          onClick={async () => {
            if (locked) {
              const ok = await verifyBiometricLock()
              if (ok) {
                setLocked(false)
                flash("Unlocked")
              }
            } else {
              const ok = await registerBiometricLock()
              if (ok) {
                setLocked(true)
                flash("Biometric lock enabled")
              }
            }
          }}
        />
        {locked && (
          <PwaAction
            label="Remove biometric lock"
            onClick={() => {
              clearBiometricLock()
              setLocked(false)
              flash("Lock removed")
            }}
          />
        )}
        <PwaAction
          label="Connect serial scanner"
          disabled={!cap("webSerial")?.supported}
          onClick={async () => {
            const dev = await connectSerialDevice()
            if (!dev) return
            const line = await readSerialLine()
            if (line && onSerialCapture) onSerialCapture(line)
            flash(line ? `Captured: ${line.slice(0, 40)}` : "Serial connected")
          }}
        />
        <PwaAction
          label="Connect USB device"
          disabled={!cap("webUsb")?.supported}
          onClick={async () => {
            const dev = await connectUsbDevice()
            flash(dev ? `USB: ${dev.label}` : "No device selected")
          }}
        />
        <PwaAction
          label="Connect HID device"
          disabled={!cap("webHid")?.supported}
          onClick={async () => {
            const dev = await connectHidDevice()
            flash(dev ? `HID: ${dev.label}` : "No device selected")
          }}
        />
        <PwaAction
          label="Summarize selection offline"
          disabled={!workspaceJson}
          onClick={async () => {
            const parsed = JSON.parse(workspaceJson || "{}") as {
              projects?: { blocks?: { text?: string }[] }[]
            }
            const text = parsed.projects?.[0]?.blocks?.map((b) => b.text).filter(Boolean).join("\n") ?? ""
            const result = await summarizeOnDevice(text)
            if (result && onOfflineSummary) {
              onOfflineSummary(result.summary)
              flash(`Summary (${result.engine})`)
            }
          }}
        />
        <PwaAction
          label="Share workspace"
          disabled={!cap("share")?.supported}
          onClick={async () => {
            const ok = await shareFromApp({
              title: "nodepad workspace",
              text: "Exported from nodepad",
            })
            flash(ok ? "Share sheet opened" : "Share cancelled")
          }}
        />
        <PwaAction
          label="Register background sync"
          disabled={!cap("backgroundSync")?.supported}
          onClick={async () => {
            await registerBackgroundSync()
            await registerPeriodicSync()
            flash("Background sync registered")
          }}
        />
        <PwaAction
          label="Disconnect serial"
          onClick={async () => {
            await disconnectSerial()
            flash("Serial disconnected")
          }}
        />
      </div>

      {status && (
        <p className="font-mono text-[9px] text-primary leading-relaxed">{status}</p>
      )}
    </div>
  )
}

function PwaAction({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-left font-mono text-[9px] text-foreground hover:bg-secondary/70 disabled:opacity-35 transition-colors"
    >
      {label}
    </button>
  )
}
