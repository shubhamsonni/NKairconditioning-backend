import { Router } from "express";
import { randomInt } from "node:crypto";
import catalog from "./data/catalog.json";

export const catalogRouter = Router();
const summaries = catalog.services.map(({ gallery, videos, ...service }) => ({
  ...service, mediaCount: gallery.length + videos.length,
}));
const media = new Map(catalog.services.map(service => [service.slug, [
  ...service.gallery.map(src => ({ src, type: "image" as const })),
  ...service.videos.map(src => ({ src, type: "video" as const })),
]]));

catalogRouter.get("/hero", (_req, res) => {
  const pool = catalog.services.filter(service => service.gallery.length > 0);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const projects = pool.slice(0, 3).map(service => ({
    image: service.gallery[randomInt(service.gallery.length)],
    eyebrow: "Our recent AC projects", title: service.name, text: service.description,
  }));
  res.set("Cache-Control", "no-store").json({ slides: [
    { image: "/work/shop/shop.webp", eyebrow: "N K Airconditioning", title: "Your local cooling specialists", text: "Visit our shop for AC installation, repair and maintenance support." },
    ...catalog.heroSlides, ...projects,
  ] });
});

catalogRouter.get("/services", (_req, res) => {
  res.set("Cache-Control", "public, max-age=60").json({ services: summaries });
});

catalogRouter.get("/services/:slug", (req, res) => {
  const service = summaries.find(service => service.slug === req.params.slug);
  if (!service) return res.status(404).json({ message: "Category not found." });
  res.set("Cache-Control", "public, max-age=60").json({ service });
});

catalogRouter.get("/services/:slug/media", (req, res) => {
  const items = media.get(req.params.slug);
  if (!items) return res.status(404).json({ message: "Category not found." });
  const rawPage = req.query.page ?? "1";
  if (typeof rawPage !== "string" || !/^[1-9]\d*$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage))) {
    return res.status(400).json({ message: "Page must be a positive integer." });
  }
  const page = Number(rawPage);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  if (page > totalPages) return res.status(404).json({ message: "Page not found." });
  const start = (page - 1) * pageSize;
  res.set("Cache-Control", "public, max-age=60").json({
    items: items.slice(start, start + pageSize), page, pageSize, total: items.length, totalPages,
  });
});
