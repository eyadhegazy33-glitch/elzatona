import * as XLSX from "xlsx";

export function readCustomerSpreadsheet(data: ArrayBuffer): unknown[][] {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  });
}

export function writeCustomerImportTemplate(exampleRowLabel: string): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["first_name", "last_name", "birth_date", "student_type", "phone"],
    [
      exampleRowLabel,
      "Example",
      "2000-01-01",
      exampleRowLabel,
      "0500000000",
    ],
  ]);
  sheet.A2.c = [
    {
      a: "Elzatona",
      t: exampleRowLabel,
    },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
  XLSX.writeFileXLSX(workbook, "customer_import_template.xlsx");
}

export function excelSerialDateParts(serial: number): {
  year: number;
  month: number;
  day: number;
} | null {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return { year: parsed.y, month: parsed.m, day: parsed.d };
}
