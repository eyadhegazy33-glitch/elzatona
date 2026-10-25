import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Customer } from "../services/customers";
import { CustomerCard } from "./CustomerCard";

export type PrintableCustomerCard = {
  customer: Customer;
  qrDataUrl: string;
  studentTypeName: string;
};

export function CustomerCardPrint({ cards }: {
  cards: PrintableCustomerCard[];
  labels?: {
    qrCode?: string;
    expires?: string;
    noExpiry?: string;
  };
}) {
  const { i18n } = useTranslation();
  const pages = useMemo(() => {
    const result: PrintableCustomerCard[][] = [];
    for (let index = 0; index < cards.length; index += 10) {
      result.push(cards.slice(index, index + 10));
    }
    return result;
  }, [cards]);

  if (cards.length === 0) return null;

  return (
    <section aria-hidden="true" className="customer-print-area">
      {pages.map((page, pageIndex) => (
        <div className="customer-print-sheet" key={pageIndex}>
          <div className="customer-print-grid">
            {page.map(({ customer, qrDataUrl, studentTypeName }) => (
              <CustomerCard
                customer={{
                  fullName: customer.full_name,
                  studentType: studentTypeName,
                  birthDate: new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: "medium",
                  }).format(
                    new Date(`${customer.birth_date.slice(0, 10)}T12:00:00`),
                  ),
                  code: customer.code,
                }}
                key={customer.id}
                qrDataUrl={qrDataUrl}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
