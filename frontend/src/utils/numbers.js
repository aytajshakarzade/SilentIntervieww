export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const average = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
export const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;
