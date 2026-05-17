export type DeviceKind = "serial" | "usb" | "hid"

export interface ConnectedDevice {
  kind: DeviceKind
  label: string
  id: string
}

let serialPort: SerialPort | null = null

export async function connectSerialDevice(): Promise<ConnectedDevice | null> {
  if (!("serial" in navigator)) return null
  try {
    serialPort = await navigator.serial.requestPort()
    await serialPort.open({ baudRate: 9600 })
    return {
      kind: "serial",
      label: "Serial device",
      id: "serial-0",
    }
  } catch {
    return null
  }
}

export async function readSerialLine(): Promise<string | null> {
  if (!serialPort?.readable) return null
  const reader = serialPort.readable.getReader()
  try {
    const { value } = await reader.read()
    if (!value) return null
    return new TextDecoder().decode(value).trim()
  } finally {
    reader.releaseLock()
  }
}

export async function connectUsbDevice(): Promise<ConnectedDevice | null> {
  if (!("usb" in navigator)) return null
  try {
    const device = await navigator.usb.requestDevice({ filters: [] })
    await device.open()
    return {
      kind: "usb",
      label: device.productName || "USB device",
      id: `usb-${device.vendorId}-${device.productId}`,
    }
  } catch {
    return null
  }
}

export async function connectHidDevice(): Promise<ConnectedDevice | null> {
  if (!("hid" in navigator)) return null
  try {
    const devices = await navigator.hid.requestDevice({ filters: [] })
    const device = devices[0]
    if (!device) return null
    await device.open()
    return {
      kind: "hid",
      label: device.productName || "HID device",
      id: `hid-${device.vendorId}-${device.productId}`,
    }
  } catch {
    return null
  }
}

export async function disconnectSerial(): Promise<void> {
  if (serialPort) {
    try {
      await serialPort.close()
    } catch {
      /* ignore */
    }
    serialPort = null
  }
}
