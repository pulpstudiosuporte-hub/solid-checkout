import { resolveMediaUrl } from './api';

export default function CheckoutTestimonials({ items }) {
  const reviews = Array.isArray(items) ? items.filter(item => item?.name?.trim() && item?.text?.trim()) : [];
  if (!reviews.length) return null;
  return <section className="checkout-testimonials" aria-label="Depoimentos de clientes">
    {reviews.map((item, index) => <blockquote key={item.id || index}>
      {item.imageUrl && <img src={resolveMediaUrl(item.imageUrl)} alt="" width="46" height="46" loading="lazy"/>}
      <div><span aria-label={`${Math.max(1, Math.min(5, Number(item.rating) || 5))} de 5 estrelas`}>{'★'.repeat(Math.max(1, Math.min(5, Number(item.rating) || 5)))}</span><p>{item.text}</p><b>{item.name}</b></div>
    </blockquote>)}
  </section>;
}
