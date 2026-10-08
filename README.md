# CropPDF Studio & CV Screenshot Compiler

> **Ultra-fast, 100% client-side PDF Cropper, Visual Snipping Tool, Redactor, and CV Screenshot Compiler.**

CropPDF Studio is a high-performance, private, in-browser document workbench. It allows users to snip exact regions, trim document margins losslessly, cut out unwanted watermarks/headers, and compile fragmented screenshot snippets (from LinkedIn, Canva, mobile previews, or job boards) into a unified, clean, print-ready CV/Resume.

---

## ✨ Features

### 1. 📄 CV Screenshot Compiler
* **Instant Clipboard Paste (`Ctrl + V`)**: Copy any screenshot (`Win + Shift + S` or `Cmd + Shift + 4`) and paste directly into the studio.
* **Live In-App Screen Snip**: Capture any window or tab live with an interactive crosshair cropper.
* **Multi-Image Ingestion**: Drag & drop or upload multiple image files (`PNG`, `JPG`, `WebP`).
* **Interactive Section Reordering**: Drag-and-drop timeline to arrange your CV sections (*Header & Bio*, *Work Experience*, *Skills & Education*, *Projects*).
* **Slice Precision Trimmer**: Shave off battery bars, mobile status indicators, browser URLs, or duplicate text overlap with an auto-whitespace detector.
* **Harmonize White Background**: Normalizes slight off-white or grayish tint variations between different screenshots to pure `#ffffff` so pieces blend with zero patchwork seams.
* **Text Crispness Booster**: Automatically deepens text contrast for razor-sharp readability.
* **A4 & US Letter Pagination**: Real-time layout on authentic paper sheets with automatic page breaks and margins, or view as a continuous single sheet.
* **1-Click PDF Export**: Generates print-ready vector-sized PDF pages using `pdf-lib`.

### 2. ✂️ PDF Studio & Cropper
* **Interactive Marquee Cropping**: 8-point handles, rule-of-thirds grid, and aspect ratio locks (`Free`, `1:1`, `4:3`, `16:9`, `A4`, `US Letter`).
* **Magic Auto-Crop**: Detects content boundaries and snaps tightly around text and graphics.
* **Lossless Vector Trimming**: Trims PDF `MediaBox` and `CropBox` without rasterization—preserving searchable text and vector quality.
* **Permanent Cut-Out / Redaction**: Erase or black out unwanted watermarks, stamps, or sensitive data.
* **Cross-Tool Synergy**: Send any cropped section of an existing PDF directly into the CV Compiler queue with one click.

---

## 🚀 Quick Start

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+) installed.

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/littlellama77/pdf-crop-studio.git
   cd pdf-crop-studio
   ```

2. Start the local server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   *(or customize port: `PORT=3005 npm start`)*

---

## 🛠️ Technology Stack

* **Frontend**: Vanilla HTML5, Vanilla JavaScript (ES6+), Modern Vanilla CSS3.
* **PDF Processing**: 
  * [PDF.js](https://mozilla.github.io/pdf.js/) for high-precision vector rendering.
  * [pdf-lib](https://pdf-lib.js.org/) for in-browser PDF creation, manipulation, and embedding.
* **Typography**: Outfit & Inter (Google Fonts).
* **Privacy**: 100% Client-Side. No files or images are sent to any external server.

---

## 📄 License

MIT License. Free for personal and commercial use.
