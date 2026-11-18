# PairHi — starter website prototype

**Tagline:** Real People. Real Profiles. Real Connections.

PairHi is a serious-relationship and marriage-oriented product concept. This download is a **front-end prototype**, not a live dating service.

## What is included
- Mobile-friendly landing page and sample discovery screen
- Fictional sample profiles and local like/pass demo
- Relationship-intent filter
- Proposed membership display: ₹99 / 1 month, ₹199 / 6 months, ₹399 / 12 months
- PairHi branding image, web app manifest and basic offline shell
- Starter database SQL file for technical review only
- `START_HERE_ANDROID.txt`: beginner steps for publishing the demo from an Android phone

## Important: what is not working yet
There is no real user registration, shared live profile database, identity verification, mutual-match backend, chat, voice/video calls, payments, moderation, or account deletion system. The likes in this demo are stored only in the browser and do not reach another person. Do not invite real users or collect sensitive personal information through this prototype.

## PairHi product requirements to build next
1. Adults-only access (18+) with clear consent.
2. Only approved/verified profiles appear in discovery; pending profiles remain hidden.
3. Verification must accurately describe what was checked. Email/phone OTP verifies control of that contact method; selfie/liveness checks presence/photo similarity, not government identity.
4. Free members: 10 likes/swipes. Paid members: unlimited likes while subscription is active.
5. A match is created only after both people have liked each other.
6. After a mutual match, private messaging and voice/video calls are planned to be free for both matched users.
7. Block, report, unmatch, moderation, rate limits, anti-scam controls and account deletion are required before launch.
8. Never expose precise location. Use city-level discovery and protect profile photos.
9. Keep payment, identity-verification and moderation integrations out of scope until the safety and privacy design is reviewed.

## Proposed prices (not yet active)
- ₹99 for 1 month
- ₹199 for 6 months
- ₹399 for 12 months

The website does not currently charge users. Pricing, taxes, refunds, auto-renewal and payment-provider rules must be reviewed before enabling payments.

## Database warning
`supabase_schema.sql` is a learning scaffold only. It is **not production-ready**. In particular, do not deploy it with real users until a developer has reviewed and tested row-level security, safe discovery fields, private media storage, server-side mutual matching, blocking, reporting, and deletion. Never place a Supabase `service_role` key in website JavaScript.

## SEO starting point
Suggested title: `PairHi – Serious Dating & Marriage Connections`
Suggested description: `PairHi helps adults discover genuine connections for serious relationships and marriage. Explore mutual matches and build meaningful relationships.`
SEO cannot be guaranteed by metadata alone. You will also need useful original content, a public privacy policy, fast/mobile-friendly pages, real trust and safety practices, relevant links and time for search engines to index the site.

## Trademark and domain
The name and domain have **not** been legally cleared. Search exact and similar names before spending money or launching:
https://tmrsearch.ipindia.gov.in/tmrpublicsearch/
