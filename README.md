# For Ayushi ❤️ — Interactive Surprise Website

A beautiful, modern, and highly interactive surprise web application created by **Shivam** for **Ayushi**. This single-page web app utilizes rich visual styling, smooth transitions, particles, background video & music, and a Spotify-style synced lyrics engine to celebrate their journey and memories together.

## 🌟 Features

1. **Welcome Screen**
   - Elegant entry page with a dark-theme blur overlay and background video.
   - Glassmorphic card prompting to "Open Surprise".
   - Initiates background music upon user interaction (bypassing browser autoplay restrictions).

2. **Choose Envelope (Main Menu)**
   - Ambient floating particle sparkles and tiny hearts.
   - A grid of five interactive glassmorphic cards representing envelope categories.
   - Custom hover states, staggered entry animations, and integrated sound wave indicator.

3. **Our Memories**
   - Immersive gallery containing photo cards of special shared moments.
   - Staggered card fade-in.
   - Lightbox view displaying zoomed-in images alongside rich, romantic narrative reflections.

4. **My Letter**
   - Interactive digital envelope wrapper.
   - Clicking the envelope initiates a flipping flap animation to smoothly reveal a handwritten letter from Shivam.

5. **Why I Love You**
   - Staggered and animated list displaying 10 heartfelt reasons why she is special.
   - Subtle pulse animations on decorative heart icons.

6. **Next Date When? (RSVP Ticket)**
   - Ticket-themed card divider style container.
   - Interactive RSVP inputs to pick the date and time of the next meetup.
   - Custom formatted timezone-aware date response displaying: *"It's a date! ❤️"*
   - Canvas-confetti explosion trigger upon confirmation.

7. **Our Song (Spotify Synced Player)**
   - Full-fledged custom audio player layout mirroring Spotify's UI.
   - Smoothly synced, scrolling lyric highlight engine for *Stephen Sanchez - Until I Found You*.
   - Clickable lyric lines that let the listener skip directly to specific timestamps.
   - Seeking/scrubbing by clicking the progress track bar, custom time formatters, and Skip Back/Forward button seeking.

---

## 🛠️ Technology Stack

- **Core Structure**: HTML5 (Semantic and accessible markup)
- **Styling**: Vanilla CSS3
  - CSS custom properties (variables) for theme control.
  - Glassmorphic designs (using `backdrop-filter: blur`).
  - Staggered animation triggers via custom inline variables (`--item-index`).
  - Dark-theme styling.
- **Logic**: Vanilla ES6+ JavaScript
- **Libraries**:
  - [Lucide Icons](https://lucide.dev/) (For clean, modern SVG iconography)
  - [Canvas Confetti](https://github.com/catdad/canvas-confetti) (For the celebratory RSVP burst effect)
- **Typography**: Google Fonts (*Caveat*, *Inter*, *Playfair Display*)

---

## 📁 Project Structure

```text
website/
├── assets/
│   ├── bg_music.mp3      # Audio file (Stephen Sanchez - Until I Found You)
│   ├── bgvideo.mp4       # Background video loop
│   ├── bgvideo1.mp4      # Alternate background video
│   ├── memory1.png       # Album artwork & Memory 1
│   ├── memory2.png       # Memory 2
│   ├── memory3.png       # Memory 3
│   ├── memory4.png       # Memory 4
│   ├── memory5.png       # Memory 5
│   └── memory6.png       # Memory 6
├── index.html            # Main markup and structure of screens/modals
├── style.css             # Layout, visual styling, animations, and keyframes
├── app.js                # Routing, state management, particle engine, and lyrics sync
└── README.md             # Project documentation (this file)
```

---

## 🚀 How to Run Locally

Because the web application relies on loading media files (MP3/MP4) and fetching local paths, some modern web browsers might block media resources or scripts if opened directly via `file://`. It is recommended to serve the directory locally.

### Option 1: VS Code Live Server
1. Open the project folder in **VS Code**.
2. Install the **Live Server** extension.
3. Click the **Go Live** button at the bottom-right corner of the editor.

### Option 2: Python HTTP Server
If you have Python installed, open your terminal (PowerShell, Command Prompt, etc.) inside the project folder and run:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

### Option 3: Node.js (http-server)
If you have Node.js and `npm` installed:
```bash
npx http-server .
```
Then visit the URL displayed in your terminal.
