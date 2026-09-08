# UNDERGROUND GEO

A new full-stack UG community website.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. Run:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Admin panel

Open `/admin`.

The included public app is ready for the main community experience. The admin API is protected by the admin account and supports real resource uploads, deletion, and settings updates. Extend the admin UI in `public/admin.html` if you want a separate visual console.

## Notes

- This is a functional starter implementation with SQLite and local uploads.
- For production hosting, use persistent disk/storage and a strong session secret.
- Passwords should be hashed before public deployment; replace the simple demo password handling with bcrypt/argon2.
