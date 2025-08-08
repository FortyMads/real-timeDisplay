# AngularApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

# Real-Time Programme Display System

This project is a real-time schedule display and admin control system for professional programme/event management. It features:

- Real-time sync between admin and display windows using localStorage and postMessage
- Admin UI for adding, editing, skipping, ending, and saving programmes
- Display UI with fullscreen support, persistent window position, and modern design
- Announcement overlay: Admin can send announcements that appear on all display windows for a set duration (default 2 minutes), without interrupting the main timer
- Multi-window and preview support: All display windows (including preview) update in real time

## How to Use Announcements

- Go to the Announcements tab in the admin UI
- Enter your announcement text and (optionally) set the duration
- Click Send Announcement
- The announcement will overlay all display windows for the set time, while the timer continues running in the background

## Build & Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm start
   ```
3. Open the admin UI in your browser (usually at `http://localhost:4200`).
4. Use "Open Display in New Window" to launch the display.

## For More Details
See TECHNICAL_MANUAL.md for architecture, extensibility, and troubleshooting tips.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Deploying to GitHub Pages

This repo is configured to deploy to GitHub Pages from the `main` branch using GitHub Actions.

- Build locally for Pages (optional):
  - `npm run build:ghpages`
  - Outputs to `dist/angular-app/browser` with base-href `/real-timeDisplay/`.

- CI deployment:
  - On every push to `main`, the workflow `.github/workflows/gh-pages.yml` builds with the correct base-href and publishes the `dist/angular-app/browser` folder to Pages.
  - A `404.html` is added for SPA deep-link routing.

Make sure your repository name is `real-timeDisplay` (case-sensitive) and Pages is enabled for GitHub Actions in the repo settings.
