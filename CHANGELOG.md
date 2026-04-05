# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2026-03-07
- **6 Visual Themes** for dashboard with unique color schemes and aesthetics
  - 🤖 Cyberpunk (default) - Cyan/magenta neon futuristic
  - ☀️ Summer - Bright yellow/pink beach vibes
  - ⭐ Star Wars - Deep space with iconic yellow text
  - 💚 Matrix - Green-on-black terminal aesthetic
  - 🍂 Autumn - Warm fall colors (green, orange, yellow, red)
  - 🔴 Crimson - Crimson red (#E90017)

- **Animated Backgrounds** (Canvas-based, 60 FPS)
  - Matrix Digital Rain - Falling green characters (Katakana, Latin, numbers)
  - Autumn Falling Leaves - Realistic leaf shapes with natural motion
  - Star Wars Starfield - Moving stars with hyperspace effect

- **Theme Badge** in upper left corner
  - Displays emoji icon for current theme
  - Hover effect with scale and glow
  - Persists across page reloads

- **Transparent Pod Details**
  - Frosted glass effect (`backdrop-filter: blur(10px)`)
  - Shows background animations through expanded service details
  - Maintains text readability with subtle transparency

### Changed - 2026-03-07
- Pod cards now use very low opacity backgrounds (0.01-0.15 alpha)
- Animation speeds optimized for comfortable viewing while working
- Matrix rain speed reduced by 75% for better background experience
- All themes now include `backdrop-filter` for modern glass effect

### Technical - 2026-03-07
- Created `js/modern/matrix-rain.js` - Canvas-based Matrix animation
- Created `js/modern/autumn-leaves.js` - Canvas-based falling leaves
- Created `js/modern/starfield.js` - Canvas-based Star Wars starfield
- Created CSS files for all 6 themes in `css/themes/`
- Integrated animations with theme system (auto-start/stop on theme change)
- Added theme management to `main-modern-cyberpunk-local.js`

### Documentation - 2026-03-07
- Created `THEMES.md` with comprehensive theme and animation documentation
- Updated `README.md` with theme overview and quick reference table
- Created this `CHANGELOG.md` for tracking changes

## [Previous] - Before 2026-03-07

### Features
- Kubernetes service monitoring dashboard
- Context and namespace selection
- Service filtering (bad, warn, single pod, restarts)
- Real-time pod metrics (CPU, memory usage)
- Expandable service details with pod-level metrics
- Humio log integration
- AWS EKS authentication with auto-retry
- State persistence in localStorage
- Incremental updates for changed services
- Dev/Prod preset support
- Docker multi-arch build (amd64 + arm64)
- RBAC-compliant Kubernetes manifests
- Comprehensive test suite with state management tests

---

**Note**: This changelog follows [Keep a Changelog](https://keepachangelog.com/) format.
