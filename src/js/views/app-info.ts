import {
	html,
	render,
} from '../../lit-html/lit-html.js';
import {
	updateStorageEstimate,
	storageEstimate,
	updateBulkAlbumActions,
	appInfo,
} from './app-info/bulk-album-actions.js';
import {
	updateTitleSuffix,
} from '../utilities/elements.js';

const bulkAlbumActions = document.createElement('ol');
let rendered = false;

bulkAlbumActions.classList.add('albums');

export async function updateAppInfo(): Promise<HTMLElement> {
	updateTitleSuffix('App Info');

	if ( ! rendered) {
		render(
			html`
				<h2>App Info</h2>
				${
					('storage' in navigator)
						? html`
							<h3>Data</h3>
							<h3>Storage Estimate</h4>
							${storageEstimate}
							<h3>Albums</h3>
							${bulkAlbumActions}
						`
						: html`<p>No App Info</p>`
				}
			`,
			appInfo
		);

		rendered = true;
	}

	await Promise.all([
		updateStorageEstimate(),
		updateBulkAlbumActions(bulkAlbumActions),
	]);

	return appInfo;
}
