# Little Pumpkin Baby Shower — Krutarth & Raksha

Static site, no build step. Live at `https://krutarth22.github.io/little-pumpkin/`.
Cloud backend: Supabase (shared RSVPs + keepsake wall + photo storage).

## Run locally
```
cd "/Users/krutarthmajithia/Documents/ChatGPT/Resume Skills/little-pumpkin-baby-shower"
python3 -m http.server 8765
# open http://localhost:8765
```

## Supabase one-time setup (required before invites!)
The keys are already in `app.js`. You must create the tables + bucket once:
1. In `supabase.sql`, confirm the email in the `Host can read RSVPs` policy is the host email you want to authorize.
2. Supabase dashboard → SQL editor → New query → paste all of `supabase.sql` → Run.
3. Storage → New bucket → name `keepsake`, set **Public ON**.
4. Auth → Providers → Email → confirm magic-link/OTP login is enabled.
5. Open `admin.html`, enter that email, then click the secure link sent to the inbox.

How security works: guests can INSERT RSVPs/keepsakes but cannot READ the RSVP list (RLS). Only the authorized host emails can read/export. No passwords are stored in the source code.

## Deploy
Push to `main` on GitHub — Pages rebuilds automatically in ~1 min.
Put the live link on your invites.

## Host checklist
- Admin: email magic-link login → summary counts, guest search and attendance filters, refresh, and filtered CSV export for the caterer.
- Registry: link-only to Amazon. Guests must buy via the Registry page so Amazon marks items purchased.
- Keepsake wall: notes + photos collect in Supabase; wall is public, RSVP list is private.
