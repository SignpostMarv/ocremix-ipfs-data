import {
	Album,
} from '../../module';
import {
	html,
	render,
	TemplateResult,
} from '../../lit-html/lit-html.js';
import {
	asyncReplace,
} from '../../lit-html/directives/async-replace.js';
import { Albums } from '../../data/albums.js';
import {
	yieldFilesProgress,
	GetAllFactory,
} from './app-info/bulk-album-actions.js';
import {
	ocremixCID,
} from '../data.js';
import {
	yieldPlaceholderThenPicture,
} from '../utilities/elements.js';

const appInfo = document.createElement('main');
const storageEstimate = document.createElement('table');
const bulkAlbumActions = document.createElement('ol');
let rendered = false;

appInfo.classList.add('app-info');
bulkAlbumActions.classList.add('albums');
storageEstimate.border = '1';

async function* yieldStorageEstimate(
	estimate: number
): AsyncGenerator<string> {
	yield 'calculating...';

	let divisor = 0;

	const labels = [
		'b',
		'kb',
		'mb',
		'gb',
		'tb',
	];

	const estimateDisplay = (): string => {
		return `${
			(estimate / (1024 ** divisor)).toFixed(2)
		}${
			labels[divisor]
		}`;
	}

	while (
		(estimate / (1024 ** divisor)) > 1 &&
		divisor < labels.length
	) {
		yield estimateDisplay();

		++divisor;
	}
}

async function updateStorageEstimate(
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

export async function* yieldBulkAlbumAction(
	appInfo: HTMLElement,
	id: string,
	getAlbum: () => Promise<Album>
): AsyncGenerator<string|TemplateResult> {
	yield `Loading ${id}`;

	const album = await getAlbum();
	const pathsForApp: Array<string> = [];
	const imageSourcesForAlubm = album.art.covers;

	const filesInIpfs = Object.fromEntries(
		Object.entries(await ocremixCID).filter(
			(entry) => {
				return entry[0].startsWith(album.path);
			}
		)
	);

	imageSourcesForAlubm.push(album.art.background);

	Object.values(album.discs).forEach((tracks) => {
		tracks.forEach((track) => {
			pathsForApp.push(album.path + track.subpath);
		});
	});

	imageSourcesForAlubm.forEach((source) => {
		pathsForApp.push(album.path + source.subpath);

		source.srcset.forEach((srcset) => {
			pathsForApp.push(album.path + srcset.subpath);
		});
	});

	const filesForApp = Object.fromEntries(
		Object.entries(filesInIpfs).filter((entry) => {
			return pathsForApp.includes(entry[0]);
		})
	);

	yield html`
		${asyncReplace(
			yieldFilesProgress(
				id,
				appInfo,
				filesForApp,
				'for-app',
				'Files cached for use in app'
			)
		)}
		${asyncReplace(
			yieldFilesProgress(
				id,
				appInfo,
				filesInIpfs,
				'for-ipfs',
				'Files cached from IPFS source'
			)
		)}
		${asyncReplace(yieldPlaceholderThenPicture(
			'Loading...',
			album,
			album.art.covers[0]
		))}
		<div>
			<button
				aria-label="Clear all cached files for ${album.name}"
				data-action="remove"
				type="button"
				disabled
				@click=${async (): Promise<void> => {
					alert('not yet implemented!');
				}}
			>🗑</button>
			<button
				aria-label="Get all needed files for ${album.name}"
				data-action="get-all"
				type="button"
				disabled
				@click=${GetAllFactory(appInfo, filesForApp, filesInIpfs, id)}
			>🔽</button>
		</div>
	`;
}

async function updateBulkAlbumActions(
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

export async function updateAppInfo(): Promise<HTMLElement> {
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
		updateStorageEstimate(storageEstimate),
		updateBulkAlbumActions(bulkAlbumActions),
	]);

	return appInfo;
}
