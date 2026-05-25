import PDFDocument from 'pdfkit';

export function generatePdfBuffer(markdown: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const doc = new PDFDocument({
			size: 'A4',
			margins: { top: 72, bottom: 72, left: 72, right: 72 },
			info: {
				Title: 'Document',
				Producer: 'Docs AI'
			}
		});

		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		const lines = markdown.split('\n');
		let i = 0;

		while (i < lines.length) {
			const line = lines[i];

			// Headings
			if (line.startsWith('### ')) {
				doc.moveDown(0.5);
				doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b').text(line.slice(4));
				doc.moveDown(0.3);
				i++;
				continue;
			}
			if (line.startsWith('## ')) {
				doc.moveDown(0.8);
				doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(line.slice(3));
				doc.moveDown(0.4);
				i++;
				continue;
			}
			if (line.startsWith('# ')) {
				doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(line.slice(2), { align: 'center' });
				doc.moveDown(0.5);
				// Draw line under title
				const y = doc.y;
				doc.moveTo(72, y).lineTo(523, y).strokeColor('#94a3b8').lineWidth(1).stroke();
				doc.moveDown(0.5);
				i++;
				continue;
			}

			// Horizontal rule
			if (line.match(/^---+$/)) {
				doc.moveDown(0.5);
				const y = doc.y;
				doc.moveTo(72, y).lineTo(523, y).strokeColor('#94a3b8').lineWidth(0.5).stroke();
				doc.moveDown(0.5);
				i++;
				continue;
			}

			// Unordered list
			if (line.match(/^[\s]*[-*+]\s/)) {
				while (i < lines.length && lines[i]?.match(/^[\s]*[-*+]\s/)) {
					const text = lines[i].replace(/^[\s]*[-*+]\s/, '');
					doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`  • ${stripFormatting(text)}`, { indent: 0 });
					i++;
				}
				doc.moveDown(0.3);
				continue;
			}

			// Ordered list
			if (line.match(/^[\s]*\d+\.\s/)) {
				let num = 1;
				while (i < lines.length && lines[i]?.match(/^[\s]*\d+\.\s/)) {
					const text = lines[i].replace(/^[\s]*\d+\.\s/, '');
					doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`  ${num}. ${stripFormatting(text)}`, { indent: 0 });
					num++;
					i++;
				}
				doc.moveDown(0.3);
				continue;
			}

			// Blockquote
			if (line.startsWith('> ')) {
				const quoteLines: string[] = [];
				while (i < lines.length && lines[i]?.startsWith('> ')) {
					quoteLines.push(lines[i].slice(2));
					i++;
				}
				const startY = doc.y;
				doc.font('Helvetica-Oblique').fontSize(11).fillColor('#3b82f6').text(quoteLines.join(' '), { indent: 20 });
				const endY = doc.y;
				doc.moveTo(72, startY).lineTo(72, endY).strokeColor('#3b82f6').lineWidth(3).stroke();
				doc.moveDown(0.3);
				continue;
			}

			// Code block
			if (line.startsWith('```')) {
				const codeLines: string[] = [];
				i++;
				while (i < lines.length && !lines[i]?.startsWith('```')) {
					codeLines.push(lines[i]);
					i++;
				}
				i++;
				const codeText = codeLines.join('\n');
				const startY = doc.y;
				doc.rect(72, startY - 5, 451, codeLines.length * 14 + 20).fill('#f1f5f9');
				doc.font('Courier').fontSize(10).fillColor('#1e293b').text(codeText, 82, startY + 5, { width: 431 });
				doc.moveDown(0.5);
				continue;
			}

			// Empty line
			if (line.trim() === '') {
				doc.moveDown(0.3);
				i++;
				continue;
			}

			// Regular paragraph
			doc.font('Helvetica').fontSize(11).fillColor('#334155').text(stripFormatting(line));
			doc.moveDown(0.3);
			i++;
		}

		doc.end();
	});
}

function stripFormatting(text: string): string {
	return text
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/`(.+?)`/g, '$1')
		.replace(/\[(.+?)\]\((.+?)\)/g, '$1');
}