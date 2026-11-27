# Javy

ChatGPT-style AI chatbot built with Next.js App Router, TypeScript, Tailwind CSS and Groq.

## Requirements
- Node.js 20+
- A Groq API key from https://console.groq.com/keys

## Local setup
1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add your Groq key.
4. Run `npm run dev` and open http://localhost:3000.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Never expose `GROQ_API_KEY` in a `NEXT_PUBLIC_` variable. It is used only by the server API route.

## Deploy to Vercel
Import this repository in Vercel, add `GROQ_API_KEY` under Project Settings → Environment Variables, then deploy. Do not commit `.env.local`.

## Features
Streaming chat, model selection, editable system prompt and temperature, local chat history, Markdown/code highlighting, stop/regenerate, responsive sidebar, and light/dark themes.
