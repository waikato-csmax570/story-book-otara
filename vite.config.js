import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/story-book-otara/",
  plugins: [react()],
});
