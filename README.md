# N K Airconditioning — Backend

Node.js, Express, TypeScript and MongoDB API for customer reviews. Callback booking requests are delivered by email only and are not stored in MongoDB.

## Setup

```bash
npm ci
```

Create `.env` from `.env.example` and configure:

- `MONGODB_URI` for review storage.
- `FRONTEND_URL` with the complete frontend origin, including `https://` in production.
- `BREVO_API_KEY` for booking notification emails over HTTPS.
- `EMAIL_SENDER_ADDRESS` with a sender verified in Brevo.
- `BOOKING_NOTIFICATION_EMAIL` with the inbox that should receive booking requests.

The backend does not use SMTP. Booking requests are sent through Brevo's HTTPS API and are not saved in MongoDB.

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

Never commit the real `.env` file.

## Category media and pagination

The backend owns `src/data/catalog.json` and optimized media in `public/work/`. Deploy both `dist/` and `public/work/`. Restart the API after updating the catalog.

- `GET /api/catalog/services` returns 12 category summaries without gallery arrays.
- `GET /api/catalog/services/:slug` returns one summary.
- `GET /api/catalog/services/:slug/media?page=1` returns at most 10 items and `page`, `pageSize`, `total`, `totalPages`. The backend fixes the page size at 10 and validates page numbers.
- `GET /api/catalog/hero` returns seven slides: shop first, the original three and three random photos from distinct categories. This response is not cached.
- `/work/*` serves optimized photos and videos with cache headers and HTTP range support.

Run `npm run import:work` with development dependencies installed to import source folders. `MEDIA_SOURCE_DIR` defaults to `E:/`; the shop photo is included. Importing runs offline, never during visitor requests. Rebuild/restart after importing. The source drive is not needed when serving the site.

Run `npm run build` followed by `npm test` to check pagination, category summaries, media paths, random slides and video range requests.
