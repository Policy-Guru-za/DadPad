{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # TEST_PLAN.md\
\
## Unit tests\
- placeholder encode/decode/validate\
- truncation heuristic (finish_reason and punctuation end-check)\
- retry multiplier/cap logic\
\
## Integration tests (mocked)\
- streaming success for each mode\
- cancel mid-stream (ensures editor restores original)\
- protected token mismatch prevents overwrite\
- rate limit error surfaces cleanly\
\
## Manual test cases\
1. Dictated run-on paragraph -> Polish -> paragraphs + punctuation\
2. Markdown link preserved: [x](https://example.com)\
3. Inline code preserved: `npm run build`\
4. Fenced code preserved\
5. URLs/emails/IDs preserved exactly\
6. Direct produces shorter output\
7. Truncation -> warning + Retry (more room)\
8. Copy disabled during streaming}