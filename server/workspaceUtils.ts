interface GoogleDocElement {
  paragraph?: {
    elements?: Array<{
      textRun?: {
        content?: string;
      };
    }>;
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleDocElement[];
      }>;
    }>;
  };
}

interface GoogleDocPayload {
  body?: {
    content?: GoogleDocElement[];
  };
}

export function extractDocBodyText(docJson: unknown): string {
  if (!docJson || typeof docJson !== 'object') return '';
  const payload = docJson as GoogleDocPayload;
  const elements = payload.body?.content;
  if (!Array.isArray(elements)) return '';

  const chunks: string[] = [];

  const readElements = (list: GoogleDocElement[]) => {
    for (const el of list) {
      if (el.paragraph?.elements) {
        const line = el.paragraph.elements
          .map((item) => item.textRun?.content ?? '')
          .join('');
        if (line.trim()) {
          chunks.push(line.replace(/\n+$/, ''));
        }
      }
      if (el.table?.tableRows) {
        for (const row of el.table.tableRows) {
          const rowCells: string[] = [];
          for (const cell of row.tableCells ?? []) {
            if (cell.content) {
              const cellText = cell.content
                .flatMap((c) => c.paragraph?.elements ?? [])
                .map((e) => e.textRun?.content ?? '')
                .join('')
                .trim();
              if (cellText) rowCells.push(cellText);
            }
          }
          if (rowCells.length > 0) {
            chunks.push(rowCells.join(' | '));
          }
        }
      }
    }
  };

  readElements(elements);
  return chunks.join('\n\n').trim();
}

export function encodeMimeEmail(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const safeTo = params.to.replace(/[\r\n]+/g, ' ').trim();
  const safeSubject = params.subject.replace(/[\r\n]+/g, ' ').trim();
  const mimeLines = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.body,
  ];
  const raw = mimeLines.join('\r\n');
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function extractHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  headerName: string
): string {
  if (!Array.isArray(headers)) return '';
  const target = headerName.toLowerCase();
  const match = headers.find((h) => h.name?.toLowerCase() === target);
  return match?.value ?? '';
}
