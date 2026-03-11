# GlassyTools - Production Guide

## Architecture
GlassyTools consists of:
1.  **Frontend**: Static HTML/CSS/JS (runs in browser).
2.  **Backend**: Node.js Express Server (handles API requests for YouTube/Instagram).

## Local Development (How to Run)
To use the "Full Features" (Downloader), you must run the local server.

1.  **Install Dependencies**:
    ```bash
    cd glassy-tools
    npm install
    ```

2.  **Start Server**:
    ```bash
    npm start
    ```
    *Server runs on http://localhost:3000*

3.  **Open Application**:
    Open `index.html` in your browser.

## Deployment (Production)

### Backend (Render/Railway/Heroku)
1.  Commit the project to GitHub.
2.  Create a Web Service pointing to the `glassy-tools` directory.
3.  Set Build Command: `npm install`
4.  Set Start Command: `node server.js`
5.  **Important**: Update `media-downloader.js` to point to your production URL (e.g., `https://my-glassy-server.onrender.com`) instead of `localhost:3000`.

### Frontend (Vercel/Netlify)
1.  Deploy the static files (`index.html`, `style.css`, etc.) to Vercel/Netlify.
2.  Ensure no mixing of HTTPS frontend and HTTP backend (mixed content errors). You will likely need SSL for the backend.

## Troubleshooting
-   **CORS Error**: Ensure `cors` is enabled in `server.js` (Review: it is).
-   **YouTube Download 403**: YouTube actively blocks server IPs. If `ytdl-core` fails, consider using a specialized proxy service or updating the library (`npm update`).
