# 🎵 DriveTune

**An AI-powered music sheet organizer for Google Drive**

DriveTune is a NextJS application that automatically extracts metadata from music sheet PDFs and organizes them into a structured directory system in your Google Drive. Using Google's Gemini AI, it intelligently identifies composers, arrangement types, and individual instrument parts to create a beautifully organized music library.

## ✨ Features

### 🔐 **Google Drive Integration**

- Secure authentication with Google Drive
- Browse and select root folders for organization
- Automatic folder structure creation

### 📄 **Smart PDF Processing**

- Drag-and-drop file upload interface
- Support for large PDF files (up to 2GB) using Gemini Files API
- Automatic file merging for multi-file arrangements

### 🤖 **AI-Powered Metadata Extraction**

- **Composition Analysis**: Automatically identifies titles, composers, and arrangement types
- **Part Detection**: Recognizes individual instrument parts, full scores, covers, and program notes
- **Page Mapping**: Precisely identifies start and end pages for each section
- **Smart Categorization**: Chooses from predefined arrangement types (Concert Band, Jazz Ensemble, etc.)

### 📁 **Automatic Organization**

- **Structured Directories**: Creates `{Arrangement Type}/{Composition Name}` folder structure
- **Standardized Naming**: Generates consistent filenames like `"Bolero - Full Score.pdf"`
- **Part Separation**: Extracts and organizes individual instrument parts

### 📊 **Progress Tracking**

- Real-time processing status updates
- File size validation and optimization suggestions
- Detailed error handling with user-friendly messages

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Google Cloud Project with:
  - Google Drive API enabled
  - Gemini API access
- Firebase project (for hosting)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd drive-tune
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**
   Create a `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=your_google_picker_api_key
GEMINI_API_KEY=your_gemini_api_key
```

4. **Start the development server**

```bash
pnpm dev
```

The application will be available at `http://localhost:9002`

### AI Development (Optional)

For AI flow development and testing:

```bash
# Start Genkit development server
pnpm genkit:dev

# Watch mode for AI flows
pnpm genkit:watch
```

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **AI Processing**: Google Gemini API with Genkit framework
- **Storage**: Google Drive API
- **UI Components**: Radix UI with Tailwind CSS
- **Hosting**: Firebase App Hosting

### Key Components

#### AI Flows (`src/ai/flows/`)

- **`extract-music-sheet-metadata.ts`**: Core metadata extraction using Gemini
- **`generate-music-sheet-filename.ts`**: Standardized filename generation
- **`create-music-sheet-directory.ts`**: Directory structure planning

#### Custom Hooks (`src/hooks/`)

- **`use-google-drive-auth.ts`**: Google Drive authentication management
- **`use-google-drive-folder-manager.ts`**: Drive folder operations
- **`use-arrangement-manager.ts`**: Music arrangement processing logic

#### Components (`src/components/`)

- **`DriveTuneApp.tsx`**: Main application component
- **`ArrangementListItem.tsx`**: Individual arrangement display
- **`ui/`**: Reusable UI components (buttons, dialogs, etc.)

## 📖 Usage

### Basic Workflow

1. **Connect to Google Drive**

   - Click "Connect Google Drive" and authenticate
   - Grant necessary permissions for file access

2. **Select Organization Folder**

   - Browse your Google Drive
   - Choose or create a root folder for your music library

3. **Upload Music Sheets**

   - Drag and drop PDF files or click to browse
   - Add multiple files for complex arrangements

4. **AI Processing**

   - DriveTune automatically:
     - Extracts metadata (title, composers, arrangement type)
     - Identifies individual parts and page ranges
     - Generates standardized filenames

5. **Automatic Organization**
   - Creates structured folders in Google Drive
   - Uploads organized files with proper naming
   - Provides progress feedback throughout

### File Processing Details

- **Small files (< 20MB)**: Processed directly via Gemini API
- **Large files (20MB - 2GB)**: Uploaded to Gemini Files API for processing
- **Multi-file arrangements**: Automatically merged before processing
- **Part extraction**: Individual instrument parts saved separately

## 🎨 Design Philosophy

DriveTune uses a calming color palette designed for creative professionals:

- **Primary**: Soft Lavender (#E6E6FA) - conveys calm and organization
- **Background**: Very light lavender (#F5F5FF) - creates peaceful working atmosphere
- **Accent**: Pale Pink (#F08080) - highlights interactive elements
- **Typography**: Clean sans-serif fonts for readability
- **Animations**: Subtle progress indicators and confirmations

## 🛠️ Development

### Project Structure

```
src/
├── ai/                    # AI flows and Genkit configuration
│   ├── flows/            # Individual AI processing flows
│   ├── genkit.ts         # Genkit setup and configuration
│   └── dev.ts            # Development entry point
├── app/                  # Next.js app router
├── components/           # React components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
└── types/                # TypeScript type definitions
```

### Available Scripts

```bash
# Development
pnpm dev                  # Start Next.js dev server (port 9002)
pnpm build               # Build for production
pnpm start               # Start production server

# AI Development
pnpm genkit:dev          # Start Genkit development server
pnpm genkit:watch        # Genkit with file watching

# Code Quality
pnpm lint                # Run ESLint
pnpm typecheck           # Run TypeScript compiler check
```

### Key Dependencies

- **@genkit-ai/googleai**: AI processing with Google Gemini
- **googleapis**: Google Drive API integration
- **@radix-ui/\***: Accessible UI components
- **tailwindcss**: Utility-first CSS framework
- **pdf-lib**: PDF manipulation and merging
- **react-hook-form**: Form handling with validation

## 🔧 Configuration

### Google Cloud Setup

1. **Enable APIs** in Google Cloud Console:

   - Google Drive API
   - Google Picker API
   - Gemini AI API

2. **Create credentials**:

   - OAuth 2.0 client ID for Google Drive access
   - API key for Google Picker
   - Service account for Gemini API (or use API key)

3. **Configure OAuth** consent screen and authorized domains

### Firebase Setup

1. **Initialize Firebase** project
2. **Configure App Hosting** (see `apphosting.yaml`)
3. **Set environment variables** in Firebase console

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is part of Firebase Studio. See the license terms in your Firebase Studio agreement.

## 🙏 Acknowledgments

- **Google Gemini AI** for intelligent document processing
- **Firebase** for hosting and infrastructure
- **Radix UI** for accessible component primitives
- **Tailwind CSS** for beautiful, responsive design

---

_Built with ❤️ for musicians and music librarians who want their digital scores organized beautifully._
