import { PAGEBREAK_MARKER } from './render';

/**
 * Split rendered blocks across fixed-height pages by measuring laid-out DOM
 * children. `children[i]` corresponds to `blocks[i]`. Honors explicit page-break
 * markers and pushes overflowing blocks to the next page. Returns blocks grouped
 * per page (HTML strings, page-break markers omitted).
 */
export function paginate(children: HTMLElement[], blocks: string[], contentH: number): string[][] {
	const result: string[][] = [[]];
	let pageIdx = 0;
	let shift = 0;
	let pageBottom = contentH;
	const SAFETY = 2;

	for (let i = 0; i < children.length; i++) {
		const block = blocks[i];
		const el = children[i];
		if (block === PAGEBREAK_MARKER) {
			if (result[pageIdx].length > 0) {
				pageIdx++;
				result.push([]);
				const nextEl = children[i + 1];
				const nextTop = nextEl ? nextEl.offsetTop : el.offsetTop + el.offsetHeight;
				shift = pageIdx * contentH - nextTop;
				pageBottom = (pageIdx + 1) * contentH;
			}
			continue;
		}
		const top = el.offsetTop + shift;
		const bot = top + el.offsetHeight;
		if (bot > pageBottom - SAFETY && result[pageIdx].length > 0) {
			shift += pageBottom - top;
			pageIdx++;
			result.push([]);
			pageBottom = (pageIdx + 1) * contentH;
		}
		result[pageIdx].push(block);
	}
	return result;
}
