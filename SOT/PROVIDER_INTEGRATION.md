{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # PROVIDER_INTEGRATION.md\
\
## Provider abstraction\
All provider/API endpoint details must live inside provider clients (e.g. src/providers/openai.ts). UI must not know endpoints.\
\
## OpenAI\
- Default model: gpt-5-nano-2025-08-07 (as per PRD/BLUEPRINT)\
- Endpoint selection (Responses vs Chat Completions) is owned by openai.ts.\
- Streaming is required; stream text deltas into the UI buffer.\
- Cancellation via AbortController.\
- Errors mapped to user-safe messages (401, 429, timeout, network).\
\
## Anthropic (Phase 0 optional)\
If added, must match the same streaming + cancellation + error mapping behaviour.}