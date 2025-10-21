# Home Run Derby

A simple, fun web app for tracking Home Run Derby games with friends and family.

## Features

- ⚾ Add players and track home runs
- 🎯 Click to cycle through pitch results: ☐ → ✗ → HR
- ⚡ Lightning rounds for tied players
- 📊 Real-time leaderboard and top 3 display
- 💾 Automatic local storage (saves your progress)
- 🔗 Share games with friends via URL
- 📋 Export results to CSV
- ↩️ Undo functionality
- 🏆 Winner celebration

## How to Play

1. Add players by typing their names and clicking "Add"
2. Click on the pitch squares to cycle through results:
   - ☐ Empty (miss)
   - ✗ Strike
   - HR Home Run
3. Click "End Main Round" when all players are done
4. If there's a tie, lightning rounds will begin automatically
5. The winner(s) will be crowned! 🏆

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

This app is deployed on GitHub Pages and can be accessed at: [https://jamiemetzger600.github.io/HomeRunDerby/](https://jamiemetzger600.github.io/HomeRunDerby/)

## Technology Stack

- React 18 with TypeScript
- Vite for build tooling
- CSS for styling
- Local Storage for data persistence

Made for quick backyard bragging rights ⚾️
