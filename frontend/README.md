# Trading Dashboard

A modern React-based trading dashboard for Vietnamese stock market analysis.

## Features

- **Dashboard**: Market overview with RS ratings and recent analysis
- **Stock Screener**: Advanced filtering with AND/OR logic
- **Divergence Analysis**: Bullish and bearish pattern detection
- **Configuration**: Manage trading analysis settings
- **Settings**: Cache management and system info

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **Router**: React Router v7
- **HTTP**: Axios
- **UI**: Custom components inspired by shadcn/ui

## Development

```bash
# Install dependencies
yarn install

# Start dev server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## API Integration

The dashboard connects to a backend API running on `http://localhost:8080`. Ensure the backend server is running before starting the frontend.

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route-level page components
├── hooks/          # Custom React hooks
├── services/       # API layer
├── store/          # Zustand state stores
└── styles/         # Global styles
```
