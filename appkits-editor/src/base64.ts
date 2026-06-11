const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function textToBase64(value: string): string {
  const bytes = textEncoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToText(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return textDecoder.decode(bytes);
}
