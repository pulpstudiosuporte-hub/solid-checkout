export const isReviewElement = (type) =>
  type === "testimonial" || type === "reviews";

export const elementMediaClassName = (baseClass, type) =>
  `${baseClass}${isReviewElement(type) ? " testimonial-avatar" : ""}`;

export const elementMediaAlt = (item = {}) => {
  const customAlt = String(item.imageAlt || "").trim();
  if (customAlt) return customAlt;
  if (!isReviewElement(item.type)) return "";
  const author = String(item.title || "").trim();
  return author ? `Foto de ${author}` : "Foto do cliente";
};
