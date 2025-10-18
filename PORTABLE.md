# Portable Version

## Overview
The `real-timeDisplay-portable.html` file contains the entire Real-Time Display System in a single, self-contained HTML file. No server, network connection, or additional files required.

## Features Included
- ✅ Complete admin interface for schedule management
- ✅ Real-time display with countdown timers
- ✅ Sunday/Friday auto-loading schedules
- ✅ Manual activity controls (start, pause, skip)
- ✅ Announcement system with overlays
- ✅ Fullscreen display support
- ✅ Multi-window synchronization via localStorage
- ✅ Responsive design for different screen sizes
- ✅ All current styling and functionality

## File Details
- **Size**: ~372 KB
- **Dependencies**: None (fully self-contained)
- **Browser Support**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **Network**: Works completely offline

## Usage
1. **Download**: Save `real-timeDisplay-portable.html` to any location
2. **Open**: Double-click or open in any web browser
3. **Use**: Full functionality available immediately

## Use Cases
- 📧 **Email sharing**: Send to team members
- 💾 **USB/Flash drive**: Portable presentation tool
- 🔒 **Offline environments**: No internet required
- 💼 **Travel/Mobile**: Works anywhere
- 🏢 **Corporate networks**: No external dependencies
- 🎯 **Backup solution**: Always-working fallback

## Generating New Portable Versions
When you update the app and want a new portable version:

```bash
npm run build:portable
```

This will:
1. Build the latest Angular app
2. Inline all assets (JS, CSS)
3. Generate a new `real-timeDisplay-portable.html`

## Technical Details
- All JavaScript and CSS assets are inlined
- Base href adjusted for local file system
- Module scripts preserved for modern browser compatibility
- No external dependencies or CDN links
- Complete Angular application preserved

## Sharing
The portable file can be:
- Emailed as an attachment
- Shared via cloud storage
- Copied to USB drives
- Embedded in other systems
- Used as a backup solution

**Note**: The portable version is fully functional and identical to the online version, just packaged for offline/portable use.