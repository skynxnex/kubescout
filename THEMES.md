# Dashboard Themes & Animations

## 🎨 Available Themes

The dashboard includes 6 unique visual themes with distinct color schemes and animations:

### 1. **Cyberpunk** 🤖 (Default)
- **Colors**: Cyan and magenta neon lights
- **Style**: Futuristic tech aesthetic with glowing accents
- **Background**: Subtle gradient orbs with grid overlay
- **Best for**: Night mode, cyberpunk enthusiasts

### 2. **Summer** ☀️
- **Colors**: Bright yellow and pink
- **Style**: Vibrant, energetic beach vibes
- **Background**: Warm gradient orbs
- **Best for**: Daytime work, positive energy

### 3. **Star Wars** ⭐
- **Colors**: Iconic yellow text with blue and red accents
- **Style**: Deep space aesthetic, lightsaber glows
- **Background**: **Animated starfield** - Moving stars with hyperspace effect
- **Animation**: Stars move outward from center, creating a traveling-through-space feel
- **Best for**: Star Wars fans, space enthusiasts

### 4. **Matrix** 💚
- **Colors**: Classic green-on-black terminal
- **Style**: Hacker terminal aesthetic with Courier New font
- **Background**: **Animated digital rain** - Falling green characters like The Matrix
- **Animation**: Katakana, Latin, and numeric characters cascade down the screen
- **Best for**: Terminal enthusiasts, Matrix fans, retro computing

### 5. **Autumn** 🍂
- **Colors**: Warm fall colors - olive green, orange, yellow, red
- **Style**: Cozy harvest vibes with rustic charm
- **Background**: **Animated falling leaves** - Realistic autumn leaves drifting down
- **Animation**: Leaves in various fall colors fall and sway naturally with rotation
- **Best for**: Autumn lovers, warm aesthetic preference

### 6. **Crimson** 🔴
- **Colors**: Crimson red (#E90017) with blue accents
- **Style**: Clean, professional brand aesthetic
- **Background**: Minimal gradient orbs
- **Best for**: Red theme preference, brand consistency

## 🎬 Animated Backgrounds

Three themes feature custom canvas-based animations for enhanced visual experience:

### Matrix Digital Rain
- **Technology**: HTML5 Canvas rendering
- **Characters**: Mix of Japanese Katakana (ｦｱｳｴｵ...), Latin alphabet, and numbers
- **Features**:
  - Bright white "spark" characters at the front of each column
  - Trailing green characters that fade
  - Optimized speed for comfortable viewing while working
  - Minimal performance impact
- **Performance**: ~60 FPS, low CPU usage

### Autumn Falling Leaves
- **Technology**: HTML5 Canvas with custom leaf shapes
- **Features**:
  - Realistic leaf shapes (not simple circles)
  - Multiple autumn colors: beige, orange, yellow, red, olive green
  - Natural falling motion with swaying and rotation
  - Various leaf sizes for depth perception
  - Subtle highlights for 3D effect
- **Performance**: ~60 FPS, density scales with screen size

### Star Wars Starfield
- **Technology**: HTML5 Canvas particle system
- **Features**:
  - Stars move outward from center (hyperspace effect)
  - Star Wars yellow color (#ffe81f)
  - Twinkling stars for depth
  - Gradual acceleration for dramatic effect
  - Glow effect on brighter stars
- **Performance**: ~60 FPS with 200 stars

## 🎯 Theme Badge

Each theme displays a unique emoji icon in the upper left corner:
- 🤖 Cyberpunk
- ☀️ Summer
- ⭐ Star Wars
- 💚 Matrix
- 🍂 Autumn
- 🔴 Crimson

The badge includes:
- Hover effect with scale and glow
- Frosted glass background
- Consistent positioning across all themes

## 💡 Transparent Pod Details

Pod details (when expanded) feature a frosted glass effect:
- Semi-transparent background to show animations
- `backdrop-filter: blur(10px)` for readability
- Maintains text contrast while allowing background visibility
- Works across all themes

## Technical Implementation

### Animation System

Animations are managed by the Vue 3 component `js/components/ThemeAnimations.js`. It watches the active theme from `themeStore` and starts/stops the appropriate canvas animation:

- `js/modules/matrix-rain.js` — Matrix digital rain
- `js/modules/starfield.js` — Star Wars starfield
- `js/modules/autumn-leaves.js` — Autumn falling leaves

### Canvas Management
- Each animation uses a dedicated canvas element
- Canvas is removed from DOM when theme changes
- Automatic resize handling on window resize
- Positioned with `z-index: -1` to stay behind content

### Performance Considerations
- RequestAnimationFrame for smooth 60 FPS
- Particle/character count scales with screen size
- Minimal CPU usage (< 5% on modern hardware)
- No impact on dashboard functionality

## Theme Selection

Themes can be changed via the dropdown in the control panel:
1. Click the theme selector dropdown
2. Choose your preferred theme
3. Theme switches instantly (no page reload required)
4. Selection is persisted in localStorage

Theme preference is saved across sessions and survives page refreshes.

## 📱 Responsive Design

All themes and animations work on:
- Desktop (1920x1080 and higher)
- Laptop (1366x768)
- Tablet (portrait and landscape)
- Mobile (responsive breakpoints at 768px)

Animations automatically adjust density and performance based on screen size.

## Adding New Themes

To add a new theme:

1. **Create CSS file**: `src/main/resources/dashboard/css/themes/mytheme.css`
2. **Add to dropdowns**: Update the theme selector in `index.html` and `problematic-pods.html`
3. **Optional animation**: Create a canvas animation module in `js/modules/myanimation.js`
4. **Integrate animation**: Wire it into `js/components/ThemeAnimations.js` alongside the existing matrix/starfield/autumn handlers

Example theme CSS structure:
```css
:root[data-theme="mytheme"] {
  --bg-primary: #yourcolor;
  --text-primary: #yourcolor;
  --color-danger: #yourcolor;
  /* ... other color variables ... */
}

/* Hide default backgrounds if using canvas */
.grid-overlay { display: none !important; }
.glow-orb { display: none !important; }

/* Pod cards with transparency */
.pod-card {
  background: rgba(0, 0, 0, 0.02);
  backdrop-filter: blur(10px);
}
```

## 🐛 Troubleshooting

### Animation not showing
- Check browser console for JavaScript errors
- Ensure canvas element exists in DOM
- Verify theme CSS hides default backgrounds

### Performance issues
- Reduce animation speed in source files
- Lower particle/character count
- Check for other CPU-intensive processes

### Theme not persisting
- Check localStorage is enabled in browser
- Clear browser cache and try again
- Verify theme selector onChange handler

---

**Last Updated**: 2026-03-16
**Themes Count**: 6
**Animated Themes**: 3 (Matrix, Autumn, Star Wars)
