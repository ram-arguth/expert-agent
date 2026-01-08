# Expert Agent - Vision

## The Problem

Building AI-powered expert systems today requires significant effort:

- Custom prompt engineering for each domain
- Complex context management
- Multimodal input handling
- Structured output generation
- Session and memory management

## The Solution

Expert Agent is a **framework** that abstracts these concerns, allowing developers to focus on:

1. Defining their domain expertise
2. Specifying evaluation criteria
3. Customizing output formats

## Core Principles

### 1. Domain Agnostic, Expert Focused

The framework doesn't care if you're analyzing UX designs, code, documents, or security configs. You provide the expertise definition, it handles the rest.

### 2. Gemini 3 Native

Built exclusively for Gemini 3 Pro's advanced reasoning and multimodal capabilities. No backwards compatibility with older models.

### 3. Structured by Default

All outputs are structured (JSON/Markdown with schema). No free-form text dumps.

### 4. Conversational Refinement

Support for follow-up questions and iterative analysis through context caching and session management.

## Learnings from UXinator

What worked well:

- 282-line prompt templates with clear structure
- Multimodal input (images + PDFs + text)
- Structured markdown reports
- Per-revision context caching
- Q&A chat for refinement

What could be generalized:

- Domain-specific knowledge base injection
- Evaluation criteria definition
- Report schema customization
- Artifact type handling

## Success Metrics

1. **Time to Expert**: How quickly can someone create a new expert agent?
2. **Quality Parity**: Does the output match a custom-built solution?
3. **Flexibility**: Can it handle edge cases without framework escape hatches?

## Non-Goals

- Not a "no-code" solution - developers are the target users
- Not trying to replace Agent Builder - may integrate with it
- Not a general chatbot framework - focused on expert analysis
