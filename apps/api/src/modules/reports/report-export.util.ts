import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

// Table générique — le "moteur" (§54) : un seul export CSV/Excel/PDF réutilisable par tout futur
// type de rapport (le rapport financier ci-contre en est le premier consommateur), au lieu d'un
// export ad hoc par rapport.
export interface ReportTable {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
}

function cell(row: Record<string, string | number>, key: string): string | number {
  return row[key] ?? "";
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(table: ReportTable): Buffer {
  const lines: string[] = [];
  lines.push(table.columns.map((column) => escapeCsvValue(column.label)).join(","));
  for (const row of table.rows) {
    lines.push(table.columns.map((column) => escapeCsvValue(cell(row, column.key))).join(","));
  }
  return Buffer.from(lines.join("\r\n"), "utf-8");
}

export async function buildXlsx(table: ReportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.title.slice(0, 31) || "Rapport");

  sheet.addRow(table.columns.map((column) => column.label));
  sheet.getRow(1).font = { bold: true };
  for (const row of table.rows) {
    sheet.addRow(table.columns.map((column) => cell(row, column.key)));
  }
  table.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = Math.max(12, column.label.length + 2);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

const PDF_MARGIN = 40;
const PDF_ROW_HEIGHT = 20;

export async function buildPdf(table: ReportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PDF_MARGIN, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(table.title);
    if (table.subtitle) {
      doc.fontSize(10).fillColor("#555555").text(table.subtitle);
      doc.fillColor("#000000");
    }
    doc.moveDown();

    const pageBottom = doc.page.height - PDF_MARGIN;
    const columnWidth = (doc.page.width - 2 * PDF_MARGIN) / table.columns.length;

    const drawHeader = () => {
      const y = doc.y;
      doc.fontSize(10).font("Helvetica-Bold");
      table.columns.forEach((column, index) => {
        doc.text(column.label, PDF_MARGIN + index * columnWidth, y, { width: columnWidth });
      });
      doc.font("Helvetica").fontSize(10);
      doc.moveDown();
      doc.moveTo(PDF_MARGIN, doc.y).lineTo(doc.page.width - PDF_MARGIN, doc.y).stroke();
      doc.moveDown(0.3);
    };

    drawHeader();

    for (const row of table.rows) {
      if (doc.y + PDF_ROW_HEIGHT > pageBottom) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      table.columns.forEach((column, index) => {
        doc.text(String(cell(row, column.key)), PDF_MARGIN + index * columnWidth, y, { width: columnWidth });
      });
      doc.moveDown();
    }

    doc.end();
  });
}

export function contentTypeFor(format: "csv" | "xlsx" | "pdf"): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pdf":
      return "application/pdf";
  }
}
