"use client";

import Image from "next/image";
import { ImagePlus, MapPin } from "lucide-react";
import { useMemo } from "react";

import type { CatalogPrintItem } from "./CatalogPrintPages";

type Props = {
  items: CatalogPrintItem[];
};

const ITEMS_PER_PAGE = 2;

function photoUrl(item: CatalogPrintItem) {
  if (!item.photo_path) return null;
  const params = new URLSearchParams({ path: item.photo_path, v: item.updated_at });
  return `/api/estoque/catalogo/foto?${params.toString()}`;
}

export function CatalogSelectionPrintPages({ items }: Props) {
  const pages = useMemo(() => {
    const result: CatalogPrintItem[][] = [];
    for (let index = 0; index < items.length; index += ITEMS_PER_PAGE) {
      result.push(items.slice(index, index + ITEMS_PER_PAGE));
    }
    return result;
  }, [items]);

  if (!pages.length) return null;

  return (
    <div className="catalog-selection-print-pages" aria-hidden="true">
      {pages.map((page, pageIndex) => (
        <section
          className="catalog-selection-print-page"
          key={`catalog-selection-print-page-${pageIndex + 1}`}
        >
          <div
            className={`catalog-selection-print-grid${page.length === 1 ? " is-single" : ""}`}
          >
            {page.map((item) => {
              const src = photoUrl(item);
              const brandAndModel = [item.brand, item.model].filter(Boolean).join(" · ");

              return (
                <article className="catalog-selection-print-item" key={item.id}>
                  <div className="catalog-selection-print-image">
                    {src ? (
                      <Image
                        src={src}
                        alt={`Foto de ${item.name}`}
                        fill
                        unoptimized
                        sizes="82mm"
                        className="object-cover"
                      />
                    ) : (
                      <div className="catalog-selection-print-placeholder">
                        <ImagePlus aria-hidden="true" />
                      </div>
                    )}
                    <span className="catalog-selection-print-category">{item.category}</span>
                  </div>

                  <div className="catalog-selection-print-body">
                    <div className="catalog-selection-print-heading">
                      <div>
                        <h2>{item.name}</h2>
                        {brandAndModel ? <p>{brandAndModel}</p> : null}
                      </div>
                      <span className="catalog-selection-print-condition">
                        {item.item_condition}
                      </span>
                    </div>

                    <p className="catalog-selection-print-description">
                      {item.description || "Sem observações adicionais."}
                    </p>

                    <div className="catalog-selection-print-stock">
                      <div>
                        <span>Em estoque</span>
                        <strong>
                          {item.quantity} <small>{item.unit_label}</small>
                        </strong>
                      </div>
                      {item.location ? (
                        <p>
                          <MapPin aria-hidden="true" /> {item.location}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <style jsx global>{`
        .catalog-selection-print-pages{display:none}
        @media print{
          html[data-catalog-print-mode="selection"] .catalog-selection-print-pages{
            display:block!important;
            position:absolute!important;
            inset:0 auto auto 0!important;
            width:210mm!important;
            margin:0!important;
            padding:0!important;
            color:#0f172a!important;
            background:#fff!important;
            print-color-adjust:exact;
            -webkit-print-color-adjust:exact;
          }
          .catalog-selection-print-page{
            box-sizing:border-box!important;
            display:flex!important;
            width:210mm!important;
            height:297mm!important;
            margin:0!important;
            padding:8mm!important;
            align-items:center!important;
            justify-content:center!important;
            overflow:hidden!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
            break-after:page!important;
            page-break-after:always!important;
          }
          .catalog-selection-print-page:last-child{
            break-after:auto!important;
            page-break-after:auto!important;
          }
          .catalog-selection-print-grid{
            display:grid!important;
            width:100%!important;
            grid-template-columns:minmax(0,1fr)!important;
            grid-template-rows:repeat(2,136mm)!important;
            gap:5mm!important;
            align-content:center!important;
          }
          .catalog-selection-print-grid.is-single{
            grid-template-rows:136mm!important;
          }
          .catalog-selection-print-item{
            display:grid!important;
            grid-template-columns:82mm minmax(0,1fr)!important;
            min-width:0!important;
            min-height:0!important;
            height:136mm!important;
            overflow:hidden!important;
            border:1px solid #cbd5e1!important;
            border-radius:3mm!important;
            background:#fff!important;
            box-shadow:none!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
          }
          .catalog-selection-print-image{
            position:relative!important;
            min-width:0!important;
            min-height:0!important;
            overflow:hidden!important;
            background:#f1f5f9!important;
          }
          .catalog-selection-print-image img{
            object-fit:cover!important;
          }
          .catalog-selection-print-placeholder{
            display:flex!important;
            width:100%!important;
            height:100%!important;
            align-items:center!important;
            justify-content:center!important;
            color:#94a3b8!important;
          }
          .catalog-selection-print-placeholder svg{
            width:18mm!important;
            height:18mm!important;
          }
          .catalog-selection-print-category{
            position:absolute!important;
            top:3mm!important;
            left:3mm!important;
            z-index:2!important;
            max-width:70mm!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
            white-space:nowrap!important;
            border:1px solid rgba(255,255,255,.9)!important;
            border-radius:999px!important;
            background:rgba(255,255,255,.94)!important;
            padding:1mm 2.2mm!important;
            font-size:8pt!important;
            font-weight:650!important;
            color:#334155!important;
          }
          .catalog-selection-print-body{
            display:flex!important;
            min-width:0!important;
            min-height:0!important;
            flex-direction:column!important;
            gap:3mm!important;
            padding:6mm!important;
            overflow:hidden!important;
          }
          .catalog-selection-print-heading{
            display:flex!important;
            min-width:0!important;
            align-items:flex-start!important;
            justify-content:space-between!important;
            gap:4mm!important;
          }
          .catalog-selection-print-heading>div{
            min-width:0!important;
          }
          .catalog-selection-print-heading h2{
            display:-webkit-box!important;
            margin:0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:3!important;
            font-size:17pt!important;
            line-height:1.12!important;
            font-weight:800!important;
            color:#0f172a!important;
          }
          .catalog-selection-print-heading p{
            display:-webkit-box!important;
            margin:2mm 0 0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:2!important;
            font-size:10pt!important;
            line-height:1.25!important;
            color:#64748b!important;
          }
          .catalog-selection-print-condition{
            flex:0 0 auto!important;
            max-width:30mm!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
            white-space:nowrap!important;
            border:1px solid #bfdbfe!important;
            border-radius:999px!important;
            background:#eff6ff!important;
            padding:1mm 2mm!important;
            font-size:8pt!important;
            font-weight:650!important;
            color:#1d4ed8!important;
          }
          .catalog-selection-print-description{
            display:-webkit-box!important;
            min-height:0!important;
            margin:0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:9!important;
            font-size:10pt!important;
            line-height:1.42!important;
            color:#475569!important;
          }
          .catalog-selection-print-stock{
            display:flex!important;
            min-width:0!important;
            margin-top:auto!important;
            align-items:flex-end!important;
            justify-content:space-between!important;
            gap:4mm!important;
            padding-top:4mm!important;
            border-top:1px solid #e2e8f0!important;
          }
          .catalog-selection-print-stock>div>span{
            display:block!important;
            margin:0 0 1mm!important;
            font-size:8pt!important;
            font-weight:750!important;
            letter-spacing:.08em!important;
            text-transform:uppercase!important;
            color:#94a3b8!important;
          }
          .catalog-selection-print-stock strong{
            display:block!important;
            margin:0!important;
            font-size:24pt!important;
            line-height:1!important;
            color:#1d4ed8!important;
          }
          .catalog-selection-print-stock small{
            font-size:11pt!important;
            font-weight:650!important;
            color:#64748b!important;
          }
          .catalog-selection-print-stock p{
            display:-webkit-box!important;
            max-width:48mm!important;
            margin:0!important;
            overflow:hidden!important;
            -webkit-box-orient:vertical!important;
            -webkit-line-clamp:3!important;
            text-align:right!important;
            font-size:9pt!important;
            line-height:1.25!important;
            color:#64748b!important;
          }
          .catalog-selection-print-stock p svg{
            display:inline-block!important;
            width:3.5mm!important;
            height:3.5mm!important;
            vertical-align:-.6mm!important;
          }
        }
      `}</style>
    </div>
  );
}
