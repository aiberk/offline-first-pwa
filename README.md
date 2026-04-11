# Offline-First PWA

> **Origin:** Selected code from shipped production software

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc&logoColor=white)
![IndexedDB](https://img.shields.io/badge/IndexedDB-4285F4?style=flat)

Selected code from a fully offline resume builder with P2P device sync, ATS auditing, AI-powered job matching, and PDF export. Zero accounts, zero servers  -  everything runs in the browser.

## Tech Stack

TypeScript, React, WebRTC (PeerJS), IndexedDB (Dexie), Zustand

## What's Inside

| Folder                                                   | What It Shows                                                                     |
| :------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| [p2p-sync-engine](./p2p-sync-engine)                     | WebRTC state machine with retry logic, timeout handling, and auto-reconnect       |
| [sync-ux-orchestration](./sync-ux-orchestration)         | Multi-flow dialog with QR codes, OTP input, and state-driven UI                   |
| [offline-persistence-layer](./offline-persistence-layer) | IndexedDB via Dexie with typed error hierarchy and atomic sync import             |
| [offline-first-store](./offline-first-store)             | Zustand store with sync import, demo mode, and cross-entity referential integrity |

Each folder has its own README with problem, solution, and design decisions.