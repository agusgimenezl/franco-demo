import CardImage from './CardImage'

export default function ProductCarousel({ cards }) {
  if (!cards || cards.length === 0) return null

  return (
    <div className="flex justify-start">
      <div className="flex w-full max-w-[90%] gap-3 overflow-x-auto pb-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="w-40 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="aspect-[4/3] w-full bg-slate-100">
              <CardImage src={card.foto_principal} alt={card.titulo} />
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-sm font-medium text-slate-800">{card.titulo}</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-700">{card.precio}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
