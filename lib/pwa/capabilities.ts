export type PwaCapabilityId =
  | "serviceWorker"
  | "notifications"
  | "badging"
  | "share"
  | "shareTarget"
  | "fileSystemAccess"
  | "opfs"
  | "webAuthn"
  | "webSerial"
  | "webUsb"
  | "webHid"
  | "webGpu"
  | "webNn"
  | "windowControlsOverlay"
  | "backgroundSync"
  | "periodicSync"
  | "summarizer"

export interface PwaCapability {
  id: PwaCapabilityId
  label: string
  description: string
  supported: boolean
}

function has(prop: string, obj: object = globalThis as object): boolean {
  return prop in obj
}

export function detectPwaCapabilities(): PwaCapability[] {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator)
  const win = typeof window !== "undefined" ? window : ({} as Window & { Summarizer?: unknown })

  return [
    {
      id: "serviceWorker",
      label: "Service worker",
      description: "Offline shell, push, and background sync",
      supported: "serviceWorker" in nav,
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Deadline and timer alerts",
      supported: "Notification" in win,
    },
    {
      id: "badging",
      label: "App icon badges",
      description: "Pending task count on the installed icon",
      supported: "setAppBadge" in nav,
    },
    {
      id: "share",
      label: "Web Share",
      description: "Share notes to other apps",
      supported: "share" in nav,
    },
    {
      id: "shareTarget",
      label: "Share into nodepad",
      description: "Receive links and text from other apps",
      supported: true,
    },
    {
      id: "fileSystemAccess",
      label: "File System Access",
      description: "Open and save .nodepad files on disk",
      supported: "showOpenFilePicker" in win,
    },
    {
      id: "opfs",
      label: "Origin Private FS",
      description: "Fast on-device workspace mirror",
      supported: "storage" in nav && "getDirectory" in (nav.storage ?? {}),
    },
    {
      id: "webAuthn",
      label: "Biometric lock",
      description: "Face ID / Touch ID workspace unlock",
      supported: "credentials" in nav && "PublicKeyCredential" in win,
    },
    {
      id: "webSerial",
      label: "Web Serial",
      description: "Barcode scanners and serial devices",
      supported: "serial" in nav,
    },
    {
      id: "webUsb",
      label: "WebUSB",
      description: "USB accessories and dongles",
      supported: "usb" in nav,
    },
    {
      id: "webHid",
      label: "WebHID",
      description: "Gamepads and HID peripherals",
      supported: "hid" in nav,
    },
    {
      id: "webGpu",
      label: "WebGPU",
      description: "GPU-accelerated graph rendering",
      supported: "gpu" in nav,
    },
    {
      id: "webNn",
      label: "WebNN",
      description: "On-device neural network inference",
      supported: "ml" in nav,
    },
    {
      id: "windowControlsOverlay",
      label: "Window controls overlay",
      description: "Custom title bar when installed on desktop",
      supported: "windowControlsOverlay" in nav,
    },
    {
      id: "backgroundSync",
      label: "Background sync",
      description: "Flush workspace when back online",
      supported: "serviceWorker" in nav && "SyncManager" in win,
    },
    {
      id: "periodicSync",
      label: "Periodic sync",
      description: "Scheduled edge refresh",
      supported: "serviceWorker" in nav && "periodicSync" in (win as Window & { periodicSync?: unknown }),
    },
    {
      id: "summarizer",
      label: "On-device summarizer",
      description: "Browser-native text summarization",
      supported: "Summarizer" in win,
    },
  ]
}

export function isCapabilitySupported(id: PwaCapabilityId): boolean {
  return detectPwaCapabilities().find((c) => c.id === id)?.supported ?? false
}
