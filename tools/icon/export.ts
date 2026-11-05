import { SCALE, SIZE, paintBackground, paintForeground, paintFull } from './paint';

// Renders one icon layer at 1024x1024 for a headless browser screenshot (see export.sh):
// export.html?part=icon-only | icon-foreground | icon-background
const part = new URLSearchParams(location.search).get('part') ?? 'icon-only';
const canvas = document.createElement('canvas');
canvas.width = SIZE;
canvas.height = SIZE;
const ctx = canvas.getContext('2d')!;
if (part === 'icon-foreground') paintForeground(ctx, SCALE.adaptive);
else if (part === 'icon-background') paintBackground(ctx);
else paintFull(ctx);
document.body.append(canvas);
