# GardenGuard Monitor - Durian Report

A Next.js garden monitoring application for tracking plant health, watering schedules, and issues across multiple gardens. Built with Supabase for data storage.

## Features

- 🌱 **Multi-Garden Support** - Monitor multiple gardens with different plant types
- 📝 **Plant Tracking** - Track individual plants by type and ID
- 📸 **Media Support** - Attach photos or videos to plant reports
- 🎤 **Voice Input** - Use speech recognition for dictation
- 📲 **WhatsApp Sharing** - Share reports directly to WhatsApp
- 📄 **PDF Export** - Generate PDF reports for selected plants
- ✏️ **Edit & Delete** - Full CRUD operations for reports
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Plant Types Supported

- Mango
- Orange
- Avocado
- Banana
- Durian

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned

### 3. Set Up Database

1. Go to your Supabase project's **SQL Editor**
2. Open `supabase/schema.sql` from this project
3. Run the SQL script to create:
   - The `updates` table
   - Storage bucket for media files
   - Row Level Security policies

### 4. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to **Project Settings** → **API**
   - Copy your **Project URL** to `NEXT_PUBLIC_SUPABASE_URL`
   - Copy your **anon/public key** to `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Your `.env.local` should look like:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Creating a Report

1. Select a garden from the dashboard
2. Tap the **+** button
3. Fill in the form:
   - Plant Type (Mango, Orange, etc.)
   - Specific Plant ID
   - Description (or use voice input)
   - Photo/Video (paste URL or upload file)
4. Tap **Done** to finish or **Save & Next** to add another

### Managing Reports

- **Share** - Share individual reports to WhatsApp
- **Edit** - Modify existing reports
- **Delete** - Remove reports

### Bulk Actions

1. Tap the **Select** button in the header
2. Select multiple reports using checkboxes
3. Use bulk actions:
   - **Share (WA)** - Share all selected as a bulk report
   - **Download PDF** - Generate a PDF report

## Database Schema

```sql
updates table:
  - id: Auto-incrementing ID
  - garden: Garden name (Garden 1, Garden 2, etc.)
  - type: Plant type (Mango, Orange, etc.)
  - plant_id: Specific plant identifier
  - desc: Description text
  - media: URL to uploaded media (optional)
  - media_type: MIME type of media
  - date: Formatted date string
  - created_at: Timestamp
```

## File Structure

```
durian-report/
├── app/
│   ├── layout.tsx       # Root layout with metadata
│   ├── page.tsx         # Main application component
│   └── globals.css      # Global styles
├── lib/
│   └── supabase.ts      # Supabase client & database functions
├── supabase/
│   └── schema.sql       # Database setup script
├── public/              # Static assets
├── .env.local.example   # Environment variables template
└── package.json
```

## Technologies Used

- **Next.js 16** - React framework
- **React 19** - UI library
- **Supabase** - Backend & database
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **jsPDF** - PDF generation

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com/new)
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Make sure to add these in your deployment platform:

```env
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

## Security Notes

- The current setup allows public access to the database
- For production, consider adding:
  - User authentication
  - Row-level security based on user ID
  - Restricted upload policies
  - Rate limiting

## License

MIT
