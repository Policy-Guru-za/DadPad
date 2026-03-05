{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # REPO_SETUP.md\
\
## Requirements\
- macOS\
- Node.js (LTS)\
- Rust toolchain\
- Tauri prerequisites for macOS\
- pnpm (preferred) or npm\
\
## Install\
1. Install dependencies:\
   - pnpm install\
\
2. Run dev:\
   - pnpm tauri dev\
\
## Tests\
- pnpm test\
\
## Build\
- pnpm tauri build\
\
## Notes\
- No microphone / accessibility permissions should be required for V1.\
- If the app asks for elevated permissions, treat as a bug.}