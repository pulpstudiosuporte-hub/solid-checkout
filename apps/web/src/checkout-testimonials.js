// Older AI drafts stored reviews outside the editor's element collection.
// Consume that list once so hiding/removing a migrated element stays permanent.
export function normalizeCheckoutTestimonials(config) {
  const reviews = Array.isArray(config.testimonials) ? config.testimonials : [];
  if (!reviews.length) return config;
  const elements = [...(config.customElements || [])];
  const ids = new Set(elements.map(item => item.id));
  reviews.forEach((review, index) => {
    if (!review?.name?.trim() || !review?.text?.trim()) return;
    let id = `review_${index + 1}`;
    while (ids.has(id)) id += '_';
    ids.add(id);
    elements.push({
      id, type: 'testimonial', title: review.name, text: review.text,
      rating: review.rating || 5, imageUrl: review.imageUrl || '',
      enabled: true, region: 'main', slot: 0, device: 'all',
      textColor: config.textColor || '#17171a',
      backgroundColor: config.cardBg || '#ffffff',
      iconColor: config.primary || '#17171a',
      iconBackgroundColor: config.inputBg || '#ffffff',
      radius: config.radius ?? 12,
    });
  });
  return { ...config, testimonials: [], customElements: elements };
}
