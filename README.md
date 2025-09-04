# Peabody - AI-Powered Personal Study Hub

Peabody is a comprehensive study management application built with React, TypeScript, and Supabase. It provides an AI-powered environment for organizing study materials, taking notes, and tracking learning progress.

## Features

- **Authentication**: Secure login/signup using Supabase Auth
- **Dashboard**: Overview of study statistics and progress
- **Workspace**: Create and manage study folders
- **Notes**: Rich text editor with autosave functionality
- **Documents**: File upload and management system
- **Responsive Design**: Works seamlessly across all devices

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **Editor**: Tiptap rich text editor
- **Routing**: React Router DOM
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/thomscaaa-stack/Peabody.git
cd Peabody
```

2. Install dependencies:
```bash
cd frontend
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Database Setup

Run the SQL schema in your Supabase SQL editor to set up the database tables and policies.

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   ├── NotesEditor.tsx # Rich text editor
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Workspace.tsx   # Folder management
│   │   ├── Folder.tsx      # Individual folder view
│   │   └── ...
│   ├── lib/                # Utilities and configurations
│   │   ├── supabase.ts     # Supabase client
│   │   ├── utils.ts        # Helper functions
│   │   └── ...
│   └── App.tsx             # Main application component
├── public/                 # Static assets
└── package.json           # Dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@peabody.com or create an issue in this repository.
# Peabody-1.0
# Peabody-1.0
# Peabody-1.0
# Peabody-1.0
