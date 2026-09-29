# Dmatx — F&O dashboard (DhanHQ)
Needs: Dhan account + Data APIs subscription (Dhan web -> DhanHQ Trading APIs). Trading APIs are free, Data APIs (market quote) are paid.
## Env vars
- DHAN_CLIENT_ID   (Dhan client id)
- DHAN_ACCESS_TOKEN (web.dhan.co -> My Profile -> Access DhanHQ APIs -> Generate token, valid 24h)
- DB_PATH=/data/dmatx.db  (persistent disk)
- Optional auto token: DHAN_PIN (6 digit) + DHAN_TOTP_SECRET (enable TOTP on Dhan web). Server refreshes token daily 8:30 IST.
## Local
npm install
DHAN_CLIENT_ID=xxx DHAN_ACCESS_TOKEN=yyy npm start   -> http://localhost:3000 -> Data source = "Backend API (live)"
Check http://localhost:3000/api/status (fno should be ~200; hasToken true; lastErr empty)
## Deploy (Render)
Push to GitHub -> Render Web Service -> Build `npm install`, Start `npm start` -> add env vars + Disk mounted at /data.
Snapshots: every 5 min, 9:15-15:30 IST Mon-Fri, all F&O stocks. Uses one /marketfeed/quote call (limit 1/sec, 1000 instruments).
