export const isCalm = () => document.documentElement.dataset.calm === "1" || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
