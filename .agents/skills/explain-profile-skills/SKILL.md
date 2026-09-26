---
name: explain-profile-skills
description: Explain JobQueue Missing skills as concise Spanish skill cards with plain definitions, level examples, and current Profile ordering. Use when the owner asks for skill cards, a batch, or the next missing skills.
---

# Explain Profile Skills

Give the owner practical help choosing profile skill levels. This is an explanation workflow only: never save a profile value, open Chrome, process jobs, or call a job AI provider.

## Select the skills

- When the owner asks for a batch or “the next” cards, preserve the exact order in Profile → Missing. Read the running local `GET /api/jobs` response and use `profileReview.items`; do not alphabetize or use the order in the prompt.
- A family item can contain several pending facts. Explain each pending fact in its displayed order and count each fact as one card.
- If the app is unavailable, say that the live Missing order cannot be confirmed rather than guessing.

## Card format

Write in concise conversational Spanish; retain standard English technical terms. Do not translate common technical English or spell out English words in Spanish.

Use this compact shape:

1. **Skill name**

   **Qué es:** One plain-language sentence.

   If its name uses an acronym, expand it once and immediately state its purpose. For example: “ETL (Extract, Transform, Load): moves data between systems.” Do not translate the English expansion. Define unfamiliar jargon only when needed to understand the card, in a short parenthesis on first use.

   - **Basic:** one concise implication and example.
   - **Independent:** one concise implication and example.
   - **Advanced:** one concise implication and example.

Do not include `None` unless the owner explicitly asks. Assess real understanding, judgment, and ability to check or correct the work—not merely whether an AI coding agent could produce something after being prompted. A presence-only profile fact is not a level skill; explain its Yes/No meaning instead if requested.

Avoid preambles, repeated caveats, and separate paragraphs for definitions. Examples must remain understandable to someone unfamiliar with the domain; for example, write “service (a running program with one job)” before using `service` unexplained.

## Batch size

For an initial calibration, prefer 10 cards. Once the owner confirms the format, batches of 15–20 are the practical default; a very large list should be split into reviewable batches.
