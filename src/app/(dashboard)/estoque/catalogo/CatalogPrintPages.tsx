"use client";

import Image from "next/image";
import { ImagePlus, MapPin } from "lucide-react";
import { useMemo } from "react";

export type CatalogPrintItem = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  quantity: number;
  unit_label: string;
  item_condition: string;
  location: string | null;
  description: string | null;
  photo_path: string | null;
  updated_at: string;
};

type Props = {
  establishmentName: string;
  generatedLabel: string;
  items: CatalogPrintItem[];
};

const ITEMS_PER_PAGE = 9;

function photoUrl(item: CatalogPrintItem) {
  if (!item.photo_path) return null;
  const params = new URLSearchParams({ path: item.photo_path, v: item.updated_at });
  return `/api/estoque/catalogo/foto?${params.toString()}`;
}

export function CatalogPrintPages({ establishmentName, generatedLabel, items }: Props) {
  const pages = useMemo(() => {
    const result: CatalogPrintItem[][] = [];
    for (let index = 0; index < items.length; index += ITEMS_PER_PAGE) {
      result.push(items.slice(index, index + ITEMS_PER_PAGE));
    }
    return result;
  }, [items]);

  if (!pages.length) return null;

  return (
    <div className="catalog-print-pages" aria-hidden="true">
      {pages.map((page, pageIndex) => (
        <section className="catalog-print-page" key={`catalog-print-page-${pageIndex + 1}`}>
          <header className="catalog-print-page-header">
            <div>
              <p className="catalog-print-eyebrow">Gestify · Estoque</p>
              <h1>Catálogo de utensílios e equipamentos</h1>
              <p>{establishmentName} · Gerado em {generatedLabel}</p>
            </div>
            <div className="catalog-print-page-summary">
              <strong>{items.length} itens</strong>
              <span>Página {pageIndex + 1} de {pages.length}</span>
            </div>
          </header>

          <div className="catalog-print-page-grid">
            {page.map((item) => {
              const src = photoUrl(item);
              const brandAndModel = [item.brand, item.model].filter(Boolean).join(" · ");

              return (
                <article className="catalog-print-item" key={item.id}>
                  <div className="catalog-print-item-image">
                    {src ? (
                      <Image
                        src={src}
                        alt={`Foto de ${item.name}`}
                        fill
                        unoptimized
                        sizes="62mm"
                        className="object-cover"
                      />
                    ) : (
                      <div className="catalog-print-item-placeholder">
                        <ImagePlus aria-hidden="true" />
                      </div>
                    )}
                    <span className="catalog-print-category">{item.category}</span>
                  </div>

                  <div className="catalog-print-item-body">
                    <div className="catalog-print-item-heading">
                      <div>
                        <h2>{item.name}</h2>
                        {brandAndModel ? <p>{brandAndModel}</p> : null}
                      </div>
                      <span className="catalog-print-condition">{item.item_condition}</span>
                    </div>

                    <p className="catalog-print-description">
                      {item.description || "Sem observações adicionais."}
                    </p>

                    <div className="catalog-print-item-stock">
                      <div>
                        <span>Em estoque</span>
                        <strong>{item.quantity} <small>{item.unit_label}</small></strong>
                      </div>
                      {item.location ? (
                        <p><MapPin aria-hidden="true" /> {item.location}</p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <footer className="catalog-print-page-footer">
            <span>Gestify · {establishmentName}</span>
            <span>9 itens por folha A4 · última folha pode conter menos itens</span>
          </footer>
        </section>
      ))}

      <style jsx global>{`
        .catalog-print-pages{display:none}
        @media print{
          .catalog-print-pages{
            display:block!important;
            position:absolute!important;
            inset:0 auto auto 0!important;
            width:100%!important;
            margin:0!important;
            padding:0!important;
            color:#0f172a!important;
            background:#fff!important;
            print-color-adjust:exact;
            -webkit-print-color-adjust:exact;
          }
          .catalog-print-page{
            box-sizing:border-box!important;
            display:grid!important;
            grid-template-rows:11mm minmax(0,1fr) 5mm!important;
            row-gap:2.2mm!important;
            width:100%!important;
            height:260mm!important;
            max-height:260mm!important;
            margin:0!important;
            padding:0!important;
            overflow:hidden!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
            break-after:page!important;
            page-break-after:always!important;
          }
          .catalog-print-page:last-child{
            break-after:auto!important;
            page-break-after:auto!important;
          }
          .catalog-print-page-header{
            display:flex!important;
            align-items:flex-end!important;
            justify-content:space-between!important;
            gap:5mm!important;
            min-width:0!important;
            padding-bottom:2mm!important;
            border-bottom:1px solid #cbd5e1!important;
          }
          .catalog-print-page-header h1{
            margin:.5mm 0 0!important;
            font-size:13pt!important;
            line-height:1.05!important;
            font-weight:800!important;
            color:#0f172a!important;
          }
          .catalog-print-page-header p{
            margin:.5mm 0 0!important;
            font-size:6.7pt!important;
            line-height:1.15!important;
            color:#64748b!important;
          }
          .catalog-print-eyebrow{
            margin:0!important;
            font-size:6.1pt!important;
            font-weight:700!important;
            letter-spacing:.13em!important;
            text-transform:uppercase!important;
          }
          .catalog-print-page-summary{
            display:flex!important;
            flex-direction:column!important;
            align-items:flex-end!important;
            gap:.5mm!important;
            flex:0 0 auto!important;
            font-size:6.7pt!important;
            color:#64748b!important;
          }
          .catalog-print-page-summary strong{
            font-size:7.6pt!important;
            color:#334155!important;
          }
          .catalog-print-page-grid{
            display:grid!important;
            grid-template-columns:repeat(3,minmax(0,1fr))!important;
            grid-template-rows:repeat(3,62mm)!important;
            gap:2.8mm!important;
            align-content:start!important;
            min-height:0!important;
            overflow:hidden!important;
          }
          .catalog-print-item{
            display:grid!important;
            grid-template-rows:26mm 36mm!important;
            min-width:0!important;
            min-height:0!important;
            height:62mm!important;
            overflow:hidden!important;
            border:1px solid #cbd5e1!important;
            border-radius:2.2mm!important;
            background:#fff!important;
            box-shadow:none!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
          }
          .catalog-print-item-image{
            position:relative!important;
            min-height:0!important;
            overflow:hidden!important;
            background:#f1f5f9!important;
          }
          .catalog-print-item-image img{
            object-fit:cover!important;
          }
          .catalog-print-item-placeholder{
            display:flex!important;
            width:100%!important;
            height:100%!important;
            align-items:center!important;
            justify-content:center!important;
            color:#94a3b8!important;
          }
          .catalog-print-item-placeholder svg{
            width:9mm!important;
            height:9mm!important;
          }
          .catalog-print-category{
            position:absolute!important;
            top:1.4mm!important;
            left:1.4mm!important;
            z-index:2!important;
            max-width:47mm!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
            white-space:nowrap!important;
            border:1px solid rgba(255,255,255,.9)!important;
            border-radius:999px!important;
            background:rgba(255,255,255,.92)!important;
            padding:.5mm 1.2mm!important;
            font-size:5.7pt!important;
            font-weight:600!important;
            color:#334155!important;
          }
          .catalog-print-item-body{
            display:grid!important;
            grid-template-rows:auto auto auto!important;
            align-content:start!important;
            gap:1.1mm!important;
            min-height:0!important;
            overflow:hidden!important;
            padding:1.8mm 2mm!important;
          }
          .catalog-print-item-heading{
            display:flex!important;
            align-items:flex-start!important;
            justify-content:space-between!important;
            gap:1.4mm!important;
            min-width:0!important;
          }
          .catalog-print-item-heading>div{
            min-width:0!important;
          }
          .catalog-print-item-heading h2{
            display:-webkit-box!important;
            margin:0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:2!important;
            font-size:8.1pt!important;
            line-height:1.12!important;
            font-weight:750!important;
            color:#0f172a!important;
          }
          .catalog-print-item-heading p{
            margin:.6mm 0 0!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
            white-space:nowrap!important;
            font-size:6.1pt!important;
            line-height:1.15!important;
            color:#64748b!important;
          }
          .catalog-print-condition{
            flex:0 0 auto!important;
            max-width:17mm!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
            white-space:nowrap!important;
            border:1px solid #bfdbfe!important;
            border-radius:999px!important;
            background:#eff6ff!important;
            padding:.45mm 1mm!important;
            font-size:5.2pt!important;
            font-weight:600!important;
            color:#1d4ed8!important;
          }
          .catalog-print-description{
            display:-webkit-box!important;
            min-height:0!important;
            margin:0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:2!important;
            font-size:6.1pt!important;
            line-height:1.2!important;
            color:#475569!important;
          }
          .catalog-print-item-stock{
            display:flex!important;
            align-items:flex-end!important;
            justify-content:space-between!important;
            gap:1.5mm!important;
            min-width:0!important;
            padding-top:1.2mm!important;
            border-top:1px solid #e2e8f0!important;
          }
          .catalog-print-item-stock>div>span{
            display:block!important;
            margin-bottom:.5mm!important;
            font-size:5.1pt!important;
            font-weight:700!important;
            letter-spacing:.07em!important;
            text-transform:uppercase!important;
            color:#94a3b8!important;
          }
          .catalog-print-item-stock strong{
            display:block!important;
            font-size:10pt!important;
            line-height:1!important;
            color:#1d4ed8!important;
          }
          .catalog-print-item-stock small{
            font-size:6.1pt!important;
            font-weight:600!important;
            color:#64748b!important;
          }
          .catalog-print-item-stock p{
            display:-webkit-box!important;
            max-width:28mm!important;
            margin:0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:1!important;
            text-align:right!important;
            font-size:5.6pt!important;
            line-height:1.15!important;
            color:#64748b!important;
          }
          .catalog-print-item-stock p svg{
            display:inline-block!important;
            width:2.4mm!important;
            height:2.4mm!important;
            vertical-align:-.4mm!important;
          }
          .catalog-print-page-footer{
            display:flex!important;
            align-items:flex-end!important;
            justify-content:space-between!important;
            gap:4mm!important;
            padding-top:1.5mm!important;
            border-top:1px solid #e2e8f0!important;
            font-size:5.8pt!important;
            color:#64748b!important;
          }
        }
      `}</style>
    </div>
  );
}
