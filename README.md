
# UNDERGROUND GEO — Finished Standalone Website

This is a real standalone full-stack UG platform. It is not a Replit-only project.

## Included
- Express backend
- SQLite database with persistent data
- Secure password hashing
- Cookie-based authentication
- Artist / producer / member accounts
- Optional YouTube
- Editable profiles and profile pictures
- Social links shown only when added
- Audio, video, cover, and external-link uploads
- Releases
- Community posts, comments, reactions
- Admin panel
- Category management
- Discord settings stored in the database
- Discord CTA on every supported category
- Uploaded UG logo
- Responsive custom design

## Run locally
1. Install Node.js 20 or newer.
2. Open this folder in a terminal.
3. Run `npm install`
4. Set secure environment variables:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
5. Run `npm start`
6. Open `http://localhost:3000`

The database is created in `data/ug.sqlite`. Uploaded files are stored in `public/uploads`.

## Important hosting note
For permanent production data, use a host with persistent disk/storage or replace SQLite/file uploads with managed PostgreSQL and object storage. Do not use temporary filesystem hosting for important uploads.

Never publish with the default admin password. Change it before deployment.
