# ArchAgent

ArchAgent is an AI-powered Architectural Design Assistant that leverages the Gemini API to analyze architectural drawings and floor plans. Conceptually tied to **EquiSpace**, it automates the process of verifying accessibility compliance in designs, checking thermal efficiency, and provides an interactive chat interface for architectural consultation.

## 🌟 Features

- 🏢 **General Architecture Analysis**: Upload a floor plan to get a comprehensive AI analysis report, including project type, overall score, compliance level, key findings, legal checks, and improvement actions.
- ♿ **Wheelchair Accessibility Check**: Automatically extracts and verifies wheelchair accessibility data such as entry access, path dimensions (door width, turning space), slopes, steps, and disabled facilities.
- ☀️ **Thermal Efficiency & Sunlight Exposure**: Analyzes the drawing to estimate sunlight exposure, thermal efficiency, window impact, and estimated energy cost impacts for heating and cooling.
- 💬 **Interactive Design Consultation**: Chat directly with the AI agent about the uploaded floor plan. Ask specific questions like "Is the wheelchair turning radius sufficient?" or "What if we change the door width to 1200mm?".

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS
- **UI & Animation**: Lucide React, Motion (Framer Motion)
- **AI Integration**: Google Gemini API (`@google/genai`)

## ⚡ Prerequisites

- Node.js (v18 or higher recommended)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Setup**:
   Copy the example environment file and add your Gemini API Key.
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure your API key:
   ```env
   GEMINI_API_KEY="your_actual_gemini_api_key_here"
   ```
3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   The application will start, typically available at `http://localhost:8080` (or the port specified in `vite.config.ts`).

## 📜 Available Scripts

- `npm run dev`: Starts the local development server using Vite.
- `npm run build`: Compiles TypeScript and builds the app for production.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Runs TypeScript type checking.
- `npm run clean`: Cleans up the `dist/` directory.

## 📖 Project Guidelines

Please review the `AGENTS.md` file in the repository root for detailed guidelines regarding the project structure, module organization, coding style, and commit conventions.

## 📄 License

This project is open-source and licensed under the [Apache License 2.0](LICENSE).
