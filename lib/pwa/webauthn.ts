const CRED_KEY = "nodepad-webauthn-credential"

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function hasStoredWebAuthnCredential(): boolean {
  try {
    return Boolean(localStorage.getItem(CRED_KEY))
  } catch {
    return false
  }
}

export async function registerBiometricLock(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "nodepad", id: location.hostname },
      user: {
        id: userId,
        name: "nodepad-user",
        displayName: "nodepad workspace",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!credential) return false
  const response = credential.response as AuthenticatorAttestationResponse
  localStorage.setItem(
    CRED_KEY,
    JSON.stringify({
      id: bufferToBase64(credential.rawId),
      publicKey: bufferToBase64(response.getPublicKey?.() ?? new ArrayBuffer(0)),
    }),
  )
  return true
}

export async function verifyBiometricLock(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  const stored = localStorage.getItem(CRED_KEY)
  if (!stored) return true

  let parsed: { id: string }
  try {
    parsed = JSON.parse(stored)
  } catch {
    return false
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: base64ToBuffer(parsed.id),
          type: "public-key",
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  })
  return Boolean(assertion)
}

export function clearBiometricLock() {
  localStorage.removeItem(CRED_KEY)
}
