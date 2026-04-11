# P2P Device Sync Engine  -  WebRTC State Machine with Retry Logic

## Problem

Users build resumes on desktop but need them on their phone for interviews. The app is fully offline (IndexedDB, no accounts), so there's no server to sync through. Need a way to transfer all data between devices directly  -  no cloud, no login, no data touching any server.

## Solution

A WebRTC-based peer-to-peer sync system using PeerJS for signaling. One device generates a 6-digit code (or QR code), the other enters it, and data transfers directly between browsers.

### Core Hook (`usePeerSync.ts`)

A React hook that manages the full WebRTC lifecycle as a state machine with 8 states:

- **idle → initializing → waiting** (sender creates peer, waits for connection)
- **idle → initializing → connecting → receiving → success** (receiver connects to sender)
- **error** (any state can transition here with a descriptive message)

Key behaviors:

- **Auto-retry on ID collision**  -  PeerJS cloud server can reject IDs; the hook retries up to 3 times with a new code
- **Connection timeout**  -  15s timeout on the receiver side with cleanup
- **Auto-reconnect**  -  if the signaling server disconnects mid-session, it reconnects automatically
- **Ref-based status tracking**  -  event handlers see current status via `useRef` to avoid stale closures
- **Clean teardown**  -  all peers, connections, and timeouts are cleaned up on unmount

### Code Generation (`generateCode.ts`)

Generates 6-digit numeric codes prefixed with `opr-` to avoid collisions on the shared PeerJS cloud server. Display functions strip the prefix for the user-facing UI.

## Key Design Decisions

- **PeerJS over raw WebRTC**  -  handles STUN/TURN negotiation and signaling. We only need data channels, not media.
- **Google STUN servers**  -  free, reliable, no dependency on a paid TURN service. Works for the data sizes we transfer (~100KB JSON).
- **State machine in a hook**  -  all 8 states are explicit, making the UI layer trivial (just switch on `status`).
- **Retry with new code**  -  instead of failing on ID collision, silently retry. The user never sees it.
- **`statusRef` pattern**  -  event handlers from PeerJS fire asynchronously; a ref keeps them in sync with current React state.

## Concepts Demonstrated

- WebRTC peer-to-peer data channels
- State machine design in React hooks
- Connection lifecycle management (timeout, retry, reconnect, teardown)
- Stale closure prevention with refs
- Zero-server data transfer architecture
