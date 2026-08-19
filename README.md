# WP Pro Email Sender 🚀

A modern, high-conversion cold outreach & email automation platform built specifically for **[WP Pro](https://wppro.au/)** (AI Business Integration, Web Site Design, SEO & Paid Ads).

![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Resend](https://img.shields.io/badge/Resend-API-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38bdf8?style=flat-square&logo=tailwindcss)

---

## 🌟 Key Features

- 🏢 **WP Pro Copy Engine**: Automatically tailors outreach copy per industry (Plumbing & Trades, NDIS Providers, Real Estate, Legal, Finance/Accounting).
- 📈 **Automated Domain Warmup Schedule**:
  - **Day 1–2**: 20 emails/day
  - **Day 3–4**: 40 emails/day
  - **Day 5–7**: 75 emails/day
  - **Day 8+**: Capped at 100 emails/day (Max GitHub Actions ceiling)
- ⚙️ **GitHub Actions Daily Automation**: Workflow automatically runs every day at 9:00 AM Sydney Time (23:00 UTC) to send daily quota and commit list state.
- 🚫 **Anti-Spam & Deduplication Engine**:
  - 100% Unique emails per list.
  - 100% Unique website domains per campaign.
  - Auto-filters supplier portals (`O'Brien`, `Reece`, `Tradelink`, `Elders`).
- 📁 **Multi-List Management**: Switch, create, and delete mailing lists directly from the top bar dropdown.
- 👁️ **Live Email Preview Modal**: Review rendered personalized HTML & subject line before sending.
- 🔄 **Real-Time Resend Delivery Status Sync**: Syncs `delivered`, `bounced`, `opened`, `clicked`, and `failed` statuses.

---

## 🚀 Getting Started

### 1. Environment Setup

Create `.env.local` in the root directory:

```env
# WP Pro Resend Credentials
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=WP Pro <hello@email.wppro.com.au>
RESEND_REPLY_TO=info@wppro.au

# Sender Warmup Start Date (YYYY-MM-DD)
WARMUP_START_DATE=2026-08-19

# Dashboard Security
DASHBOARD_EMAIL=admin@wppro.au
DASHBOARD_PASSWORD=wppro_secure_password_2026
AUTH_SECRET=your_secret_key_here
```

### 2. Development

```bash
# Install dependencies
npm install

# Run local dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access your dashboard.

---

## 📅 GitHub Actions Daily Automated Sending Setup

To run automated daily sending (up to 100 emails/day):

1. Go to your GitHub repository: **Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**.
2. Add the following repository secrets:
   - `RESEND_API_KEY`: Your Resend API Key.
   - `RESEND_FROM_EMAIL`: `WP Pro <hello@email.wppro.com.au>`
   - `RESEND_REPLY_TO`: `info@wppro.au`
3. The workflow in `.github/workflows/daily-sender.yml` will run automatically every day at 9:00 AM AEST!

---

## 🛠️ Built With

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI & Styling**: React 19, Tailwind CSS, Lucide Icons
- **Email Delivery**: [Resend SDK](https://resend.com/)
- **Scraper Pipeline**: Playwright Chromium Automation Engine
