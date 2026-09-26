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

Write every explanation, implication, and example in concise conversational Spanish. Retain English only for the canonical technical name and an acronym's official expansion; never write an English sentence or clause around them.

Use this compact shape:

1. **Skill name**

   **Qué es:** Una sola frase en español sencillo.

   If its name uses an acronym, expand it once and immediately state its purpose in Spanish. For example: “ETL (Extract, Transform, Load): mueve datos entre sistemas.” Do not translate the English expansion. Define unfamiliar jargon only when needed to understand the card, in a short parenthesis on first use.

   - **Basic:** una implicación y ejemplo, en una línea.
   - **Independent:** una implicación y ejemplo, en una línea.
   - **Advanced:** una implicación y ejemplo, en una línea.

Do not include `None` unless the owner explicitly asks. Assess real understanding, judgment, and ability to check or correct the work—not merely whether an AI coding agent could produce something after being prompted. A presence-only profile fact is not a level skill; explain its Yes/No meaning instead if requested.

Avoid preambles, repeated caveats, and separate paragraphs for definitions. Examples must remain understandable to someone unfamiliar with the domain; for example, write “service (a running program with one job)” before using `service` unexplained.

## Batch size

For an initial calibration, prefer 10 cards. Once the owner confirms the format, batches of 15–20 are the practical default; a very large list should be split into reviewable batches.
