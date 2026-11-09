import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Student Value 1.984",
    short_name: "Student Value",
    description:
      "Работы, сроки и материалы вашей группы — всё для ежедневной учёбы.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#d6eaf7",
    theme_color: "#d6eaf7",
    orientation: "portrait",
    categories: ["education", "productivity"],
    lang: "ru",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
