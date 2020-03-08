import {
	ImageSource,
	Album,
	Track,
} from '../module';
import {
	TemplateResult,
	html,
	render,
} from '../lit-html/lit-html.js';
import {asyncAppend} from '../lit-html/directives/async-append.js';
import {asyncReplace} from '../lit-html/directives/async-replace.js';
import {
	albumTrackCID,
	urlForThing,
	ocremixCID,
	ocremixCache,
	fetchBlobViaCacheOrIpfs,
} from './data.js';
import {Albums} from '../data/albums.js';

(async (): Promise<void> => {
	let currentAlbum: Album|undefined;
	let currentTrack: Track|undefined;
	let trackMostRecentlyAttemptedToPlay: string|undefined;

	const preloads = {
		'style.css': document.head.querySelector(
			'link[rel="preload"][as="style"][href$="/css/style.css"]'
		),
	};

	const back: HTMLAnchorElement|null = document.querySelector(
		'body > header a#load-albums'
	);
	const albums = document.createElement('main');
	const appInfo = document.createElement('main');
	const storageEstimate = document.createElement('table');
	const bulkAlbumActions = document.createElement('ol');
	const views: WeakMap<Album, HTMLElement> = new WeakMap();
	const audio = ((): HTMLAudioElement => {
		const audio = document.createElement('audio');

		audio.controls = true;
		audio.src=  '';

		audio.addEventListener('ended', () => {
			currentTrack = undefined;
		});

		return audio;
	})();

	if ( ! (back instanceof HTMLAnchorElement)) {
		throw new Error('Could not find back button');
	}

	Object.entries(preloads).forEach((entry) => {
		if ( ! (entry[1] instanceof HTMLLinkElement)) {
			throw new Error('Could not find preloaded ' + entry[0]);
		}
	});

	(preloads['style.css'] as HTMLLinkElement).rel = 'stylesheet';

	function play(src: string): void {
		console.log(src);
		if (audio.src !== src) {
			audio.pause();
			audio.src = src;
		}
		audio.play();
	}

	albums.classList.add('albums');
	appInfo.classList.add('app-info');
	storageEstimate.border = '1';
	bulkAlbumActions.classList.add('albums');

	document.body.appendChild(albums);
	document.body.appendChild(audio);

	async function picture(
		album: Album,
		art: ImageSource,
		className = ''
	): Promise<HTMLPictureElement> {
		const src = await urlForThing(art, album.path + art.subpath);
		const srcset = await Promise.all(art.srcset.map(
			async (srcset): Promise<string> => {
				const srcsetSrc = await urlForThing(
					srcset,
					album.path + srcset.subpath
				);

				return srcsetSrc + ' ' + srcset.width.toString(10) + 'w';
			}
		));
		const picture = document.createElement('picture');
		const img = new Image();

		if (srcset.length > 0) {
			srcset.push(src + ' ' + art.width.toString(10) + 'w');
		}

		img.src = src;
		img.width = art.width;
		img.height = art.height;
		if (srcset.length > 0) {
			img.srcset = srcset.join(', ');
		}

		picture.appendChild(img);

		picture.className = className;

		return picture;
	}

	async function* yieldPlaceholderThenPicture(
		placeholder: string,
		album: Album,
		art: ImageSource
	): AsyncGenerator<string|HTMLPictureElement> {
		yield placeholder;

		yield await picture(album, art);
	}

	async function* yieldAlbumCovers(
		album: Album
	): AsyncGenerator<TemplateResult> {
		for await (const appendPicture of album.art.covers.map(
			(cover): Promise<HTMLPictureElement> => {
				return picture(album, cover);
			}
		)) {
			yield html`<li>${appendPicture}</li>`;
		}
	}

	async function* yieldAlbumBackground(
		album: Album
	): AsyncGenerator<HTMLPictureElement> {
		yield await picture(album, album.art.background, 'bg');
	}

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

	async function updateStorageEstimate(): Promise<void> {
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

	async function* yieldBulkAlbumAction(
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

		async function numberOfFilesInCache(
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

		async function filesByCacheStatus(
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

		async function* yieldFilesProgress(
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

		yield html`
			${asyncReplace(
				yieldFilesProgress(
					filesForApp,
					'for-app',
					'Files cached for use in app'
				)
			)}
			${asyncReplace(
				yieldFilesProgress(
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
					@click=${async (): Promise<void> => {
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
					}}
				>🔽</button>
			</div>
		`;
	}

	async function updateBulkAlbumActions(): Promise<void> {
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
							albumEntry[0],
							albumEntry[1]
						))}</li>`;
					})()
				)}`;
			})}`,
			bulkAlbumActions
		);
	}

	function AlbumViewClickFactory(
		album: Album,
		track: Track
	): (e: Event) => Promise<void> {
		const path = album.path + track.subpath;

		return async (e: Event): Promise<void> => {
			const button = e.target as HTMLButtonElement;

			if (currentTrack === track) {
				audio.pause();
				button.textContent = '⏯';
				currentTrack = undefined;

				return;
			}

			const cid = await albumTrackCID(album, track);

			button.disabled = true;
			button.textContent = '⏳';
			trackMostRecentlyAttemptedToPlay = cid;

			const trackUrl = await urlForThing(
				track,
				path
			);

			button.disabled = false;
			button.textContent = '⏯';

			if (cid === trackMostRecentlyAttemptedToPlay) {
				currentTrack = track;
				play(trackUrl);
			}
		};
	}

	function AlbumView(album: Album): TemplateResult {
		return html`
			<ol class="covers">${asyncAppend(yieldAlbumCovers(album))}</ol>
			<dl class="discs">${Object.entries(album.discs).map((disc) => {
				const [discName, tracks] = disc;

				return html`
					<dt>${discName}</dt>
					<dd>
						<ol class="tracks">${tracks.map((track) => {
							return html`
								<li>
									<button
										type="button"
										aria-label="Play or Pause ${
											track.name
									}"
										@click=${AlbumViewClickFactory(
											album,
											track
										)}
									>⏯</button>
									${track.name}
								</li>
							`;
						})}</ol>
					</dd>
				`;
			})}</dl>
			${asyncAppend(yieldAlbumBackground(album))}
		`;
	}

	async function AddAlbum(
		album: Album,
		_albumId: string
	): Promise<TemplateResult> {
		const button = html`<a
			class="entry"
			href="#album/${_albumId}"
			aria-label="View &quot;${album.name}&quot;"
		>${asyncReplace(yieldPlaceholderThenPicture(
			'Loading...',
			album,
			album.art.covers[0]
		))}</a>`;

		return button;
	}

	async function* renderAlbums(): AsyncGenerator<TemplateResult> {
		for (const [albumId, albumGetter] of Object.entries(Albums)) {
			yield await albumGetter().then((album) => {
				return AddAlbum(album, albumId);
			})
		}
	}

	render(html`${asyncAppend(renderAlbums())}`, albums);

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

	const albumHashRegex = /^#album\/(OCRA\d{4})$/;

	function swapMain(useThisInstead: HTMLElement, allowBack = true): void {
		for (const toRemove of document.querySelectorAll('body > main')) {
			if (toRemove !== useThisInstead) {
				document.body.removeChild(toRemove);
			}
		}

		document.body.appendChild(useThisInstead);

		if (allowBack) {
			(back as HTMLAnchorElement).classList.remove('disabled');
		} else {
			(back as HTMLAnchorElement).classList.add('disabled');
		}
	}

	async function handleHash(hash: string): Promise<void> {
		if ('#' === hash || '' === hash) {
			swapMain(albums, false);
		} else if ('#app' === hash) {
			await Promise.all([
				updateStorageEstimate(),
				updateBulkAlbumActions(),
			]);
				if (hash === location.hash) {
					swapMain(appInfo);
				}
		} else {
			if (albums.parentNode === document.body) {
				document.body.removeChild(albums);
			}

			const maybe = albumHashRegex.exec(hash);

			if (maybe && maybe[1] in Albums) {
				const album = await Albums[maybe[1]]();

					if ( ! views.has(album)) {
						const view = document.createElement('main');
						render(AlbumView(album), view);
						view.classList.add('view');
						views.set(album, view);
					}

					if (location.hash === hash) {
						currentAlbum = album;
						swapMain(
							views.get(album) as HTMLElement
						);
					} else {
						console.log(
							'hash changed while album data was being loaded'
						);
					}
			} else {
				console.warn('unsupported hash specified', hash);
			}
		}
	}

	addEventListener('hashchange', () => {
		handleHash(location.hash);
	});

	handleHash(location.hash);

	console.info(currentAlbum);
})();
