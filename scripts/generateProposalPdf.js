const fs = require("fs");
const path = require("path");

const outputPath = path.resolve(process.cwd(), "Vitra-Propuesta-Comercial.pdf");

const palette = {
  navy: "0.07 0.10 0.15",
  navySoft: "0.12 0.16 0.23",
  amber: "0.96 0.62 0.04",
  coral: "0.90 0.33 0.18",
  white: "1 1 1",
  page: "0.96 0.97 0.98",
  surface: "1 1 1",
  surfaceSoft: "0.93 0.95 0.97",
  text: "0.09 0.13 0.20",
  muted: "0.38 0.44 0.53",
  border: "0.84 0.88 0.92",
};

function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function text(stream, { value, x, y, size = 12, color = palette.text, font = "/F1" }) {
  stream.push("BT");
  stream.push(`${font} ${size} Tf`);
  stream.push(`${color} rg`);
  stream.push(`1 0 0 1 ${x} ${y} Tm`);
  stream.push(`(${escapePdfText(value)}) Tj`);
  stream.push("ET");
}

function rect(stream, { x, y, w, h, color }) {
  stream.push(`${color} rg`);
  stream.push(`${x} ${y} ${w} ${h} re f`);
}

function line(stream, { x1, y1, x2, y2, width = 1, color = palette.border }) {
  stream.push(`${color} RG`);
  stream.push(`${width} w`);
  stream.push(`${x1} ${y1} m`);
  stream.push(`${x2} ${y2} l`);
  stream.push("S");
}

function wrapText(value, maxChars) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function paragraph(stream, { value, x, y, size = 12, color = palette.muted, maxChars = 78, leading = 16 }) {
  const lines = wrapText(value, maxChars);
  lines.forEach((lineText, index) => {
    text(stream, {
      value: lineText,
      x,
      y: y - index * leading,
      size,
      color,
    });
  });
  return y - lines.length * leading;
}

function bulletList(stream, { items, x, y, size = 12, color = palette.text, maxChars = 72, leading = 18 }) {
  let cursor = y;
  items.forEach((item) => {
    const lines = wrapText(item, maxChars);
    text(stream, { value: "•", x, y: cursor, size: size + 1, color });
    lines.forEach((lineText, index) => {
      text(stream, {
        value: lineText,
        x: x + 14,
        y: cursor - index * leading,
        size,
        color,
      });
    });
    cursor -= lines.length * leading + 4;
  });
  return cursor;
}

function buildPdf(pageStreams) {
  const objects = [];
  const kids = [];
  let objectNumber = 3;

  const fontRegularId = objectNumber++;
  const fontBoldId = objectNumber++;
  const pageIds = [];
  const contentIds = [];

  pageStreams.forEach(() => {
    pageIds.push(objectNumber++);
    contentIds.push(objectNumber++);
  });

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push(`2 0 obj\n<< /Type /Pages /Count ${pageStreams.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj`);
  objects.push(`${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  pageStreams.forEach((content, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    kids.push(`${pageId} 0 R`);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream\nendobj`
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function pageOne() {
  const stream = [];
  rect(stream, { x: 0, y: 0, w: 612, h: 792, color: palette.page });
  rect(stream, { x: 0, y: 620, w: 612, h: 172, color: palette.navy });
  rect(stream, { x: 54, y: 640, w: 78, h: 78, color: palette.navySoft });
  text(stream, { value: "V", x: 82, y: 667, size: 30, color: palette.amber, font: "/F2" });
  text(stream, { value: "VITRA", x: 150, y: 710, size: 28, color: palette.white, font: "/F2" });
  text(stream, { value: "Propuesta comercial inicial", x: 150, y: 684, size: 14, color: "0.82 0.86 0.92" });
  text(stream, { value: "Ordena • Vende • Crece", x: 150, y: 660, size: 13, color: "0.96 0.62 0.04" });

  text(stream, { value: "Solución comercial administrada", x: 54, y: 570, size: 24, color: palette.text, font: "/F2" });
  paragraph(stream, {
    value:
      "Vitra es una plataforma pensada para negocios que venden por catálogo, crédito y WhatsApp. Ayuda a cotizar, registrar ventas, llevar pagos y organizar la operación comercial desde un solo lugar.",
    x: 54,
    y: 540,
    size: 13,
    maxChars: 82,
    leading: 18,
  });

  rect(stream, { x: 54, y: 385, w: 240, h: 112, color: palette.surface });
  rect(stream, { x: 318, y: 385, w: 240, h: 112, color: palette.surface });
  line(stream, { x1: 54, y1: 497, x2: 294, y2: 497, width: 1.2 });
  line(stream, { x1: 318, y1: 497, x2: 558, y2: 497, width: 1.2 });

  text(stream, { value: "Plan inicial", x: 74, y: 468, size: 18, color: palette.text, font: "/F2" });
  text(stream, { value: "$99 / mes", x: 74, y: 438, size: 26, color: palette.coral, font: "/F2" });
  paragraph(stream, {
    value:
      "Incluye catálogo online, panel administrativo, productos, cotizaciones, ventas, pagos y resumen para cliente.",
    x: 74,
    y: 412,
    size: 11,
    maxChars: 30,
    leading: 14,
  });

  text(stream, { value: "Implementación", x: 338, y: 468, size: 18, color: palette.text, font: "/F2" });
  text(stream, { value: "$250 pago único", x: 338, y: 438, size: 26, color: palette.coral, font: "/F2" });
  paragraph(stream, {
    value: "Incluye hasta 8 horas de configuración, branding básico, usuarios iniciales y validación general.",
    x: 338,
    y: 412,
    size: 11,
    maxChars: 30,
    leading: 14,
  });

  text(stream, { value: "Qué incluye la implementación", x: 54, y: 334, size: 20, color: palette.text, font: "/F2" });
  bulletList(stream, {
    items: [
      "Creación del entorno del cliente",
      "Configuración inicial del sistema",
      "Carga de branding básico",
      "Ajustes base del front público",
      "Usuarios iniciales",
      "Revisión de objetos principales",
      "Validación general para salir a operar",
    ],
    x: 58,
    y: 306,
    size: 12,
    maxChars: 58,
  });

  text(stream, { value: "Ideal para lanzar una operación ordenada sin depender de hojas sueltas o chats perdidos.", x: 54, y: 72, size: 11, color: palette.muted });
  return stream.join("\n");
}

function pageTwo() {
  const stream = [];
  rect(stream, { x: 0, y: 0, w: 612, h: 792, color: palette.page });
  text(stream, { value: "Alcance y personalización", x: 54, y: 736, size: 24, color: palette.text, font: "/F2" });
  paragraph(stream, {
    value:
      "La implementación inicial cubre la salida a producción del negocio. Si el cliente requiere más personalización de front, reportes o reglas específicas, se cotiza aparte.",
    x: 54,
    y: 706,
    size: 13,
    maxChars: 82,
    leading: 18,
  });

  rect(stream, { x: 54, y: 520, w: 504, h: 126, color: palette.surface });
  line(stream, { x1: 54, y1: 646, x2: 558, y2: 646, width: 1.2 });
  text(stream, { value: "Personalización adicional", x: 74, y: 614, size: 20, color: palette.text, font: "/F2" });
  text(stream, { value: "$25 por hora", x: 74, y: 580, size: 22, color: palette.coral, font: "/F2" });
  text(stream, { value: "o $80 por bloque de 4 horas", x: 230, y: 580, size: 16, color: palette.amber, font: "/F2" });
  bulletList(stream, {
    items: [
      "Cambios fuertes de frontend o experiencia comercial",
      "Reportes y dashboards personalizados",
      "Flujos, automatizaciones o reglas especiales",
      "Secciones nuevas para el storefront",
    ],
    x: 78,
    y: 546,
    size: 12,
    maxChars: 62,
  });

  text(stream, { value: "Modelo comercial sugerido", x: 54, y: 468, size: 20, color: palette.text, font: "/F2" });
  bulletList(stream, {
    items: [
      "Servicio-producto administrado, no SaaS totalmente self-service al inicio",
      "Una base de datos por cliente",
      "Frontend y backend separados por cliente en la etapa inicial",
      "Acompañamiento cercano durante onboarding y primeras semanas",
    ],
    x: 58,
    y: 438,
    size: 12,
    maxChars: 70,
  });

  rect(stream, { x: 54, y: 132, w: 504, h: 170, color: palette.navy });
  text(stream, { value: "Mensaje comercial sugerido", x: 74, y: 268, size: 20, color: palette.white, font: "/F2" });
  paragraph(stream, {
    value:
      "Te implementamos una plataforma para mostrar tu catálogo, hacer cotizaciones, registrar ventas, llevar pagos y organizar tu operación comercial, con acompañamiento inicial para dejarla lista para usar.",
    x: 74,
    y: 236,
    size: 13,
    color: "0.86 0.89 0.94",
    maxChars: 66,
    leading: 18,
  });
  text(stream, { value: "Vitra · Ordena • Vende • Crece", x: 74, y: 164, size: 13, color: palette.amber, font: "/F2" });
  return stream.join("\n");
}

const pdf = buildPdf([pageOne(), pageTwo()]);
fs.writeFileSync(outputPath, pdf, "binary");
console.log(`PDF generado en: ${outputPath}`);
