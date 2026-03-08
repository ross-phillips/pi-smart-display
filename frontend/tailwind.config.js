/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        '3xl': '2560px',  // 4K TVs and large monitors
        '4xl': '3200px',  // native 4K
      },
      fontSize: {
        'xs': '1rem',      // 16px (was 12px)
        'sm': '1.125rem',  // 18px (was 14px)
        'base': '1.25rem', // 20px (was 16px)
        'lg': '1.5rem',    // 24px (was 18px)
        'xl': '1.875rem',  // 30px (was 20px)
        '2xl': '2.25rem',  // 36px (was 24px)
        '3xl': '3rem',     // 48px (was 30px)
        '4xl': '3.75rem',  // 60px (was 36px)
        '5xl': '4.5rem',   // 72px (was 48px)
        '6xl': '6rem',     // 96px (was 60px)
      }
    },
  },
  plugins: [],
}
