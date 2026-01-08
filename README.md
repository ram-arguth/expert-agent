# Expert Agent

A generalized AI agent framework for domain-specific expertise, built on Google's Gemini models.

## Overview

Expert Agent is a framework for creating specialized AI agents that can analyze domain-specific artifacts and provide expert-level feedback. Unlike domain-locked applications, Expert Agent allows you to define your own expertise domain, evaluation criteria, and output formats.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Expert Agent Framework                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Domain     │   │   Analysis   │   │   Report     │    │
│  │ Configuration│──▶│    Engine    │──▶│  Generator   │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Prompt       │   │ Gemini 3 Pro │   │ Structured   │    │
│  │ Templates    │   │ (global)     │   │ Output       │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Potential Use Cases

- **UX Analysis** (like UXinator)
- **Code Review** - Analyze PRs for best practices, security, performance
- **Documentation Review** - Check docs for completeness, accuracy, style
- **Design System Audit** - Evaluate component libraries against standards
- **Security Assessment** - Review configs, policies, access patterns
- **Content Strategy** - Analyze marketing copy, brand consistency

## Technology Stack

- **AI**: Gemini 3 Pro (`gemini-3-pro-preview`) on global endpoint
- **Framework**: TBD (Next.js, Agent Builder, or standalone)
- **Infrastructure**: Google Cloud Platform

## Status

🚧 **Planning Phase** - See `/docs` for design documents.

## License

TBD
