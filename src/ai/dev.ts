import { config } from 'dotenv';
config();

import '@/ai/flows/extract-music-sheet-metadata.ts';
import '@/ai/flows/generate-music-sheet-filename.ts';
import '@/ai/flows/create-music-sheet-directory.ts';