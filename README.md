# deluLu 💜

**A mobile-first web app for personal rankings, tier lists, and media tracking.**

deluLu is an ongoing personal project built for a small group of friends to create, customize, and share lists. It runs in the browser and is designed to feel at home on an iPhone, with touch-friendly interactions and a standalone home-screen experience.

The interface is in **Swiss Standard German (de-CH)**. Access to the hosted app is invitation-only; this repository documents the source code and implementation.

## Features

- **Ranking lists:** Create and reorder personal Top-N lists, with drag-and-drop, editable entries, and flexible ranking positions.
- **Tier lists:** Organize entries into tiers, rename tier labels, and adjust rankings through a touch-friendly interface.
- **Sharing and collaboration:** Share selected ranking and tier lists with other users and synchronize changes between participants.
- **Media tracker:** Maintain lists of movies and series by status (watchlist, watching, watched, or dropped), with ratings and personal notes.
- **Catalog and images:** Manage reusable entries and attach profile or background images.
- **Personalization:** Customize the app's appearance and background.
- **Private accounts:** Invitation-based registration and authenticated access, with database-level access policies.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling and interaction | CSS, `@dnd-kit/react`, `@dnd-kit/dom` |
| Backend services | Supabase (Authentication, PostgreSQL, Storage, Realtime) |
| Hosting | Vercel |
| Developer tools | Git, GitHub, ESLint |

## Architecture

The application uses a **modular, feature-oriented frontend**. UI components and application logic are organized by feature, while Supabase integrations live in a separate infrastructure layer.

```text
React + TypeScript frontend
        |
        +-- Feature modules (rankings, tiers, sharing, media, ...)
        |       |
        |       +-- Models, hooks, and repository interfaces
        |
        +-- Supabase infrastructure adapters
                |
                +-- Authentication
                +-- PostgreSQL + Row Level Security (RLS)
                +-- Storage for user-uploaded images
                +-- Realtime updates and database functions
```

Persistent application data is stored in Supabase rather than treated as local browser state. Repository interfaces help separate feature behavior from persistence details, making it easier to extend individual modules.

### Project structure

```text
src/
  app/                    # Application shell, navigation, and shared app state
  features/
    auth/                 # Authentication UI and interfaces
    catalog/              # Reusable catalog entries
    rankings/             # Ranking list interactions and logic
    tiers/                # Tier list interactions and logic
    sharing/              # Shared list views and synchronization
    media/                # Movie and series tracking
    images/               # Image selection and editing
    appearance/           # Appearance customization
  infrastructure/
    supabase/             # Supabase client and repository implementations
  shared/                 # Shared types, UI components, and utilities

supabase/
  migrations/             # Database schema, functions, and policies
```

## Running locally

This project requires Node.js and npm, plus a **separately configured Supabase project**. A fresh Supabase database must be prepared using the SQL migrations and the required authentication, storage, and realtime configuration. The repository does not contain a ready-to-use hosted backend.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/KeLe-gh/DeluLu.git
   cd DeluLu
   npm ci
   ```

2. Create a `.env.local` file in the project root:

   ```dotenv
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

3. Configure the Supabase database and authentication using the project's migrations, then start the development server:

   ```bash
   npm run dev
   ```

> **Note:** Registration is invitation-based and requires a valid invitation configured in the backend. Do not put database passwords, service-role keys, SMTP credentials, or other secrets in `VITE_` variables or commit them to Git.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Development approach

This is a **personal, AI-assisted software project**. I defined the product requirements, iterated on the user experience and modular structure, configured the backend and deployment, and tested and debugged features as they were added. AI coding assistants helped generate and refine parts of the implementation.

The project is also a practical way for me to learn more about full-stack application architecture, authentication, database access control, collaborative state, and software delivery.

## Project status

**Actively developed.** deluLu is currently intended for private use by invited users, rather than as a publicly accessible service. Features and implementation details may change as the project evolves.
