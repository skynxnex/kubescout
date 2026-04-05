# Dashboard Frontend

Modern Kubernetes service monitoring dashboard with multiple visual themes and animated backgrounds.

## 📁 Directory Structure

```
dashboard/
├── css/
│   ├── shared/
│   │   └── base.css              # Base layout & structure (theme-agnostic)
│   └── themes/
│       ├── cyberpunk.css         # 🤖 Cyberpunk theme (default)
│       ├── summer.css            # ☀️ Summer theme
│       ├── starwars.css          # ⭐ Star Wars theme + starfield
│       ├── matrix.css            # 💚 Matrix theme + digital rain
│       ├── autumn.css            # 🍂 Autumn theme + falling leaves
│       └── crimson.css           # 🔴 Crimson theme
├── js/
│   ├── modern/
│   │   ├── theme.js              # Theme management (dark/light)
│   │   ├── animations.js         # Animation helpers
│   │   ├── ui-components.js      # UI rendering components
│   │   ├── incremental-updates.js # Incremental data updates
│   │   ├── matrix-rain.js        # 💚 Matrix digital rain animation
│   │   ├── autumn-leaves.js      # 🍂 Falling leaves animation
│   │   └── starfield.js          # ⭐ Star Wars starfield animation
│   └── modern-cyberpunk/
│       ├── main-modern-cyberpunk-local.js  # Main entry point
│       ├── state-manager.js      # State persistence
│       └── state-manager.test.js # Unit tests
└── dashboard-local.html          # Main HTML file

```

## 🎨 Themes

6 unique visual themes with distinct color schemes:

| Theme | Icon | Colors | Animation |
|-------|------|--------|-----------|
| Cyberpunk | 🤖 | Cyan/Magenta neon | Gradient orbs |
| Summer | ☀️ | Yellow/Pink | Gradient orbs |
| Star Wars | ⭐ | Yellow/Blue/Red | ✨ Starfield |
| Matrix | 💚 | Green on Black | ✨ Digital rain |
| Autumn | 🍂 | Green/Orange/Red | ✨ Falling leaves |
| Crimson | 🔴 | Red/Blue | Gradient orbs |

See [/THEMES.md](/THEMES.md) for detailed documentation.

## 🎬 Animated Backgrounds

Three themes feature custom canvas-based animations:

### Matrix Digital Rain (`matrix-rain.js`)
- Classic falling green characters
- Mix of Katakana, Latin alphabet, and numbers
- White "spark" characters at column fronts
- Optimized speed for comfortable viewing

### Autumn Falling Leaves (`autumn-leaves.js`)
- Realistic leaf shapes (not circles)
- Multiple autumn colors
- Natural swaying and rotation
- Size variety for depth

### Star Wars Starfield (`starfield.js`)
- Stars moving outward from center
- Hyperspace acceleration effect
- Star Wars yellow (#ffe81f)
- Twinkling stars for depth

## 🏗️ Architecture

### Theme System
- **Base CSS**: Theme-agnostic layout and structure
- **Theme CSS**: Color variables and theme-specific styling
- **CSS Variables**: All themes use same variable names for consistency
- **localStorage**: Theme preference persisted across sessions

### Animation System
- **Canvas-based**: HTML5 Canvas for smooth 60 FPS animations
- **Auto-managed**: Start/stop automatically on theme change
- **Performance**: Low CPU usage (< 5%), scales with screen size
- **Responsive**: Automatically adjusts to window resize

### State Management
- **Modular**: Separated into `state-manager.js`
- **Config-driven**: Single STATE_FIELDS array defines all state
- **Tested**: 90% test coverage with unit tests
- **Reusable**: Can be imported by other dashboards

### Component System
- **Modular**: UI components in `ui-components.js`
- **Incremental updates**: Only re-render changed services
- **Performance**: Minimal DOM manipulation
- **Accessibility**: Keyboard navigation support

## 🔧 Development

### File Organization

**CSS Organization:**
- `base.css`: Structure, layout, spacing (no colors)
- Theme files: Only color variables and theme-specific tweaks
- Shared naming: All themes use identical CSS variable names

**JavaScript Modules:**
- ES6 modules with explicit imports/exports
- Pure functions for testability
- Single responsibility principle
- Config-driven where possible

### Adding a New Theme

1. **Create CSS file**: `css/themes/mytheme.css`
```css
:root {
  --cyber-bg-dark: #yourcolor;
  --text-primary: #yourcolor;
  /* ... other variables ... */
}
```

2. **Add to HTML**: Update theme dropdown in `dashboard-local.html`
```html
<option value="mytheme">My Theme</option>
```

3. **Add icon**: Update `THEME_ICONS` in `main-modern-cyberpunk-local.js`
```javascript
const THEME_ICONS = {
  // ...
  mytheme: '🎨'
};
```

4. **Optional animation**: Create `js/modern/myanimation.js`
```javascript
export function initMyAnimation() { /* ... */ }
export function stopMyAnimation() { /* ... */ }
```

5. **Integrate animation**: Update `handleThemeAnimations()`
```javascript
if (theme === 'mytheme') initMyAnimation();
```

### Testing

Run state management tests:
```bash
npm install
npm test
```

### Performance Tips

- Keep animation particle count reasonable (< 500)
- Use `requestAnimationFrame` for smooth rendering
- Clean up canvas/listeners on theme change
- Test on lower-end devices

## 📱 Browser Support

- Chrome/Edge 90+ (recommended)
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive design)

**Required features:**
- ES6 modules
- Canvas API
- CSS custom properties
- localStorage
- backdrop-filter (for frosted glass effect)

## 🐛 Known Issues

None currently. See [GitHub Issues](../../issues) for tracking.

## 📝 Code Style

- **ES6+**: Modern JavaScript features
- **DRY**: Config-driven to avoid duplication
- **SOLID**: Single responsibility, dependency injection
- **Testable**: Pure functions, separated concerns
- **Documented**: JSDoc comments for public APIs

## 🚀 Future Ideas

See [/src/main/resources/dashboard/js/modern-cyberpunk/IMPROVEMENTS.md](js/modern-cyberpunk/IMPROVEMENTS.md) for refactoring notes.

**Potential theme additions:**
- Ocean theme with wave animation
- Space theme with planets
- Retro theme with pixel art
- Minimalist theme (flat design)

**Potential features:**
- Theme preview in selector
- Custom theme builder
- Animation speed control
- Color customization

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0 (with themes & animations)
