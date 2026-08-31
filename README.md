# DreamFrame

**Every feeling has a film.**

DreamFrame is a movie recommendation prototype designed to replace endless browsing with one thoughtful film recommendation. It uses your current mood, the feeling you want, and movies you already love to suggest a film and explain why it fits the moment.

## [Open the live DreamFrame prototype](https://dream-frame-eight.vercel.app/)

## What the prototype currently does

- Accepts a mood or a description of what you want to feel
- Considers selected favorite films
- Chooses one recommendation from a small curated collection
- Retrieves real movie details, genres, runtime, synopsis, and poster artwork from TMDB
- Presents the result in a dark, minimal interface

## Prototype status

DreamFrame is currently in progress and is not a finished commercial application. I am building it to explore a more personal, emotionally relevant way of discovering films—one that focuses on how someone feels rather than asking them to browse large catalogs or conventional genre lists.

## How it works

The current prototype demonstrates the main recommendation experience using a small curated movie collection. DreamFrame handles the matching experience, while TMDB supplies accurate movie information and poster artwork. A protected backend route keeps the TMDB credential out of the browser.

## Project links

- [Live application on Vercel](https://dream-frame-eight.vercel.app/)
- [Source code on GitHub](https://github.com/lenkabr/DreamFrame)
- [Static GitHub Pages version](https://lenkabr.github.io/DreamFrame/)

## Technology

Next.js, React, TypeScript, TMDB API, and Vercel.

## Run locally

```bash
npm install
npm run dev
```

Create a `.env.local` file and add your own `TMDB_API_KEY` before using live movie data. Never commit this file or the key to GitHub.

---

This product uses the TMDB API but is not endorsed or certified by TMDB.
