export function publicUrl(path = "") {
  if (!path || path.startsWith("data:") || /^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  if (base !== "/" && path.startsWith(base)) return path;
  return `${base}${String(path).replace(/^\/+/, "")}`;
}
