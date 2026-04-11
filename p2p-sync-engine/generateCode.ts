/** Generate a random 6-digit numeric code for peer sync */
export function generateSyncCode(): string {
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  // Prefix with "opr-" to avoid collisions on the public PeerJS server
  return `opr-${digits}`;
}

/** Extract the display code (6 digits) from a full peer ID */
export function displayCode(peerId: string): string {
  return peerId.replace(/^opr-/, "");
}

/** Convert a 6-digit user input back to a full peer ID */
export function toPeerId(code: string): string {
  return `opr-${code}`;
}
