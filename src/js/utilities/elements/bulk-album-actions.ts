import {
	ocremixCache, fetchBlobViaCacheOrIpfs,
} from '../../data.js';
import {
	html,
	TemplateResult,
} from '../../../lit-html/lit-html.js';

export async function numberOfFilesInCache(
	files: {[path: string]: string}
): Promise<number> {
	let inCache = 0;

	if ('caches' in window) {
		const cache = await ocremixCache();

		for await(
			const isInCache of Object.values(files).map(
				(cid) => {
					const faux = new Request('/ipfs/' + cid);

					return cache.match(faux);
				}
			)
		) {
			if (isInCache) {
				++inCache;
			}
		}
	}

	return inCache;
}

export async function filesByCacheStatus(
	files: {[path: string]: string},
	cached: boolean
): Promise<{[path: string]: string}> {
	const entries = Object.entries(files);
	const filesOfExpectedStatus: Array<string> = [];

	if ('caches' in window) {
		const cache = await ocremixCache();
		for await(
			const [path, cacheStatus] of entries.map(
				async (entry): Promise<[string, boolean]> => {
					const faux = new Request('/ipfs/' + entry[1]);

					const result = await cache.match(faux);

					return [
						entry[0],
						(result instanceof Response)
					];
				}
			)
		) {
			if (cacheStatus === cached) {
				filesOfExpectedStatus.push(path);
			}
		}
	}

	return Object.fromEntries(entries.filter((entry) => {
		return filesOfExpectedStatus.includes(entry[0]);
	}));
}

export async function* yieldFilesProgress(
	id: string,
	appInfo: HTMLElement,
	files: {[path: string]: string},
	className: string,
	title: string
): AsyncGenerator<TemplateResult> {
	const entry = appInfo.querySelector(
		`.entry[data-album="${id}"]`
	);

	if ( ! (entry instanceof HTMLLIElement)) {
		throw new Error(
			'Could not find entry container!'
		);
	}

	yield html`
		<progress
			class="${className}"
			value="0"
			title="${title}: 0 of unknown"
		></progress>
	`;

	const numberOfFilesInIpfs = Object.keys(files).length;

	if (numberOfFilesInIpfs > 0 && 'caches' in window) {
		const inCache = await numberOfFilesInCache(files);

		yield html`
			<progress
				class="${className}"
				title="${title} ${inCache} of ${numberOfFilesInIpfs}"
				value="${
					(inCache / numberOfFilesInIpfs).toString()
				}"
			></progress>
		`;
	}

	const button = ('for-app' === className)
		? entry.querySelector(
			`button[data-action="get-all"]`
		)
		: entry.querySelector(
			`button[data-action="remove"]`
		);

	if ( ! (button instanceof HTMLButtonElement)) {
		throw new Error(`Could not find ${className} button!`);
	}

	button.disabled = false;
}

export function GetAllFactory(
	appInfo: HTMLElement,
	filesForApp: {[path: string]: string},
	filesInIpfs: {[path: string]: string},
	id: string
): () => Promise<void> {
	return async (): Promise<void> => {
		const entry = appInfo.querySelector(
			`.entry[data-album="${id}"]`
		);

		if ( ! (entry instanceof HTMLLIElement)) {
			throw new Error(
				'Could not find entry container!'
			);
		}

		const button = entry.querySelector(
			`button[data-action="get-all"]`
		);
		const progressForApp = entry.querySelector(
			`progress.for-app`
		);
		const progressForIpfs = entry.querySelector(
			`progress.for-ipfs`
		);

		if ( ! (button instanceof HTMLButtonElement)) {
			throw new Error('Could not find button!');
		} else if (
			! (progressForApp instanceof HTMLProgressElement)
		) {
			throw new Error(
				'Could not find progress bar for app!'
			);
		} else if (
			! (progressForIpfs instanceof HTMLProgressElement)
		) {
			throw new Error(
				'Could not find progress bar for IPFS!'
			);
		}

		button.disabled = true;
		entry.classList.add('active');

		const notCachedForApp = await filesByCacheStatus(
			filesForApp,
			false
		);
		const numberOfFilesInIpfs = Object.keys(
			filesInIpfs
		).length;
		const numberOfFilesInApp = Object.keys(
			filesForApp
		).length;

		if (numberOfFilesInIpfs < 1) {
			button.disabled = true;

			return;
		}

		let numberOfCachedForIpfs = await numberOfFilesInCache(
			filesInIpfs
		);
		let numberOfCachedForApp = await numberOfFilesInCache(
			filesForApp
		);

		for await (
			const _blob of Object.keys(notCachedForApp).map(
				(path) => {
					return fetchBlobViaCacheOrIpfs(path);
			})
		) {
			++numberOfCachedForIpfs;
			++numberOfCachedForApp;

			progressForApp.value = (
				numberOfCachedForApp / numberOfFilesInApp
			);

			progressForIpfs.value = (
				numberOfCachedForIpfs / numberOfFilesInIpfs
			);
		}

		button.disabled = true;
		entry.classList.remove('active');
	};
}
