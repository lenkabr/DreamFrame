# DreamFrame

**Every feeling has a film.**

DreamFrame is a movie recommendation prototype designed to replace endless browsing with one thoughtful film recommendation. It uses your current mood, the feeling you want, and movies you already love to suggest a film and explain why it fits the moment.

## [Open the live DreamFrame prototype](https://dream-frame-eight.vercel.app/)

## What the prototype currently does

- Accepts a mood or a description of what you want to feel
- Understands emotional intent using OpenAI's GPT-5 Mini model
- Recommends films dynamically instead of choosing from a fixed local list
- Supports mood-based discovery, films similar to a title, and favorite-film taste references
- Lets users select the exact film from TMDB search results with a poster preview and release year
- Remembers Loved, Not for me, and Already seen feedback in the user's browser
- Avoids recommending films already listed as favorites or previously shown
- Filters out films rated below 5/10 on TMDB unless someone explicitly asks for a deliberately bad movie
- Retrieves real movie details, genres, runtime, synopsis, and poster artwork from TMDB
- Presents the result in a dark, minimal interface

## Prototype status

DreamFrame is currently in progress and is not a finished commercial application. I am building it to explore a more personal, emotionally relevant way of discovering films—one that focuses on how someone feels rather than asking them to browse large catalogs or conventional genre lists.

## How it works

The current prototype uses OpenAI's GPT-5 Mini through the Responses API to interpret what the user wants and select a fitting real film. TMDB powers the movie picker, verifies titles, and supplies accurate movie information and poster artwork. For Similar mode, the selected TMDB movie ID identifies the exact adaptation before TMDB provides related candidates and the model chooses the strongest match. Lightweight taste feedback is stored locally in the browser and influences later recommendations on that device. Protected backend routes keep both API credentials out of the browser.

## Project links

- [Live application on Vercel](https://dream-frame-eight.vercel.app/)
- [Source code on GitHub](https://github.com/lenkabr/DreamFrame)
- [Static GitHub Pages version](https://lenkabr.github.io/DreamFrame/)

## Technology

Next.js, React, TypeScript, OpenAI Responses API with GPT-5 Mini, TMDB API, and Vercel.

## Run locally

```bash
npm install
npm run dev
```

Create a `.env.local` file with your own keys before using the recommendation engine:

```text
TMDB_API_KEY=your_tmdb_key
OPENAI_API_KEY=your_openai_key
```

Never commit this file or either key to GitHub.

---

This product uses the TMDB API but is not endorsed or certified by TMDB.
