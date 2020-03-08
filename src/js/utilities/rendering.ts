import {
	html,
	render,
	TemplateResult,
} from '../../lit-html/lit-html.js';
import {
	asyncReplace,
} from '../../lit-html/directives/async-replace.js';
import {
	yieldStorageEstimate,
} from './formatting.js';
import { Albums } from '../../data/albums.js';
import { yieldBulkAlbumAction } from './elements.js';

export async function updateStorageEstimate(
	storageEstimate: HTMLElement
): Promise<void> {
	const estimate = await navigator.storage.estimate();

	if ( ! ('usageDetails' in estimate)) {
		render(
			html`<tbody><tr><td>n/a</td></tr></tbody>`,
			storageEstimate
		);

		return;
	}

	const usageDetails = (
		estimate as (
			StorageEstimate & {
				usageDetails: {
					[usage: string]: number;
				};
			}
		)
	).usageDetails;

	render(
		html`
			<thead>
				<tr>
					<th>Type</th>
					<th>Usage</th>
				</tr>
			</thead>
			<tbody>${
				Object.entries(usageDetails).map((usageEstimate) => {
					return html`
						<tr>
							<th scope="row">${usageEstimate[0]}</th>
							<td>${asyncReplace(yieldStorageEstimate(
								usageEstimate[1]
							))}</td>
						</tr>
					`;
				})
			}</tbody>
		`,
		storageEstimate
	)
}

export async function updateBulkAlbumActions(
	appInfo: HTMLElement,
	bulkAlbumActions: HTMLElement
): Promise<void> {
	render(
		html`${Object.entries(Albums).map((albumEntry) => {
			return html`${asyncReplace(
				(async function* (): AsyncGenerator<TemplateResult> {
					yield html`<li
						tabindex="0"
						class="entry"
						data-album="${albumEntry[0]}"
						data-name="Loading..."
					>Loading...</li>`;

					const album = await albumEntry[1]();

					yield html`<li
						tabindex="0"
						class="entry"
						data-album="${albumEntry[0]}"
						data-name="${album.name}"
					>${
						asyncReplace(yieldBulkAlbumAction(
							appInfo,
						albumEntry[0],
						albumEntry[1]
					))}</li>`;
				})()
			)}`;
		})}`,
		bulkAlbumActions
	);
}
