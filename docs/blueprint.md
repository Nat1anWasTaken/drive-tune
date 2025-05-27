# **App Name**: DriveTune

## Core Features:

- Drive Authentication: Securely connect to the user's Google Drive account.
- Folder Selection: Allow users to browse their Google Drive and select a root folder for organizing music sheets.
- File Upload: Provide a drag-and-drop interface for uploading multiple music sheet files.
- Metadata Extraction: Use Gemini API as a tool to extract relevant metadata from the music sheet files (composition type, composer, arranger, etc.).
- File Naming: Generate standardized and organized file names based on the extracted metadata with Gemini.
- Directory Creation: Automatically create the appropriate nested directory structure (Type of Composition/Arrangement -> Composition Name -> Composer and Arrangers) in Google Drive with the tool Gemini API based on extracted metadata.
- Progress and Status: Display clear progress indicators and status messages during file upload, metadata extraction, and Google Drive organization.

## Style Guidelines:

- Primary color: Soft Lavender (#E6E6FA) to convey a sense of calm and organization, fitting for a tool that manages creative works.
- Background color: Very light, desaturated lavender (#F5F5FF), to create a calm working atmosphere.
- Accent color: Pale Pink (#F08080) for interactive elements and highlights, ensuring they stand out without being visually jarring.
- Clean, sans-serif font for readability.
- Simple, consistent icons for common actions like upload, download, and organize.
- Clear, intuitive layout with drag-and-drop functionality.
- Subtle animations for feedback and visual interest (e.g., progress bar animation, confirmation messages).