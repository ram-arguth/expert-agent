# Expert Agent - Design & Planning

This directory contains design documents and planning materials for the Expert Agent framework.

## Documents

| Document                             | Purpose                      |
| ------------------------------------ | ---------------------------- |
| [VISION.md](./VISION.md)             | High-level vision and goals  |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture (TBD) |
| [ROADMAP.md](./ROADMAP.md)           | Development roadmap (TBD)    |

## Key Decisions

### ✅ Confirmed

- **AI Model**: Gemini 3 Pro (`gemini-3-pro-preview`)
- **Endpoint**: `global` (required for Gemini 3)
- **Multimodal**: Support for images, PDFs, text

### 🔄 To Be Decided

- **Framework**: Next.js vs Agent Builder vs standalone Python
- **Deployment**: Cloud Run vs Agent Engine
- **Context Management**: Custom caching vs Agent Sessions
