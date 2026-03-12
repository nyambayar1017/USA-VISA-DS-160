# DS-160 Intake Form

Simple web form you can share with visa applicants so they can submit their answers online.

## Run locally

```bash
ADMIN_TOKEN=your-secret-token python3 server.py
```

Then open:

- Public form: `http://127.0.0.1:3000/`
- Admin dashboard: `http://127.0.0.1:3000/admin`

## How it works

- Applicants fill out the public form.
- Submissions are saved in `data/submissions.json`.
- You open the admin page, enter your admin token, and review or export submissions as CSV.

## Important

- Change `your-secret-token` to a real private password before using it.
- The current storage is a JSON file. Locally it is stored in `data/submissions.json`.

## Deploy on Render

1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint and select that repository.
3. Keep the included `render.yaml`.
4. Set a strong `ADMIN_TOKEN` secret when Render asks for it.
5. Deploy, then open your new `onrender.com` URL.

Notes:

- `render.yaml` is configured for a `starter` web service with a 1 GB persistent disk mounted at `/var/data`.
- This matters because Render's free web services are not intended for production use, and persistent disks are only available on paid services.
