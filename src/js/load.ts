import {
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
} from './data.js';
import {Albums} from '../data/albums.js';
import {
	yieldPlaceholderThenPicture,
	yieldAlbumCovers,
	yieldAlbumBackground,
} from './utilities/elements.js';
import {
	updateStorageEstimate, updateBulkAlbumActions,
} from './utilities/rendering.js';

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
				updateStorageEstimate(storageEstimate),
				updateBulkAlbumActions(appInfo, bulkAlbumActions),
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
